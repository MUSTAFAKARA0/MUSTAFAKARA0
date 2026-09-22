# BREAKLINE — Performance

## Object pooling (the main strategy)

Every frequently-spawned object is pooled, never freed/instantiated at
runtime after startup:

| Pool | Manager | Pool size | Growth policy |
|---|---|---|---|
| Projectiles | `ProjectileManager` | 24 | grows on demand |
| Targets | `TargetManager` | 20 | grows on demand |
| Obstacles | `ObstacleManager` | 10 | grows on demand |
| Glass fragments | `FragmentManager` | 60 (up to `material.fragment_count`, default 8, per shatter) | **hard ceiling** -- a shatter that would exceed it spawns fewer shards, never more instances (see docs/PHYSICS.md) |

Fragments are the one pool worth hard-capping because they're the only
real `RigidBody3D`s in the game and the only pool whose demand scales
with player skill (a long combo chain shatters many targets fast). The
other three grow on demand since steady-state play should never actually
hit that path once tuned against real device testing (Phase 7) --
growing is a safety net, not the expected behavior.

## Physics budget

- Targets, obstacles, projectiles, and the player's hit-detector are all
  `Area3D` (overlap/monitoring), not simulated rigid bodies — cheap, no
  contact resolution.
- Only glass fragments are real `RigidBody3D`s, and they're capped at 60
  concurrent instances total. Each runs a real physics-driven outward
  phase (`material.fragment_outward_time`, ~0.16s) then a scripted
  velocity-steering pull-and-fade phase (~0.32s) -- see docs/PHYSICS.md --
  with a hard 2.0s `lifetime_cap` safety net regardless of a material's
  own timings.
- `physics_ticks_per_second = 60` in `project.godot`; `3d/run_on_separate_thread`
  is off (default) — revisit only if profiling shows main-thread physics
  cost is the bottleneck.

## Rendering

- `renderer/rendering_method = "mobile"` in `project.godot`.
- `msaa_3d = 1` (light AA), moderate `glow_intensity` on the `WorldEnvironment`
  — tuned for "looks premium" vs. "still 60fps on mid-range Android," not
  yet verified on real hardware.
- World geometry (`EnvironmentBuilder`) is low-segment primitives (boxes,
  8-sided cylinders). Near-field structure now carries engine-generated
  noise textures (see *Material / shader cost* below); there are still no
  image files to stream and no high-poly meshes. The Fracture Protocol
  environment pass (asymmetric
  walls, pipes, catwalks, shafts, sparse anomaly accents) landed at
  roughly 140 static nodes total for the whole track, built once at level
  load and never touched again -- fewer nodes than the environment it
  replaced (~170), despite being structurally more varied, because pipes
  are now a handful of long continuous cylinders instead of a per-segment
  cluster, and building materials collapsed from ~90 unique instances to
  a shared cache of ~9.
- `GlassTarget`'s cluster (5 facet meshes + 1 core mesh + 1 collision
  shape per instance, 20 pooled instances) and `KineticDart`'s finned body
  (nose + body + 4 fins + collision + trail + light) are both still
  primitive-count-light -- more individual `MeshInstance3D` nodes than
  the flat-panel target / plain-orb projectile they replaced, but each
  one is a small, simple mesh with a shared material, not a draw-call or
  vertex-count concern at these pool sizes.

## Garbage collection / allocation

- **Per-activation material allocation is gone.** `GlassTarget`,
  `GlassFragment` and `Obstacle` each duplicate their shared material
  exactly once, in `_ready()`, and every later spawn only writes shader
  uniforms onto that instance-owned copy. Previously every shatter
  allocated up to 60 `StandardMaterial3D`s and every target spawn
  allocated 2 more. Steady-state allocation from the visual layer is now
  zero.
- `VFXManager.request_hit_pause()`'s `Engine.time_scale` dip is global
  and affects every `_process`/`_physics_process` call in the game for
  its (real-time) ~60ms duration -- not a GC/allocation concern, but
  worth remembering it's global state, not scoped to one object; the
  re-entrancy guard (`_hit_pause_active`) is what keeps it bounded.
- No `Array`/`Dictionary` allocation inside per-frame hot paths
  (`_process`/`_physics_process`) beyond what's shown above.

## Material / shader cost (Visual Quality Gate pass)

**Static estimate only. No device, no profiler, no frame counter has
been run against any of this.** Treat every number below as a budget to
verify, not a measurement.

### Unique materials in a showcase frame

| Material | Type | Instances | Notes |
|---|---|---|---|
| Structural Metal | `StandardMaterial3D`, 2 noise textures | 1 shared | all beams share it → batches |
| Dark Composite | `StandardMaterial3D`, 2 noise textures | 2 (shared + ground duplicate) | |
| Energy Surface | `ShaderMaterial` | 4 duplicates (trim / conduit / lane marker / anomaly) | one shader, four uniform sets |
| Containment Crystal | `ShaderMaterial` | 1 per pooled target (10) | instance-owned, see above |
| Crystal Fragment | `ShaderMaterial` | 1 per pooled fragment (60) | cheap variant |
| Danger | `ShaderMaterial` | 1 per pooled obstacle (4) | |
| Plain (pipes, catwalks, distant, dart shell/accents, VFX) | `StandardMaterial3D` | ~8 | untextured |

Unique **shader programs**: 4 (`containment_crystal`,
`crystal_fragment`, `energy_surface`, `hazard_stripe`) plus the engine's
`StandardMaterial3D` variants. Material *instances* are high only
because instance ownership is what buys zero-allocation spawning; they
all share their program, which is what the GPU actually cares about.

### Texture memory

Four `NoiseTexture2D`, 256×256 each, generated at import. Uncompressed
RGBA8 that is ~1 MB total; with mobile compression, less. There are no
image files in the repository at all.

### Transparency / overdraw

This was audited specifically, because transparency is the main mobile
GPU risk here:

- **Containment Crystal** uses `depth_prepass_alpha` — two geometry
  passes for 5 small facets × at most ~8 on-screen targets. Accepted:
  without it, overlapping facets of a single shard sort incorrectly,
  which is the exact readability the shard depends on.
- **Crystal Fragment** deliberately does *not* prepass, and writes no
  depth. 60 fragments × a second geometry pass would be the single
  worst thing in the frame, for artefacts nobody can see on a 0.2m shard
  moving at speed.
- **Background structures were switched from alpha-blended to opaque.**
  A dozen large overlapping transparent boxes behind everything else
  was the worst overdraw source in the scene, for a haze that a flat
  dark colour sells just as well against the fog.
- Remaining transparency: dart trail quads (12, billboarded), VFX core
  flare (≤4 small additive spheres), particle bursts.

### Mesh / draw-call estimate for `ShowcaseSection.tscn`

| Source | Visible mesh instances |
|---|---|
| Environment (200m track) | ~36 |
| Placed targets (7 × 6 meshes) | 42 |
| Placed obstacle | 1 |
| Kinetic Dart in flight (each) | 7 + trail + light |
| Fragments during a shatter | up to `fragment_count` (default 8), 60 hard ceiling |

Quiet frame: roughly **80–120 draw calls** before culling and batching.
Frustum culling should remove most of the environment at any moment,
since the track is 200m long and fog density 0.014 limits useful view
distance. This is a reasonable mid-range Android budget on the mobile
renderer — *if the estimate is right*, which is exactly what has not
been checked.

### Lights

One `DirectionalLight3D` with shadows, plus transient point lights: up
to 6 pooled impact flashes and 1 `OmniLight3D` per in-flight dart, all
`shadow_enabled = false`. Dart light range was widened (1.6 → 2.4) and
energy lowered (2.0 → 1.6): a wider, dimmer light interacts with the
structure more and blows out less.

### What would be cut first on a low-end device

In order: (1) dart `OmniLight3D`, (2) impact-flash light pool, (3)
`depth_prepass_alpha` on the crystal shader, (4) noise textures on
`dark_composite`, (5) `DirectionalLight3D` shadows.

## Not yet implemented

- LOD, texture compression tuning, and a Low/Medium/High graphics preset
  are not built — there's currently only one visual quality level. This
  is deferred until there's real content to profile and a device to test
  on (see ANDROID.md, TESTING.md — Phase 7).
- No per-material fragment/VFX variation yet (see docs/MATERIALS.md) --
  when a second material genuinely needs different fragment geometry
  (not just different numbers), pool sizing for it needs the same
  hard-ceiling treatment `FragmentManager` already has, not a naive
  second pool multiplying total rigid-body count.

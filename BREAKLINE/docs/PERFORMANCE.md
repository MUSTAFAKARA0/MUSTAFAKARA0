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
  8-sided cylinders) with flat materials — no textures to stream, no
  high-poly meshes. The Fracture Protocol environment pass (asymmetric
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

- Materials for glass fragments and target facets/cores are duplicated
  per-activation (`GlassFragment.activate()`, `GlassTarget._apply_visuals()`)
  rather than shared, because each shatter/spawn should be tinted per
  the active `MaterialProfile`; this is a small, bounded allocation (≤60
  fragments + ≤20 targets live at once) — if profiling shows this
  matters, the fix is a small material-variant pool keyed by material_id.
- `VFXManager.request_hit_pause()`'s `Engine.time_scale` dip is global
  and affects every `_process`/`_physics_process` call in the game for
  its (real-time) ~60ms duration -- not a GC/allocation concern, but
  worth remembering it's global state, not scoped to one object; the
  re-entrancy guard (`_hit_pause_active`) is what keeps it bounded.
- No `Array`/`Dictionary` allocation inside per-frame hot paths
  (`_process`/`_physics_process`) beyond what's shown above.

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

# BREAKLINE — Material System

> **Two different things are called "material" in this project.** This
> document covers both, and they must not be confused:
>
> - **`MaterialProfile`** (§ *The abstraction* onward) — a gameplay data
>   resource under `data/materials/`. Decides how a target *breaks*,
>   *scores* and *sounds*. Has nothing to do with rendering.
> - **Render materials** (§ *The render material set*) — the actual
>   `Material` resources under `assets/materials/`. Decide how surfaces
>   *look*.
>
> `MaterialProfile` drives render materials (its colours are pushed into
> shader uniforms at spawn), never the other way round.

---

## The render material set

Five materials carry the whole look. The rule applied when choosing how
to build each one was **visual quality first, implementation convenience
second** — which is why they are not all built the same way.

| # | Material | File | Built as | Why this technique |
|---|---|---|---|---|
| 1 | **Structural Metal** | `assets/materials/structural_metal.tres` | `StandardMaterial3D` + engine-generated noise (roughness + normal), triplanar | Beams are large, close, and lit. They need surface *variation* under the directional light, and a roughness/normal break is what stops a 20m beam reading as one flat extrusion. Triplanar because every beam is a procedurally-sized `BoxMesh` with no authored UVs. |
| 2 | **Dark Concrete / Composite** | `assets/materials/dark_composite.tres` | `StandardMaterial3D` + cellular noise, triplanar | Same reasoning, opposite substance: non-metallic, rougher, cast rather than milled. Alternating 1 and 2 across the wall is what gives the corridor material variety without a second art pipeline. The floor is a darker duplicate with tighter tiling. |
| 3 | **Energy Surface** | `assets/materials/energy_surface.tres` (+ `shaders/energy_surface.gdshader`) | Custom shader, unshaded, scrolling bands | Conduits and trim need *motion*, which no static texture provides. A 20-line shader gives scrolling energy bands at effectively zero memory cost, and one shader serves trim, conduits, lane markers and the magenta anomaly through four sets of uniforms. |
| 4 | **Containment Crystal** | `assets/materials/containment_crystal.tres` (+ `shaders/containment_crystal.gdshader`) | Custom shader, fresnel rim, `depth_prepass_alpha` | The target's substance. A `StandardMaterial3D` cannot do view-dependent rim lighting, and rim lighting is what makes a translucent shard hold a readable silhouette against a dark corridor. `depth_prepass_alpha` is required specifically because a shard is five *overlapping* transparent facets, which otherwise sort wrongly against each other. A fragment-only variant (`crystal_fragment.tres`) drops the prepass — see the note in that shader. |
| 5 | **Danger** | `assets/materials/danger_material.tres` (+ `shaders/hazard_stripe.gdshader`) | Custom shader, procedural diagonal stripes | Caution stripes as geometry meant two extra meshes per obstacle sitting 0.01 in front of the body. In-shader they follow the surface, cannot z-fight, and the pulse becomes one uniform. |

**No texture *files* exist in the project.** Materials 1 and 2 generate
their maps in-engine via `FastNoiseLite` → `NoiseTexture2D` at import
time. There is therefore nothing to license, nothing to attribute, and
nothing in version control but a few lines of `.tres`.

### Where textured materials are and are not used

Textured/triplanar materials are applied to **near-field structure
only** — beams, floor, vertical shafts. Pipes, catwalks, background
silhouettes, the Kinetic Dart and every VFX surface stay on plain
untextured materials. A texture the player never gets close enough to
resolve is pure cost.

### Instance ownership

Anything whose material animates per instance duplicates the shared
resource **once**, in `_ready()`, and thereafter only writes uniforms:
`GlassTarget`, `GlassFragment`, `Obstacle`. This matters twice over —
it removes all per-spawn material allocation, and it fixes a real bug
where every pooled obstacle shared one stripe material and pulsed in
lockstep.

---

## The abstraction

`scripts/materials/MaterialProfile.gd` is a flat data `Resource` (no
virtual methods) describing what a destructible object is made of:
appearance (albedo/emission/core colors), fracture physics (fragment
count/timings/impulse), and response (score multiplier, SFX names, camera
shake, haptics). A new substance is a new `.tres` file under
`data/materials/`, never a new script.

This is deliberately separate from `TargetBehavior` (docs/TARGETS.md),
which decides what KIND of target something is (normal/fake/moving/...).
A `GlassTarget` holds exactly one of each, and neither knows the other
exists — `GlassTarget.take_hit()` just asks its material "how do you
break?" and its behavior "do you score?" and orchestrates the answers.
This is what let the Unstable Signal (fake target) material exist without
`FakeTargetBehavior` containing a single color value.

## Implemented today

| File | Used by | Notes |
|---|---|---|
| `data/materials/containment_glass.tres` | Normal, Moving targets | The baseline; cyan, `score_multiplier = 1.0` |
| `data/materials/unstable_signal.tres` | Fake targets | Warm-red, still uses the glass-family fracture pipeline (see docs/PHYSICS.md) with slightly punchier impulse/shake — a decoy still needs to *feel* like it broke something |

## Fields (see the script for exact defaults)

```
MaterialProfile
 ├── material_id, display_name
 ├── Appearance: albedo_color, emission_color, emission_energy,
 │              core_color, core_emission_energy
 ├── Fracture:   fragment_count, fragment_outward_time,
 │              fragment_dissolve_time, fragment_gravity_scale,
 │              impulse_strength, impulse_random_spread
 └── Response:   score_multiplier, sfx_crack, sfx_shatter,
                camera_shake_strength, camera_shake_duration,
                haptic_strength
```

## Adding a material later (Metal, EnergyCrystal, Ceramic, Shield, Composite, ...)

1. Duplicate `containment_glass.tres`, change the fields above to taste
   (e.g. Metal: no transparency, low `impulse_random_spread`, a metallic
   `sfx_shatter`, no core glow; EnergyCrystal: higher
   `core_emission_energy`, higher `score_multiplier`).
2. Have `TargetManager` (or a future `ObstacleManager`/prop system) hand
   it out via `preload()` the same way `GLASS_MATERIAL`/`SIGNAL_MATERIAL`
   are today.
3. Nothing in `GlassTarget.gd`, `FragmentManager.gd`, or `GlassFragment.gd`
   needs to change — the whole fracture pipeline already reads every
   number it needs from the profile.

## What's intentionally not built yet

Per-material VFX/mesh variation (e.g. metal sparks instead of glass
shards) is not implemented — every material currently fractures through
the same shard mesh (`scenes/targets/GlassFragment.tscn`), just with
different color/timing/impulse numbers. Adding a genuinely different
fragment presentation per material (e.g. metal shouldn't dissolve into
light, it should clatter and settle) is real future work, not a data-only
change, and shouldn't be built until there's a second material that
actually needs it — building it speculatively now would be exactly the
overengineering this pass was told to avoid.

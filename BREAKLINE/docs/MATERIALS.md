# BREAKLINE — Material System

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

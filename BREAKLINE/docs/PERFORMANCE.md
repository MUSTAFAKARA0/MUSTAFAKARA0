# BREAKLINE — Performance

## Object pooling (the main strategy)

Every frequently-spawned object is pooled, never freed/instantiated at
runtime after startup:

| Pool | Manager | Pool size |
|---|---|---|
| Projectiles | `ProjectileManager` | 24 |
| Glass fragments | `FragmentManager` | 60 (8 per shatter) |
| Targets | `TargetManager` | 20 |
| Obstacles | `ObstacleManager` | 10 |

Pools grow on demand (`_pool.is_empty()` → spawn one more) rather than
hard-capping and silently failing, but steady-state play should never hit
that path once pool sizes are tuned against real device testing (Phase 7).

## Physics budget

- Targets, obstacles, projectiles, and the player's hit-detector are all
  `Area3D` (overlap/monitoring), not simulated rigid bodies — cheap, no
  contact resolution.
- Only glass fragments are real `RigidBody3D`s, and they're capped at 60
  concurrent instances total and auto-freeze/deactivate after 1.2s
  (`GlassFragment.lifetime`).
- `physics_ticks_per_second = 60` in `project.godot`; `3d/run_on_separate_thread`
  is off (default) — revisit only if profiling shows main-thread physics
  cost is the bottleneck.

## Rendering

- `renderer/rendering_method = "mobile"` in `project.godot`.
- `msaa_3d = 1` (light AA), moderate `glow_intensity` on the `WorldEnvironment`
  — tuned for "looks premium" vs. "still 60fps on mid-range Android," not
  yet verified on real hardware.
- World geometry (`EnvironmentBuilder`) is flat-shaded boxes with emissive
  materials — no textures to stream, no high-poly meshes.

## Garbage collection / allocation

- Materials for glass fragments are duplicated per-activation
  (`GlassFragment.activate()`) rather than shared, because each shatter
  should be tinted per-target; this is a small, bounded allocation (≤60
  live at once) — if profiling shows this matters, the fix is a small
  material-variant pool keyed by color.
- No `Array`/`Dictionary` allocation inside per-frame hot paths
  (`_process`/`_physics_process`) beyond what's shown above.

## Not yet implemented

- LOD, texture compression tuning, and a Low/Medium/High graphics preset
  are not built — there's currently only one visual quality level. This
  is deferred until there's real content to profile and a device to test
  on (see ANDROID.md, TESTING.md — Phase 7).

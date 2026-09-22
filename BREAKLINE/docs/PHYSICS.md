# BREAKLINE — Physics

## Fragment impulse (fixed this pass)

**The bug:** the original implementation computed
`impulse = -forward * random + spread`, where `forward` was actually
already `hit_normal` (`-projectile_direction`, passed from
`GlassTarget.take_hit`). So `-forward` resolved to
`-(-projectile_direction) = projectile_direction` -- fragments launched
in the direction the projectile was already travelling (deeper into the
scene), not outward from the impact.

**The fix** (`FragmentManager.shatter_at`):

```
outward       = hit_normal.normalized()              # back toward the shooter
forward_carry = projectile_direction.normalized() * 0.35   # momentum continuing through
impulse       = (outward + forward_carry) * material.impulse_strength
              + random_unit_vector * material.impulse_random_spread
```

This reads correctly: most of a shard's motion is outward (toward the
camera/viewer, as if debris were thrown back by the impact), with a
smaller continuing-momentum component and material-scaled randomness.
`hit_normal` is still the same approximation as before
(`-projectile_direction`, not a true raycast surface normal) --
Area3D overlap detection doesn't provide contact points/normals, and
switching to raycast-based collision to get a true normal would be a
bigger architectural change than this pass's scope justified. The
approximation is reasonable for a panel-like cluster that's roughly
facing the player, which every target in World 1 is.

## Fracture-and-dissolve lifecycle (replaces "explode and fall")

`GlassFragment` runs two phases per activation instead of one:

1. **Outward** (`material.fragment_outward_time`, ~0.16s default): a real
   `RigidBody3D`, simulated normally under the impulse above and
   `material.fragment_gravity_scale`. This is genuine physics, not
   scripted motion.
2. **Pull + dissolve** (`material.fragment_dissolve_time`, ~0.32s
   default): the shard's `linear_velocity` is steered (lerped, not
   snapped) toward the original impact point each physics frame while its
   material fades to fully transparent via a `Tween` on
   `albedo_color:a`/`emission_energy_multiplier`. It's deactivated the
   moment the fade finishes, not when it "lands."

This is cheaper than simulating a believable landing/settle (no need to
detect rest, no risk of a shard clipping through geometry and looking
wrong) and matches the "energy drain" destruction language in
docs/ART_DIRECTION.md. A hard `lifetime_cap` (2.0s) is an absolute safety
net regardless of a material's own timings, so a misconfigured
`MaterialProfile` can never leave a shard stuck active.

## Moving-target easing

`MovingTargetBehavior`/`GlassTarget.advance_moving_motion()` sums two
sine waves at different frequency/phase (the second at ~2.3x frequency,
~18% amplitude) instead of one bare sine, plus a per-spawn randomized
phase and speed multiplier (`randf_range(0.85, 1.15)`). The result reads
as an irregular drift rather than a metronome, without needing an actual
physics-driven motion controller.

## Obstacle telegraph

Not physics, but adjacent: `Obstacle._process()` scales the node's Y from
0.1 to 1.0 over its first 0.3s after `spawn_reset()`, and its warning
stripe material pulses continuously (`emission_energy_multiplier`
oscillating via `sin()`) for the rest of its active lifetime. This gives
the appearance of "coming online" rather than popping in at full size,
and is timed short enough (0.3s vs. `spawn_lead_distance = 55` units of
travel time) that it's always long finished before the player reaches it.

## What deliberately did not change

- **Pooling** (`ProjectileManager`, `FragmentManager`, `TargetManager`,
  `ObstacleManager`) is untouched -- all fixes above are behavior/data
  changes inside the existing pooled objects, not new allocation
  patterns. `FragmentManager.POOL_SIZE = 60` is still a hard ceiling; a
  shatter that would exceed it spawns fewer shards, never more instances.
- **Collision detection** stays `Area3D` overlap-based (no raycasts,
  no real rigid-body contact resolution for gameplay hits) -- see the
  fragment impulse note above for why a true surface normal wasn't
  pursued this pass.
- **Hit-pause** (`VFXManager.request_hit_pause`) is a brief, guarded
  global `Engine.time_scale` dip (default 0.25x for 0.06s of *real* time,
  via `SceneTree.create_timer`'s `ignore_time_scale`), reserved for
  precision hits only. It is re-entrancy-guarded so overlapping precision
  hits can't stack into a longer freeze. This is the one place physics
  and game-feel intersect this pass -- see docs/GAMEPLAY.md.

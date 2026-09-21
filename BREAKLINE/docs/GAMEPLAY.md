# BREAKLINE — Gameplay Systems

## Movement (`scripts/player/PlayerController.gd`)

- Constant forward motion along **-Z**, speed ramps from `base_forward_speed`
  to `max_forward_speed` at `speed_ramp_per_second` (all three come from the
  active `LevelData`).
- Horizontal position lerps toward `reticle_x * lane_half_width` — i.e. the
  same drag that aims the camera also gives "small amount of left/right
  steering," per design intent, without a second control scheme.

## Aim & shoot

1. `InputManager` turns raw touch/mouse into `aim_touch_started/moved` (drag)
   and `shoot_requested` (tap: press+release within `TAP_MAX_DRAG` px and
   `TAP_MAX_DURATION` s, no drag in between).
2. `PlayerController` keeps a normalized reticle position from the last
   touch point and uses `Camera3D.project_ray_normal(screen_pos)` at fire
   time to get a true world-space aim direction — this is what makes "hits
   where you actually tapped" work, independent of FOV/aspect ratio.
3. `ProjectileManager.fire("energy_ball", muzzle_pos, direction, speed)`
   pulls a pooled `Projectile` and launches it.

## Projectile (`scripts/projectiles/Projectile.gd`)

`Area3D`, moves by direct position update (not physics-simulated), checks
overlap each `_physics_process`. On target hit: calls `take_hit()` on the
target and returns to pool. On timeout with no hit: counts as a miss and
breaks combo (`ComboManager.break_combo()`). Only the "energy ball" exists
today; `PROJECTILE_SCENES` in `ProjectileManager` is where bomb/chain/
freeze/pierce variants would register later — do not build those before the
base projectile feels perfect.

## Glass destruction (`scripts/targets/GlassTarget.gd`)

Pre-fractured-in-spirit approach for mobile: the panel itself is a single
mesh that instantly hides on hit, and `FragmentManager` spawns a handful of
small pooled `RigidBody3D` shards with an outward impulse — no real-time
mesh fracture. Sequence on hit: hide panel → spawn fragments → particle
burst → camera shake → haptic → SFX → score/combo update. See
PERFORMANCE.md for why this is pooled rather than instantiated per hit.

## Targets (`scripts/targets/TargetManager.gd`)

Three lanes (`x = -2.2, 0, 2.2`). Spawns are distance-based (tracked against
`player.global_position.z`), not timer-based, so spawn density is stable
regardless of frame rate. `difficulty` (0..1, from `LevelManager`) shortens
the spawn interval and unlocks MOVING/FAKE variants past thresholds.

## Obstacles (`scripts/obstacles/ObstacleManager.gd`)

Same pooling/spawn-distance pattern as targets, on an independent cadence,
each instance blocking exactly one of the three lanes — there is always at
least one safe lane. Player collision is detected by the player's own
`HitDetector` `Area3D` (layer 2, mask 8) overlapping an obstacle
(layer 8) — obstacles never need to look for the player.

## Combo & score

- `ComboManager`: combo count doubles as multiplier (1 hit = x1 ... capped
  at x10), resets after `COMBO_TIMEOUT_SEC` with no hit, or immediately on a
  miss / FAKE target / obstacle collision.
- `ScoreManager.add_target_hit(base_points)` multiplies by the current combo
  multiplier; a `perfect` flag (unused yet) is wired for a future
  "hit dead-center" bonus.

## Game over

`GameManager.trigger_game_over()` builds a stats dict (`score`, `best_score`,
`distance`, `accuracy`, `max_combo`, `coins`), saves it via `SaveManager`,
and emits `run_ended`. `LevelManager` shows `GameOverScreen` and wires its
`retry_requested`/`home_requested` signals to `GameManager.retry()` /
`go_to_main_menu()`.

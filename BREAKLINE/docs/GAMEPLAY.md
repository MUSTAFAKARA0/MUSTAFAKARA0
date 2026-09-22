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
3. `ProjectileManager.fire("kinetic_dart", muzzle_pos, direction, speed)`
   pulls a pooled `Projectile` and launches it.

## Projectile — "Kinetic Dart" (`scripts/projectiles/Projectile.gd`)

`Area3D`, moves by direct position update (not physics-simulated), checks
overlap each `_physics_process`. On target hit: calls `take_hit()` on the
target (passing hit position, hit normal, *and* its own travel direction
— see docs/PHYSICS.md) and returns to pool. On timeout with no hit: counts
as a miss and breaks combo (`ComboManager.break_combo()`). An oriented,
finned dart rather than a glowing orb (see docs/ART_DIRECTION.md) — fins
visibly unfold on launch (`_unfold_fins`), and the body has a subtle
in-flight pulse. Only the "kinetic dart" exists today; `PROJECTILE_SCENES`
in `ProjectileManager` is where future variants would register — do not
build those before the base projectile feels perfect.

## Destruction — "Fracture-and-dissolve" (`scripts/targets/GlassTarget.gd`, `FragmentManager.gd`, `GlassFragment.gd`)

Replaces an earlier "explode into cubes and fall" version. Sequence on
hit: hide the target's cluster → impact flash + directional particle burst
→ pooled shard fragments burst outward under a real physics impulse
(hit-normal + projectile-momentum + material-scaled randomness — see
docs/PHYSICS.md) → after a brief outward phase, shards get pulled back
toward the impact point while fading to nothing, rather than settling on
the ground → camera shake (bigger + a brief hit-pause on a precision hit)
→ haptic → SFX → score/combo update. Every number in this pipeline (how
many shards, how long each phase lasts, how strong the impulse is, which
sounds play) comes from the target's `MaterialProfile`
(docs/MATERIALS.md), not hardcoded per-target — this is what lets a
future material (metal, energy crystal, ...) break differently without
touching this pipeline.

## Precision hits

Every target has a visible glowing core — its actual weak point, not just
decoration. A hit within `GlassTarget.PRECISION_RADIUS` of the core
counts as a precision hit: brighter flash, stronger shake, a brief
hit-pause, the `perfect_hit` SFX, and `ScoreManager.add_target_hit`'s
`perfect` bonus (previously an unused parameter, now wired up). This is
the skill-expression layer a flat panel with no "center" never had room
for. See docs/TARGETS.md.

## Targets (`scripts/targets/TargetManager.gd`)

Three lanes (`x = -2.2, 0, 2.2`). Spawns are distance-based (tracked against
`player.global_position.z`), not timer-based, so spawn density is stable
regardless of frame rate. `difficulty` (0..1, from `LevelManager`) shortens
the spawn interval and unlocks MOVING/FAKE variants past thresholds. Each
spawn picks a `(TargetBehavior, MaterialProfile)` pair — see
docs/TARGETS.md — rather than a single enum, so new archetypes are
additive. **Honest gap:** this is still a random roll gated by a
difficulty threshold, not the authored Introduction → Learning →
Combination → Pressure → Mastery → Climax pacing described in
docs/LEVELS.md — that's real future work, not implemented this pass.

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
- `ScoreManager.add_target_hit(points, is_precision)` multiplies by the
  current combo multiplier and, when `is_precision` is true (see
  "Precision hits" above), adds `PERFECT_HIT_BONUS`.

## Game feel: normal hit vs. precision hit

Deliberately two tiers, not a graduated pile of effects (see
docs/ART_DIRECTION.md's "every feedback needs a gameplay purpose" rule):

| | Normal hit | Precision hit (within core radius) |
|---|---|---|
| Impact flash | base energy | ×1.6 |
| Camera shake | base strength | ×1.4 |
| Hit-pause | none | brief (`VFXManager.request_hit_pause`, ~60ms real time) |
| Audio | crack + shatter + target_hit | + `perfect_hit` |
| Score | `base_points × combo × material.score_multiplier` | + `PERFECT_HIT_BONUS` |

Hit-pause is reserved for precision hits specifically because applying it
to every hit would turn a fast combo chain into a stutter — see
docs/PHYSICS.md for the re-entrancy guard that keeps overlapping
precision hits from stacking dips into a longer freeze.

## Game over

`GameManager.trigger_game_over()` builds a stats dict (`score`, `best_score`,
`distance`, `accuracy`, `max_combo`, `coins`), saves it via `SaveManager`,
and emits `run_ended`. `LevelManager` shows `GameOverScreen` and wires its
`retry_requested`/`home_requested` signals to `GameManager.retry()` /
`go_to_main_menu()`.

---

## Control model — SINGLE RAIL (current)

The player travels a **fixed line** and cannot move sideways at all.

| Input | Does |
|---|---|
| Drag | Aim. Moves the reticle, leans the camera 4 deg yaw / 3 deg pitch. |
| Tap | Fire a Kinetic Dart at the reticle. |

Lateral movement was removed outright. It had been mapped from the same
variable as the aim reticle, so aiming right and flying right were
literally inseparable; a deadzoned lean version was built and measured
(peak 3.2 m/s, down from 19.2 m/s) and still left one finger owning two
jobs. On a phone, "aim precisely at a shard 40 m away" and "dodge now"
cannot share a thumb.

### What that forces

With no dodge, **a hazard can no longer be something you steer around**,
so every hazard must have an answer that aiming can provide:

- A hazard carries an exposed **actuator node** (`WeakPoint`). A dart
  within 0.46 m of it cuts the actuator and the hazard retracts.
- Shooting the hazard's **body** does nothing — it sparks, and the shot
  is wasted.
- Ramming an active hazard still ends the run.

This is the originality line against Smash Hit, and it is deliberate:
that game is about *breaking through* the thing in front of you. BREAKLINE
is about **operating the facility against itself** — you are not smashing
a door down, you are killing the motor that holds it shut. Different verb,
different skill (single precise shot vs. volume of throws), different
fiction.

### Core loop contract

| Thing | Shot by a dart | Rammed by the player |
|---|---|---|
| Containment Shard (real) | Shatters, scores, combo +1 | Shatters, **no score**, −2.6 m/s, combo break |
| Containment Shard (fake) | Shatters, **no score**, combo break | Nothing — harmless |
| Hazard actuator | Hazard retracts, scores 60, combo +1 | — |
| Hazard body (MECHANICAL) | Sparks, shot wasted, miss | **Run over** |
| Hazard body (ENERGY) | Dart passes through | **Run over** |

Shooting is no longer optional. A hazard sits on the rail, and the rail is
the only place the player can be.

### Known consequence, not yet fixed

Spawn pacing was tuned for a game with dodging. Measured on the current
build: the first hazard lands at z = −12, which at 12 m/s the player
reaches in **1.0 s** — before a first shot can realistically be aimed.
With no dodge that is an unavoidable death one second into the run. Phase
B (opening 60 seconds + speed curve) is what fixes it; until then Level01
is not fairly playable.

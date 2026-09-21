# BREAKLINE — Architecture

## Autoload singletons (`project.godot` → `[autoload]`)

| Singleton | Script | Responsibility |
|---|---|---|
| `GameManager` | `scripts/core/GameManager.gd` | State machine (MENU/PLAYING/PAUSED/GAME_OVER), current run stats, scene transitions |
| `SettingsManager` | `scripts/core/SettingsManager.gd` | Volume, haptics, sensitivity, FPS target |
| `InputManager` | `scripts/core/InputManager.gd` | Raw touch/mouse → `aim_touch_*` / `shoot_requested` signals |
| `SaveManager` | `scripts/save/SaveManager.gd` | Versioned local JSON save (`user://breakline_save.json`) |
| `AudioManager` | `scripts/audio/AudioManager.gd` | SFX/music playback by name, missing-asset safe |
| `VFXManager` | `scripts/vfx/VFXManager.gd` | Particle bursts, camera shake requests, haptics |
| `ScoreManager` | `scripts/gameplay/ScoreManager.gd` | Current run score |
| `ComboManager` | `scripts/gameplay/ComboManager.gd` | Combo count / multiplier / break timeout |
| `ProjectileManager` | `scripts/projectiles/ProjectileManager.gd` | Pooled projectile spawning |
| `FragmentManager` | `scripts/targets/FragmentManager.gd` | Pooled glass-fragment rigid bodies |

Autoloads never reference a specific level or scene by path except `GameManager`
(which owns scene transitions) — everything else is data-in/signal-out so a
level scene can be swapped freely.

Per-level nodes (`TargetManager`, `ObstacleManager`, `LevelManager`,
`EnvironmentBuilder`) are **not** autoloads: they live inside
`scenes/levels/Level01.tscn` and are recreated every time the scene loads or
reloads (this is also how `GameManager.retry()` resets a run — it just
reloads the scene).

## Target composition: behavior × material

`GlassTarget` (a "Containment Shard") doesn't hardcode what kind of
target it is or what it's made of — it holds one `TargetBehavior`
(scripts/targets/behaviors/, docs/TARGETS.md) and one `MaterialProfile`
(scripts/materials/, docs/MATERIALS.md) and asks each its own question
(`behavior.on_hit()` for scoring, `material.*` for appearance/fracture/
audio). Behaviors are stateless and shared (`TargetManager` builds three
instances total, not one per pooled target); materials are `.tres` data
resources. This split exists so a new target archetype and a new
substance are independent, additive changes that never touch each other
or `GlassTarget`'s own code.

## Scene flow

```
MainMenu.tscn  --PLAY-->  Level01.tscn  --GAME_OVER-->  (GameOverScreen overlay, same scene)
     ^                                         |
     |------------------- HOME ----------------|
```

`LevelManager._ready()` loads a `LevelData` resource, pushes speed values
into the `Player`, wires `TargetManager`/`ObstacleManager` to the player,
and calls `GameManager.start_run()`. Retry = `get_tree().reload_current_scene()`,
which re-runs all of that from a clean slate — there is no manual reset
bookkeeping to get wrong.

## Physics layers

| Layer # | Value | Used by |
|---|---|---|
| 1 | 1 | World geometry / ground |
| 2 | 2 | Player hit-detector |
| 3 | 4 | Targets (`GlassTarget`) |
| 4 | 8 | Obstacles |
| 5 | 16 | Projectiles |
| 6 | 32 | Glass fragments |

Everything gameplay-relevant is an `Area3D` (targets, obstacles, the
player's hit-detector, projectiles) so hit detection is monitoring/overlap
based, not rigid-body physics — cheap on mobile and deterministic.
Only glass fragments are real `RigidBody3D`s, and those are pooled and
capped (see PERFORMANCE.md).

## Core gameplay loop (who calls whom)

```
InputManager (tap) -> PlayerController._on_shoot_requested
                    -> ProjectileManager.fire("kinetic_dart", ...)
Projectile (physics_process) -> Area3D overlap -> GlassTarget.take_hit()
GlassTarget.take_hit() -> FragmentManager.shatter_at()  [reads target.material]
                        -> VFXManager.spawn_impact_flash() / spawn_burst()
                        -> VFXManager.request_camera_shake() / request_hit_pause() [precision only]
                        -> target.behavior.on_hit() -> ComboManager.register_hit() -> ScoreManager.add_target_hit()
                        -> GameManager.add_coins()
Player.HitDetector overlaps Obstacle -> GameManager.trigger_game_over()
GameManager.trigger_game_over() -> ProjectileManager.return_all_active() [see PHYSICS.md]
                                 -> SaveManager.register_run_result()
                                 -> run_ended signal -> LevelManager shows GameOverScreen
```

See GAMEPLAY.md, TARGETS.md, MATERIALS.md, PHYSICS.md, LEVELS.md,
SAVE_SYSTEM.md, PERFORMANCE.md for the details behind each of these
systems.

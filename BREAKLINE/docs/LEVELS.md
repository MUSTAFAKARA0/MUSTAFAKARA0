# BREAKLINE — Level System

## `LevelData` (`scripts/levels/LevelData.gd`, a `Resource`)

```
LevelData
 ├── level_id, display_name
 ├── base_forward_speed, max_forward_speed, speed_ramp_per_second
 ├── difficulty_ramp_distance   (meters over which difficulty 0 -> 1)
 └── music_track
```

`data/levels/level_01.tres` is the only level instance today. Adding
`level_02.tres` etc. is just another `.tres` file with different numbers —
no code changes required, as long as it points `LevelManager.level_data_path`
at it (or a future level-select screen does).

## Difficulty curve

`LevelManager._process()` computes
`difficulty = clamp(distance_traveled / difficulty_ramp_distance, 0, 1)`
every frame and passes it to both `TargetManager.update()` and
`ObstacleManager.update()`. Each interprets it independently:

- Spawn interval lerps from its own `max_spawn_interval` down to
  `min_spawn_interval`.
- `TargetManager` unlocks MOVING targets past difficulty 0.35 and FAKE
  targets past 0.15 (small chance each).

This keeps the "easy start, gradually harder" requirement without a
hand-authored pattern table — see "Procedural pattern system" below for
where that would plug in later.

## Procedural pattern system (future)

Not implemented yet. The natural extension point is
`TargetManager._spawn_at()` / `ObstacleManager._spawn_at()`: instead of
picking a random lane, they would advance through a `target_pattern` /
`obstacle_pattern` array on `LevelData` (e.g. `["left","center","right",
"zigzag"]`). Both managers already isolate "pick a lane" behind
`_pick_lane()`, so this is a localized change when it's needed.

## World system

World 1 (Glass District) is built procedurally by
`scripts/levels/EnvironmentBuilder.gd` directly inside `Level01.tscn` — see
ARCHITECTURE.md. Worlds 2–5 get their own `EnvironmentBuilder`-style script
and their own `LevelData` entries when that phase starts; there's
deliberately no `WorldManager` abstraction yet because there is only one
world to manage.

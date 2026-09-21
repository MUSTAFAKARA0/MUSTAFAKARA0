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

## Level design philosophy (target state, not yet implemented)

Product direction calls for authored pacing:

```
INTRODUCTION -> LEARNING -> COMBINATION -> PRESSURE -> MASTERY -> CLIMAX
```

Each new mechanic (a MOVING target, a FAKE target, an obstacle) should
first appear alone in a safe context, then get combined with others, then
get tested under pressure. **This does not exist today.** The current
system is a single continuous difficulty scalar (0..1 over distance) that
gates random rolls — a MOVING target can, in principle, be the very first
thing a player ever sees if the RNG lines up past the 0.35 threshold. This
is flagged honestly rather than described as "good enough" — see
docs/ROADMAP.md for when authored pacing is scheduled.

## Procedural pattern system (the natural extension point for the above)

Not implemented yet. `TargetManager._spawn_at()` / `ObstacleManager
._spawn_at()` would advance through a `target_pattern` / `obstacle_pattern`
array on `LevelData` (e.g. `["left","center","right","zigzag"]`) instead
of picking a random lane. Both managers already isolate "pick a lane"
behind `_pick_lane()`, so this is a localized change when it's needed —
but it's also where the authored-pacing work above would actually live
(a pattern *sequence* per phase, not just a pattern *shape*).

## World system

World 1's facility environment is built procedurally by
`scripts/levels/EnvironmentBuilder.gd` directly inside `Level01.tscn` under
the FRACTURE PROTOCOL art direction (see docs/ART_DIRECTION.md) — see
docs/ARCHITECTURE.md. Worlds 2+ get their own `EnvironmentBuilder`-style
script and their own `LevelData` entries when that phase starts, and
should be evaluated against the same art-direction identity, not just a
re-texture of World 1 — there's deliberately no `WorldManager`
abstraction yet because there is only one world to manage.

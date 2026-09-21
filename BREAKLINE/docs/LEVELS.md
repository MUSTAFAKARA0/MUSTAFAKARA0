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

## Deterministic placement (built; the piece meant to survive)

Both managers now expose a public placement API alongside the RNG
spawner, and an `auto_spawn` export that switches the RNG spawner off
without disabling pooling or recycling:

```gdscript
TargetManager.spawn_target(lane_x, z, behavior_id, material_id, points)
ObstacleManager.spawn_obstacle(lane_x, z)
```

`behavior_id` is `"normal" | "fake" | "moving"`, `material_id` is
`"glass" | "signal"`. Both resolve through small lookup functions that
hand back the *same shared* behavior/material objects the RNG path uses
— an authored section is not a special case of *target*, only a special
case of *where*.

This is the hook the authored level system will build on. It exists now
because the visual showcase needed it, not as a down-payment on pacing.

## The showcase section (NOT the authored level system)

`scenes/levels/ShowcaseSection.tscn` + `scripts/levels/ShowcaseDirector.gd`
(`extends LevelManager`) + `data/levels/showcase.tres`.

A real, playable ~200m stretch running the real player, spawners, pools,
materials and destruction, with seven hand-placed beats and a flat
6 m/s speed so a Containment Shard can actually be read as it
approaches. Its only purpose is letting a human look at the FRACTURE
PROTOCOL visual identity in the engine — see docs/VISUAL_QUALITY.md for
the seven questions it is built to answer.

It is explicitly **not** the authored level system: no pacing model, no
section vocabulary, no difficulty contract, no ending. It is one
hardcoded list in `ShowcaseDirector.LAYOUT`, which the authored level
system replaces wholesale.

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

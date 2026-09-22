# BREAKLINE — Save System

100% local, 100% offline. No account, no cloud, no credentials.

## File

`user://breakline_save.json` (plain JSON, human-readable for easy debugging
during development). Written via `scripts/save/SaveManager.gd`.

## Format

```json
{
  "save_version": 1,
  "best_score": 0,
  "best_distance": 0.0,
  "best_combo": 0,
  "total_coins": 0,
  "total_runs": 0,
  "unlocked_levels": ["level_01"],
  "unlocked_skins": ["default"],
  "equipped_skin": "default",
  "achievements": [],
  "settings": {}
}
```

## Versioning & migration

`SAVE_VERSION` is a constant in `SaveManager.gd`. `_migrate()` merges
whatever was loaded on top of a fresh default dict (so new fields added in
a later version always exist) and stamps the current version onto it. When
a real format change is needed later (e.g. restructuring `inventory`),
add an `if version < N: ...transform merged...` branch inside `_migrate()`
— the load path already routes every save through it.

## Corruption handling

If the file is missing, unreadable, or doesn't parse to a JSON object,
`SaveManager` logs a warning and falls back to defaults rather than
crashing or refusing to launch. The game is always playable even with a
corrupted or deleted save.

## What's intentionally not here yet

Cloud save / Supabase sync is Phase 8 work (see ROADMAP.md and BACKEND.md).
The local format above is designed be a straightforward mapping to a future
`player_progress` / `inventory` table, not a replacement for one.

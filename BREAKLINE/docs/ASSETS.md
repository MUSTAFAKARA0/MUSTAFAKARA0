# BREAKLINE — Asset Strategy

## Rule

No copyrighted models, textures, sounds, music, logos, or fonts. Prefer
procedural, original, CC0, or properly licensed assets. Placeholders are
fine as long as swapping them in later doesn't require touching gameplay
code.

## Current state

Everything visual in the vertical slice is procedural primitives + code
generated materials (see ART_DIRECTION.md) — there is nothing to license
because nothing was imported.

Audio is **not present yet**. `AudioManager.play_sfx("glass_shatter")` /
`play_music("glass_district_theme")` etc. look up
`res://assets/audio/sfx/<name>.{ogg,wav,mp3}` and
`res://assets/audio/music/<name>.{ogg,wav,mp3}` via `ResourceLoader.exists()`
and silently no-op (with a one-time console log) if the file isn't there
yet. This means:

- The game is fully playable, testable, and feels complete in every system
  *except* sound, with zero missing-resource errors.
- Dropping in real files at those paths with those exact names is the only
  step needed to add audio — no script changes.

Expected SFX names (see GAMEPLAY.md / section 43 of the design brief):
`projectile_fire`, `target_hit`, `glass_shatter`, `combo_break`,
`obstacle_collision`, `button_click`. Expected music: `main_menu_theme`,
`glass_district_theme`.

## Folder layout

```
assets/
 ├── models/        (empty — no imported meshes yet)
 ├── materials/      (empty — materials are built in code today)
 ├── textures/
 ├── environments/
 ├── targets/
 ├── obstacles/
 ├── projectiles/
 ├── particles/
 ├── audio/
 │   ├── sfx/
 │   └── music/
 ├── ui/
 └── fonts/
```

Folders exist even though empty so the intended home for each asset type is
unambiguous once real art/audio arrives.

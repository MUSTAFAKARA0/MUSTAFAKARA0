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

### Audio

`AudioManager.play_sfx("glass_shatter")` / `play_music("glass_district_theme")`
etc. look up `res://assets/audio/sfx/<name>.{ogg,wav,mp3}` and
`res://assets/audio/music/<name>.{ogg,wav,mp3}` via `ResourceLoader.exists()`
and silently no-op (with a one-time console log) if the file isn't there —
so a missing clip never blocks gameplay or throws.

**SFX are now populated** with original, procedurally-synthesized 16-bit
WAV placeholders (`tools/audio/generate_sfx.py` — pure Python stdlib sine/
noise synthesis, no samples, no licensing concerns of any kind). The 12
clips: `projectile_fire`, `target_hit`, `glass_crack`, `glass_shatter`,
`combo_up`, `perfect_hit`, `obstacle_warning`, `obstacle_collision`,
`game_over`, `button_click`, `level_complete`, `reward`. All but the last
two are wired into real gameplay triggers (see GAMEPLAY.md). `level_complete`
and `reward` are generated and ready, but nothing in the current endless-
runner vertical slice has a "level complete" or standalone "reward" moment
yet to trigger them — they're reserved for Phase 3+ content.

Re-tune any clip by editing the synthesis functions in
`tools/audio/generate_sfx.py` and re-running it; it overwrites the WAVs in
place.

**Music is still absent.** `main_menu_theme` and `glass_district_theme` are
referenced but no file exists at those paths yet — `AudioManager` degrades
gracefully exactly as it does for any missing clip. Synthesizing a
convincing ambient loop from stdlib primitives is a much bigger job than
short SFX blips; this is honestly left as a real remaining gap rather than
shipped as a crude filler loop.

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

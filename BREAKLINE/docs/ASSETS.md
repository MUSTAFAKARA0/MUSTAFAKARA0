# BREAKLINE — Asset Strategy

## Rule

No copyrighted models, textures, sounds, music, logos, or fonts. Prefer
procedural, original, CC0, or properly licensed assets. Placeholders are
fine as long as swapping them in later doesn't require touching gameplay
code.

## Current state

Everything visual in the vertical slice is built from Godot primitives
(BoxMesh/CylinderMesh/PrismMesh/SphereMesh) + code-generated materials —
see docs/ART_DIRECTION.md for the FRACTURE PROTOCOL identity this now
implements, and docs/VISUAL_QUALITY.md for an honest read on where that
still falls short of "premium" (short version: real geometry and
materials, genuinely differentiated shapes, but no textures anywhere yet
— see "Where real asset work would help most" below). There is nothing
to license because nothing was imported.

### Audio

`AudioManager.play_sfx("glass_shatter")` / `play_music("glass_district_theme")`
etc. look up `res://assets/audio/sfx/<name>.{ogg,wav,mp3}` and
`res://assets/audio/music/<name>.{ogg,wav,mp3}` via `ResourceLoader.exists()`
and silently no-op (with a one-time console log) if the file isn't there —
so a missing clip never blocks gameplay or throws.

**SFX are populated** with original, procedurally-synthesized 16-bit WAV
placeholders (`tools/audio/generate_sfx.py` — pure Python stdlib sine/
noise synthesis, no samples, no licensing concerns of any kind). 13
clips exist: `projectile_fire`, `target_hit`, `glass_crack`,
`glass_shatter`, `combo_up`, `combo_break`, `perfect_hit`,
`obstacle_warning`, `obstacle_collision`, `game_over`, `button_click`,
`level_complete`, `reward`. All but the last two are wired into real
gameplay triggers (see docs/GAMEPLAY.md, docs/TARGETS.md). `level_complete`
and `reward` are generated and ready, but nothing in the current endless-
runner vertical slice has a "level complete" or standalone "reward" moment
yet to trigger them — they're reserved for Phase 4+ content.

Re-tune any clip by editing the synthesis functions in
`tools/audio/generate_sfx.py` and re-running it; it overwrites the WAVs in
place.

**Music is still absent.** `main_menu_theme` and `glass_district_theme` are
referenced but no file exists at those paths yet — `AudioManager` degrades
gracefully exactly as it does for any missing clip. Synthesizing a
convincing ambient loop from stdlib primitives is a much bigger job than
short SFX blips; this is honestly left as a real remaining gap rather than
shipped as a crude filler loop.

## Where real asset work would help most (honest priority order)

This is not "Claude yaptı yeter" — it's a real recommendation of where
procedural geometry stops being enough:

1. **Textures for structural materials** (metal/concrete in
   `EnvironmentBuilder`) — the single biggest ceiling on "premium" per
   docs/VISUAL_QUALITY.md. A small tileable noise/grime/scratch texture
   set (CC0 or self-generated) would fix the "flat plastic" look more
   than any further procedural cleverness. Keep resolution modest
   (256-512px) for mobile texture memory.
2. **A real font pairing + small icon set for UI** — cheap, very visible,
   not done yet (still the engine default theme).
3. **A small modeled environment trim kit** (beam profiles, pipe joints,
   catwalk railings) if the procedural composition in
   `EnvironmentBuilder` still reads as primitive after the texture pass
   above — a lightweight Blender kit (10-20 pieces, <500 tris each,
   shared material) exported as glTF, not a full hand-built level.
4. **Target/projectile geometry** (Containment Shard cluster, Kinetic
   Dart) is the lowest priority for outsourcing — procedural composition
   already gives them a genuinely different silhouette from what they
   replaced; escalate to modeled geometry only if a texture/shader pass
   on the current primitives still isn't enough.
5. **Particle sprite textures** (a soft glow, a spark) for `VFXManager`'s
   bursts — currently solid-color `BoxMesh` particles. A couple of small
   (64x64) self-made or CC0 sprites would meaningfully lift VFX quality
   for near-zero performance cost.

No baked lighting is recommended at this scale/style — real-time
emissive-driven lighting is the correct, cheaper choice (docs/PERFORMANCE.md).

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

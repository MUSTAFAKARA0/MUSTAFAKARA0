# BREAKLINE — Asset Strategy

## Rule

No copyrighted models, textures, sounds, music, logos, or fonts. Prefer
procedural, original, CC0, or properly licensed assets. Placeholders are
fine as long as swapping them in later doesn't require touching gameplay
code.

## Current state

Everything visual is built from Godot primitives
(BoxMesh/CylinderMesh/PrismMesh/SphereMesh) plus a five-material quality
set: two `StandardMaterial3D`s carrying **engine-generated**
`FastNoiseLite` roughness/normal maps, and three custom `.gdshader`
spatial shaders (containment crystal, energy surface, hazard stripe).
See docs/MATERIALS.md for what each is and why it is built the way it
is, docs/ART_DIRECTION.md for the FRACTURE PROTOCOL identity, and
docs/VISUAL_QUALITY.md for an honest read on where it still falls short.

**There are still no image files in the repository.** The noise maps are
generated at import time from a few lines of `.tres`. There is nothing
to license because nothing was imported — that remains true after the
texture pass, which is the main reason the noise route was chosen over
sourcing CC0 texture sets.

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

1. **Authored grime/wear maps for structural materials** — procedural
   noise now gives the beams and floor *surface variation*, which was
   the flat-plastic problem. What noise cannot give is **intent**: rust
   running down from a bolt, scorching around a conduit, wear
   concentrated where a catwalk meets a beam. A small tileable set
   (CC0 or self-made, 256-512px, 3-4 maps) is where the next real jump
   is — but only after someone has looked at the noise version on a
   screen and confirmed it is the limiting factor.
2. **A real font pairing + small icon set for UI** — cheap, very visible,
   and now the single most obvious remaining "this is a prototype"
   signal. See docs/UI_DIRECTION.md for the selection criteria and the
   full list of what the theme pass must deliver.
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
 ├── models/         (empty — no imported meshes yet)
 ├── materials/      5 quality-set materials + crystal_fragment
 │   └── shaders/    4 .gdshader files
 ├── textures/       (empty — noise maps are generated in-engine)
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

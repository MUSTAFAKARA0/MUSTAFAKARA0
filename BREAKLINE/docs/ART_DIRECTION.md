# BREAKLINE — Art Direction: FRACTURE PROTOCOL

**Status: adopted and implemented in World 1 (Glass District facility) as
of this pass. Treated as validated-in-a-real-Godot-prototype, not a
finalized/locked art bible** — see docs/VISUAL_QUALITY.md for the honest
self-check on where it still falls short of "premium."

## Why this exists

An earlier pass built the vertical slice with a symmetric corridor of
glowing buildings, flat rectangular glass targets, and a glowing orb
projectile. On review, that combination read as too close to Smash Hit's
specific visual fingerprint (flat glass panes + ball + explode-and-fall
shatter + symmetric hallway) rather than to the genre in general. FRACTURE
PROTOCOL is the replacement identity, designed to keep only the generic
"first-person, continuous forward motion, aim and destroy" premise and
differentiate everything else.

## Primary identity — FRACTURE PROTOCOL

You are not touring a decorative glass city. You are cutting a path
through a failing, quarantined industrial facility with precision kinetic
strikes. The world is a real place with structure (beams, catwalks,
pipes, shafts) that happens to be full of unstable containment crystals,
not a hallway built out of glass for its own sake. This gives the core
loop ("shoot forward while flying forward") a diegetic reason to exist
that Smash Hit's dreamlike abstraction deliberately never bothered with.

## Secondary identity — Signal Bloom

The anomaly/energy layer on top of the grounded industrial base: cyan
interaction light, rare magenta "the containment is failing" cracks,
flickering holographic tells on unstable objects. This is the "beauty
layer," kept deliberately sparse (see Color System below) so it reads as
meaningful rather than as blanket neon wallpaper.

## Environment language

Asymmetric, not a mirrored hallway. Implemented in
`scripts/levels/EnvironmentBuilder.gd`:

- **Left wall**: dense — a structural beam every segment, cyan trim on
  every third, three long pipes running the wall's length (one is the
  emissive "energy conduit").
- **Right wall**: sparse — a shorter beam only every third segment,
  leaving gaps ("partial openings") onto dim background structures.
- **Catwalks** cross overhead at intervals, well above lane height.
- **Vertical shafts** sit further back for background depth.
- **Anomaly cracks**: exactly 6 fixed instances across the whole track,
  not per-segment — sparse on purpose.

## Material language

Three families, only the first two implemented in World 1 today (see
docs/MATERIALS.md for the extensible system):

1. **Structural Metal/Concrete** — matte, dark, desaturated
   (`_structural_material`/`_structural_variant_material`/
   `_pipe_material`/`_catwalk_material` in EnvironmentBuilder). The
   grounded base; never emissive.
2. **Energy/Anomaly** — emissive cyan (trim, conduit, lane markers) and
   magenta (anomaly cracks). Kept at roughly a third of the brightness of
   any gameplay-relevant emissive element (see Color System) so it never
   competes with what the player needs to read.
3. **Containment Crystal** — the target substance itself
   (`MaterialProfile` resources, `docs/MATERIALS.md`). Translucent,
   faceted, with a distinctly brighter core.

## Lighting language

One directional "facility" light, deliberately dim (`light_energy = 0.55`
in Level01.tscn, down from an earlier 0.9) plus low ambient
(`ambient_light_energy = 0.35`) so emissive gameplay elements pop hard
against a near-black structural base. No baked lighting — real-time
emissive-driven lighting is the right (and cheaper) choice at this scale;
see docs/PERFORMANCE.md.

## Color system

Three accents, disciplined on purpose (this directly answers the earlier
audit finding that everything glowed the same cyan):

| Accent | Meaning | Where |
|---|---|---|
| Cyan (~200°) | "safe / normal interaction" | targets' base glass, projectile, HUD score/combo, lane markers, structural trim |
| Warm orange | "danger" | obstacle warning stripes |
| Magenta | "anomaly / unusual" | rare environment cracks, the Unstable Signal (fake target) material |
| Gold | "reward" only | coins, nothing else |

Gameplay-critical emissive brightness (target core ~3.0, obstacle stripe
pulses up to ~3.0, projectile ~5.0) is always higher than decorative
emissive brightness (trim/conduit/anomaly cracks ~0.9-1.3) — a player
should never have to work out whether a glow is a hazard, a target, or
wallpaper.

## VFX language

Impact = flash + directional particle burst + fracture-and-dissolve (see
docs/PHYSICS.md), not omnidirectional confetti. A precision hit gets a
brighter flash, a stronger camera shake, and a brief hit-pause; a normal
hit does not — see docs/GAMEPLAY.md's game-feel section.

## UI language

Not redesigned with custom typography/iconography yet (still the engine's
default theme) — see docs/VISUAL_QUALITY.md and docs/ASSETS.md for why
that's an honest, called-out gap rather than something claimed as done.
Colors were updated to the three-accent system (HUD score/combo now read
cyan, coins stay gold).

## Target design language

"Containment Shard" — an asymmetric faceted cluster (5 primitive facets
at varied rotation/scale, `scenes/targets/GlassTarget.tscn`) with a
visible glowing core as the actual weak point (see docs/TARGETS.md for
the precision-hit mechanic this enables). A fake target is told apart by
three independent, simultaneous signals — never color alone: the
Unstable Signal material's warm-red palette, an irregular jittered facet
silhouette, and a flickering (not steady) core.

## Projectile design

"Kinetic Dart" (`scenes/projectiles/KineticDart.tscn`) — an oriented,
finned dart instead of a glowing orb. Fins visibly unfold on launch. Trail
is a thin directional streak, not a soft blob.

## Obstacle design

Not a flat red box — a section of the facility's own infrastructure
failing on you: a dark metal beam with pulsing warning stripes
(`scenes/obstacles/ObstacleWall.tscn`), scaling in over ~0.3s when it
spawns rather than appearing at full presence instantly.

## Destruction language

See docs/PHYSICS.md for the mechanics. Visually: impact flash → facets
hide, pooled shard fragments burst outward → shards get pulled back
toward the impact point while fading out ("energy drain"), never settling
on the ground. Distinct from "explode into cubes and fall," which was the
main Smash-Hit-adjacent read being replaced.

## Camera language

Unchanged from the earlier pass (already validated as distinct): subtle
forward-speed bob, recoil on fire, FOV creep with speed, bank into turns.
Added this pass: a brief, safe hit-pause reserved for precision hits only
(`VFXManager.request_hit_pause`).

## What's still honestly unfinished

See docs/VISUAL_QUALITY.md for the full self-critique. Short version:
everything above is real Godot geometry/materials/lighting, not a mockup
— but it is still primitive-composition, not modeled/textured assets.
Whether that reads as "premium" on a real screen is unverified (no Godot
runtime in this environment) and is exactly what Phase 5 (real asset
quality, after this prototype is validated on-device) exists to address.

# BREAKLINE — Visual Quality Self-Check

This doc exists because of an explicit rule from project review: **don't
mark something "premium" if you're not sure it reads that way.** It's a
running honest checklist, not a victory lap. Update it every time a
visual system changes.

## What changed this pass (Fracture Protocol adoption)

| Area | Before | Now | Confidence it reads as intended |
|---|---|---|---|
| Target | Flat rectangular glass panel | Asymmetric 5-facet cluster + glowing core | **Medium.** Built from combined primitives (BoxMesh/PrismMesh), not modeled geometry -- the silhouette is genuinely different from a flat panel, but up close it will still read as "primitives," not "sculpted crystal." |
| Projectile | Glowing orb | Finned kinetic dart, oriented, unfolds on launch | **Medium-high.** The shape and launch tell are real differentiators; still built from CylinderMesh/BoxMesh, no custom modeling. |
| Destruction | Explode into cubes, fall, freeze | Outward burst → inward pull → fade to nothing | **Medium.** The *mechanic* is implemented and physically driven (real impulse, real Tween fade) -- whether the timing (0.16s out / 0.32s dissolve) actually reads as "energy drain" rather than "shards vanish weirdly fast" is unverified without a real device/eyes on it. |
| Environment | Symmetric glowing-building corridor | Asymmetric structural walls, pipes, catwalks, shafts, sparse anomaly accents | **Medium.** Structurally a real improvement (asymmetry, verticality, a brightness hierarchy), but every piece is still a primitive box/cylinder with a flat color -- no texture, no baked detail, no wear. This is the single area most likely to still look "primitive-Godot-prototype" rather than "premium" on an actual screen. |
| Obstacle | Flat red box | Dark beam with pulsing warning stripes, spawn telegraph | **Medium-high.** Small but real -- distinct silhouette, motion read. |
| Lighting | Brighter ambient/directional, symmetric | Dimmer ambient/directional, three-accent color discipline | **Medium.** The theory (dark base + selective emissive = premium contrast) is sound and is how a lot of real stylized sci-fi games achieve their look cheaply -- but it's unverified whether the current brightness numbers are actually tuned well versus just "different from before." |
| UI | Default engine theme | Same, colors only adjusted to 3-accent system | **Low.** This is the most honestly unfinished area -- see below. |

## What's still genuinely a gap (not claimed as solved)

- **No texture anywhere.** Every material in the game is a flat
  `StandardMaterial3D` color + emission, zero images. This is the
  single biggest ceiling on "premium" per the original audit, and it's
  still true after this pass. Fixing it needs either real texture work
  (noise/grime/scratch maps -- see docs/ASSETS.md) or accepting a
  "clean minimal sci-fi" aesthetic as the deliberate final look rather
  than an interim placeholder. That's a decision for whoever reviews
  this on a real screen, not something to declare resolved from code.
- **UI typography/iconography** is still the engine default theme. Colors
  changed; the actual *feel* (font pairing, panel shapes, icons) the art
  direction calls for did not.
- **No lightmap/GI, no post-processing beyond glow.** Deliberate for
  performance (see docs/PERFORMANCE.md) but worth stating plainly rather
  than letting "dark + emissive" imply more visual sophistication than
  is actually there.
- **Everything here was built and reasoned about without a Godot
  runtime available in this environment.** No screenshot, no render, no
  device photo backs up any claim in this document. Every "reads as X"
  statement above is a design judgment, not an observation. Treat this
  whole pass as **an implemented, testable hypothesis**, not a verified
  result, until someone opens it in the real editor.

## The actual test

Per project direction: this is validated by opening the project in a
real Godot editor and looking at it, not by more written description.
Nothing in this document should be read as "visual quality: done."

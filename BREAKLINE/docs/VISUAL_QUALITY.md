# BREAKLINE — Visual Quality Self-Check

This doc exists because of an explicit rule from project review: **don't
mark something "premium" if you're not sure it reads that way.** It's a
running honest checklist, not a victory lap. Update it every time a
visual system changes.

**Nothing in this document has been seen running.** Godot cannot be
executed in the environment this was built in — no editor, no render, no
screenshot, no frame counter. Every "reads as X" below is a design
judgement. The showcase section (`scenes/levels/ShowcaseSection.tscn`)
exists precisely so a human can replace those judgements with
observations.

---

## Pass 2 — Visual Quality Gate (materials, targets, dart, destruction)

| Area | Before this pass | Now | Confidence |
|---|---|---|---|
| Surface detail | Flat colour on every surface in the game | Noise-driven roughness + normal maps (engine-generated) on near-field structure; custom shaders for crystal, energy and hazard surfaces | **Medium.** Real surface variation exists now and costs no image files. Whether the noise frequency/strength is *tuned* — vs. merely present — is unverified. |
| Target silhouette | 5 primitives, one shared flat translucent material | Same 5 primitives, fresnel rim shader with depth prepass; fake targets additionally stretched to a distinct spiky profile | **Medium-high** for the rim read (it is the standard technique for exactly this problem), **medium** for whether 5 primitives ever stop reading as primitives. |
| Core readability | Emissive `StandardMaterial3D`, energy up to 3.0 | Opaque unshaded core, gain clamped to ~1.9×, sits behind translucent facets | **Medium.** The clamp was added because the previous value would blow the core out into a white blob that eats the facets. Unverified whether 1.9 is the right ceiling. |
| Fake-target tell | Colour + core flicker | Colour + core flicker + **silhouette** (stretched, jittered facets) + **material behaviour** (harder, tighter rim, rougher surface) | **Medium-high.** Three independent tells, one of which survives colour-blindness and distance. |
| Projectile | ~0.48m, fully emissive in every part | ~0.78m, dark metal shell + bright energy band + bright fin cross; band pulses, fin cross rolls in flight | **Medium-high.** Dark shell + lit accents is what keeps the pointed shape from collapsing into a blob at speed; the old all-emissive version was the orb problem in dart clothing. |
| Destruction | flash → fragments → burst, all at once | IMPACT (flash, capped) → FRACTURE (fragments) → **CORE REACTION** (new additive flare at the core, ~0.22s) → fragment response → inward pull → dissolve (single `fade` uniform) | **Medium.** The beats are now ordered and separated in code. Whether they separate *perceptually* at 6 m/s is the main thing the showcase is for. |
| Brightness | Impact flash uncapped (up to ~4.8), burst 24 particles, dart emission 5.0 | Flash capped at 3.2, burst 18, dart accents ~2.2-equivalent, core flare peaks at 0.7 alpha additive | **Medium.** Deliberately turned *down*. Everything was competing with everything. |
| Obstacle | 3 meshes, shared stripe material (all obstacles pulsed in lockstep) | 1 mesh, shader stripes, per-instance material | **High** on the bug; **medium** on the look. |
| Environment materials | 9 code-built flat materials | Same 9 slots, now backed by the quality set; background boxes made opaque (removed the worst overdraw source in the scene) | **Medium.** |
| UI | Default engine theme, cyan-leaning palette | Default engine theme still, but: crosshair moved off pure white into palette cyan over a dark backing, all labels outlined, combo moved from gameplay-cyan to reward-gold | **Low-medium.** The *conflicts* with the art direction are fixed. The theme itself is untouched — see `docs/UI_DIRECTION.md`. |

## What is still genuinely a gap

- **No authored level.** Pacing is still RNG-driven in Level01. The
  showcase section is a hardcoded list, explicitly *not* the authored
  level system.
- **No music.** SFX are original and generated; music is absent.
- **UI is still the default Godot theme.** No typeface, no theme
  resource, no safe-area handling. `docs/UI_DIRECTION.md` records what
  the real pass must deliver.
- **Geometry is still all engine primitives.** Boxes, prisms, cylinders,
  spheres. Shaders and noise now give them *surface*, but nothing in the
  game is modelled. Whether that reads as deliberate stylisation or as
  "prototype" is the judgement call a human has to make on a screen.
- **No lightmap/GI, no post-processing beyond glow.** Deliberate for
  mobile (see `docs/PERFORMANCE.md`), stated plainly here so "dark +
  emissive" doesn't imply more sophistication than exists.
- **No device measurement of any kind.** No FPS, no draw-call count, no
  thermal behaviour. The performance reasoning in `docs/PERFORMANCE.md`
  is static analysis only.

## The actual test

Open `scenes/levels/ShowcaseSection.tscn` in a real Godot editor and run
it. Seven beats, ~200m, 6 m/s. The questions it is built to answer:

1. Does a Containment Shard read as **shootable** in under a second?
2. Does the **core** read as the thing that matters?
3. Is the **fake** target distinguishable without relying on colour?
4. Is the Kinetic Dart obviously **not an orb** at first glance?
5. Do the six destruction beats read as a **sequence**, or as one flash?
6. Does the structural world stay **dark** while gameplay stays bright?
7. Is anything **too bright**?

Nothing in this document should be read as "visual quality: done."

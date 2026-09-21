# BREAKLINE — Game Design

**Slogan:** BREAK. AIM. SURVIVE.
**Genre:** 3D first-person aim & shoot, endless runner, destruction, hybrid casual.

## Pillars, in priority order

1. **Fun** — does tapping to shatter glass feel good in the first 10 seconds?
2. **Game feel** — every hit reads as visual + audio + haptic + camera feedback.
3. **Performance** — smooth on mid-range Android.
4. **Visual quality** — premium stylized sci-fi, never "cheap mobile game."
5. **Content, progression, online, monetization, release** — in that order, and
   strictly *after* the above four are solid. See ROADMAP.md.

## The loop

Open game → Main Menu → Play → auto-forward through a 3D corridor → drag to aim
/ tap to shoot → shatter glass targets → build combo → dodge obstacles → get
hit or run ends → Game Over screen with stats → Retry or Home.

## Player fantasy

No visible avatar. First-person only. The player *feels* like the shooter
through camera bob/shake/recoil/FOV, not through a character model.

## World 1 — Glass District (art direction: FRACTURE PROTOCOL)

A failing, quarantined industrial containment facility, not a decorative
glass city — see docs/ART_DIRECTION.md for why this replaced an earlier,
too-Smash-Hit-adjacent "glowing skyscraper corridor" version. Asymmetric
structural walls, pipes, catwalks, and vertical shafts on a dark
desaturated base, with sparse cyan/magenta energy accents. This is the
only world built for the vertical slice; Worlds 2+ are documented as
future scope in ROADMAP.md, to be evaluated against the same identity
rather than a re-texture of World 1.

## Target types (docs/TARGETS.md has the technical contract)

Destructible objects are "Containment Shards" — asymmetric faceted
clusters with a glowing weak-point core (docs/ART_DIRECTION.md), not flat
glass panels. Implemented now: **Normal** (score), **Fake** (an Unstable
Signal decoy — breaks combo, no score, told apart by color + silhouette +
flickering core, never color alone), **Moving** (drifts side to side).
Behavior (what kind of target) and material (what it's made of,
docs/MATERIALS.md) are independent axes — new archetypes are additive,
see docs/TARGETS.md.

## Non-goals for the vertical slice

No Supabase, no Google login, no AdMob, no payments, no Play Console signing,
no Shop/Levels/Profile/Settings screens beyond what's needed to play once and
retry. These come in later phases — see ROADMAP.md — and are never required
to play BREAKLINE offline.

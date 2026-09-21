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

## World 1 — Glass District

Fütüristik cam şehir: translucent emissive skyscraper slabs lining a long
corridor, dark sky, cool blue/neon palette. This is the only world built for
the vertical slice; Worlds 2–5 (Industrial Core, Neon Void, Gravity Sector,
Collapse) are documented as future scope in ROADMAP.md and are not stubbed
out with placeholder scenes.

## Target types (docs/GAMEPLAY.md has the technical contract)

Implemented now: **NORMAL** (score), **FAKE** (breaks combo, no score),
**MOVING** (slides side to side). ENERGY/MULTI/TIME/GOLD/SHIELD/COMBO cores
are designed to slot into the same `GlassTarget.take_hit()` contract without
touching `TargetManager`, but are not needed for the vertical slice to be fun.

## Non-goals for the vertical slice

No Supabase, no Google login, no AdMob, no payments, no Play Console signing,
no Shop/Levels/Profile/Settings screens beyond what's needed to play once and
retry. These come in later phases — see ROADMAP.md — and are never required
to play BREAKLINE offline.

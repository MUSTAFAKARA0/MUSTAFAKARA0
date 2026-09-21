# BREAKLINE — Backend (Phase 8 — NOT STARTED)

**Status: intentionally not implemented.** Per the project's #1 rule
("build the game first, connect it to the internet later"), BREAKLINE has
zero backend dependencies today. This document exists so the intended shape
is written down before it's needed — it is not a request for credentials.

## What ships before this phase

Everything in ARCHITECTURE.md / GAMEPLAY.md / LEVELS.md / SAVE_SYSTEM.md —
a fully playable, fully offline vertical slice.

## Planned backend: Supabase

When Phase 8 starts:

- **Auth**: Google OAuth + email login. Until then, no login screen exists;
  `MainMenu` has no account UI.
- **Cloud save**: sync of the same fields `SaveManager` already tracks
  locally (see SAVE_SYSTEM.md) — local save stays the source of truth
  offline, cloud is a backup/sync layer, not a requirement to play.
- **Leaderboard, daily challenge, achievements sync, analytics**: additive;
  local versions of daily-challenge/achievements can exist beforehand as
  Phase 5 (local) work and get a sync layer bolted on later without
  redesigning them.

## Explicit non-requirements right now

Supabase project/keys, Google Cloud OAuth client, service role keys,
AdMob IDs, Play Console access, and an Android signing keystore are **not**
needed to build, run, or test the current game. They will be requested
explicitly only when Phase 8 (backend) / Phase 9 (monetization) / Phase 10
(release) actually begin — see ROADMAP.md.

## Design constraint carried over from now

`BackendManager`/`AuthManager` (see ROADMAP.md's modular systems list) must
stay decoupled from gameplay: gameplay code already only talks to
`SaveManager`/`ScoreManager`/etc., never to a hypothetical backend directly,
so wiring Supabase in later means adding a sync layer behind those
managers, not touching `PlayerController`, `TargetManager`, etc.

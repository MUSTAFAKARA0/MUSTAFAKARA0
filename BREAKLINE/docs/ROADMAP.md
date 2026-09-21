# BREAKLINE — Roadmap

Priority order, always: **Fun → Game Feel → Performance → Visual Quality →
Content → Progression → Online → Monetization → Release.**

## Phase 0 — Project Foundation ✅ done
Godot project, folder structure, autoloads, input wiring, architecture.

## Phase 1 — Core Gameplay ✅ done
First-person camera, forward movement, touch aim, projectile, target, hit
detection, glass destruction, combo, score, obstacles, collision, game
over, retry. This is the "vertical slice acceptance chain" in TESTING.md.

## Phase 2 — Vertical Slice Quality — in progress

Being executed as its own sub-cycle (architecture → visual prototype →
validation → authored level system → real asset quality → self-QA — see
each doc referenced below for the corresponding stage):

**Done:** original-audio SFX (docs/ASSETS.md), UI/transition polish, and
— this pass — a full art-direction adoption (**FRACTURE PROTOCOL**, see
docs/ART_DIRECTION.md) replacing the earlier too-Smash-Hit-adjacent
version: behavior/material architecture (docs/TARGETS.md,
docs/MATERIALS.md), a real asymmetric industrial environment
(docs/ART_DIRECTION.md, docs/PERFORMANCE.md), a redesigned target
("Containment Shard"), projectile ("Kinetic Dart"), destruction
("fracture-and-dissolve," docs/PHYSICS.md), obstacle presentation, and
precision-hit game feel (hit-pause, docs/GAMEPLAY.md).

**Not done:** real textures/fonts/icons (docs/ASSETS.md's priority list),
music, a Low/Medium/High graphics preset, and any of this validated on a
real Godot runtime or Android device — see docs/VISUAL_QUALITY.md's
explicit self-check.

## Phase 3 — Level System — partially done, pacing still not authored
`LevelData` resource + data-driven `LevelManager` exist (see LEVELS.md).
Only one level (`level_01.tres`). Target/obstacle spawning is a
difficulty-gated random roll, not the authored **Introduction → Learning
→ Combination → Pressure → Mastery → Climax** pacing product direction
calls for — see LEVELS.md's "Level design philosophy" section for the
honest gap and where the pattern system would plug in. This is the next
scheduled piece of Phase 2/3 work, after the art-direction adoption above
is validated on a real device.

## Phase 4 — World System — not started
Industrial Core, Neon Void, Gravity Sector, Collapse. Each needs its own
`EnvironmentBuilder`-equivalent script and `LevelData` entries.

## Phase 5 — Progression — not started
Coins are earned and saved (`SaveManager.total_coins`) but there's no Shop,
skins, achievements, profile, or daily challenge UI yet. Local-only when
built — no backend required for any of this.

## Phase 6 — Polish — not started
Animation/UI/VFX/sound polish pass, performance pass, loading/transition
polish, save reliability hardening — all after there's more content to
polish.

## Phase 7 — Android Testing — not started
Real device testing: touch feel, FPS, thermal, memory, battery, long
sessions, orientation, resolutions. See ANDROID.md.

## Phase 8 — Backend — not started
Supabase (auth, cloud save, profile, leaderboard, daily, sync, analytics).
See BACKEND.md, DATABASE.md, AUTH.md. **Do not start this phase without
explicit real credentials provided by the project owner at that time** —
nothing before this point requires them.

## Phase 9 — Monetization — not started
AdMob rewarded ads (optional, e.g. Second Chance / coin multiplier),
optional cosmetic purchases. Core gameplay must remain fully playable
without either.

## Phase 10 — Release — not started
Package name finalization, app icon, splash, signing/keystore, APK/AAB,
Play Store assets, privacy policy, terms, store description.

## Modular systems checklist (section 48 of the design brief)

Implemented: `GameManager`, `PlayerController`, `CameraController`,
`InputManager`, `ProjectileManager`, `TargetManager`, `ObstacleManager`,
`LevelManager`, `ComboManager`, `ScoreManager`, `SaveManager`,
`AudioManager`, `VFXManager`, `SettingsManager`, `FragmentManager` (added
beyond the original list — glass fragments needed their own pool, see
PERFORMANCE.md).

Not yet needed / not built: `WorldManager` (only one world exists),
`UIManager` (each screen currently owns its own logic; a coordinator isn't
justified yet with only 3 screens), `ShopManager`, `ProgressionManager`,
`AchievementManager`, `AnalyticsManager`, `AuthManager`, `BackendManager`
(all Phase 5+ / Phase 8 work).

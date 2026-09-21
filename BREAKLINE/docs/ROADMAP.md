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
Done: procedural Glass District environment, emissive glass materials,
particle bursts, camera shake/recoil/FOV feel, haptics, minimal polished
UI. **Not done:** real audio (see ASSETS.md), animation polish, loading
transitions.

## Phase 3 — Level System — partially done
`LevelData` resource + data-driven `LevelManager` exist (see LEVELS.md).
Only one level (`level_01.tres`). Procedural pattern system (beyond random
lane picking) is designed but not implemented.

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

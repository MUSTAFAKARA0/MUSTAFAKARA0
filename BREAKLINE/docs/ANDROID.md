# BREAKLINE — Android

## Target

Landscape-only, touch-only, single-finger playable. `project.godot` sets
`window/handheld/orientation="landscape"` and a mobile-tier renderer
(`renderer/rendering_method="mobile"`).

## Package name

Working package name: `com.breakline.game`. Not finalized — safe to change
at any point before Phase 10 (Release); nothing in gameplay code depends on
it.

## Signing / export

Not configured yet. No keystore, no Play Console access, no release build
has been produced. Debug builds during development use Godot's
auto-generated debug keystore — this requires no credentials from the user
and is the correct way to test on-device before Phase 10.

## Screen compatibility

`window/stretch/mode="canvas_items"` + `aspect="expand"` handles the common
16:9 / 18:9 / 19.5:9 aspect ratios. UI (`HUD`, `GameOverScreen`, `MainMenu`)
uses anchor-based layout (no fixed pixel positions relative to screen
corners) specifically so it adapts across those ratios; this hasn't been
device-tested yet (see TESTING.md — Phase 7 is still pending).

## Performance targets

See PERFORMANCE.md. FPS target is selectable (30/60) via
`SettingsManager.target_fps`, applied through `Engine.max_fps` — there is no
in-game Settings screen exposing this yet (deliberately not built until a
real Settings UI is needed elsewhere too).

## Phase 7 (on-device testing) — not started

Touch responsiveness, real FPS, thermal throttling, memory, battery, long
session stability, and orientation lock all need verification on physical
hardware before this is considered done.

# BREAKLINE — Android

This doc tracks exactly what's configured for Android today, what a
person opening the project in the Godot editor still needs to do by hand
(export presets are editor/version-specific and are deliberately **not**
hand-authored into this repo -- see "Export preset" below), and what can
only be verified on real hardware.

## Orientation & input

Landscape-only, touch-only, single-finger playable.
`project.godot` sets `window/handheld/orientation="landscape"` and
`window/energy_saving/keep_screen_on=true` (so the screen doesn't dim
mid-run). Touch input goes through `InputManager` (`_unhandled_input`,
handling `InputEventScreenTouch`/`InputEventScreenDrag` directly, with an
`InputEventMouseButton`/`MouseMotion` fallback for editor/desktop testing)
rather than the Godot InputMap, so it needs no action bindings configured
per-platform.

## Renderer & FPS configuration

- `renderer/rendering_method="mobile"` (and `.mobile="mobile"`) in
  `project.godot` -- the mobile-tier Forward+ renderer, not Compatibility
  or full Forward+.
- `SettingsManager.target_fps` (30 or 60) applies via `Engine.max_fps`.
  There's no Settings screen exposing this switch yet (see ROADMAP.md,
  Phase 5) -- it defaults to 60.
- There is currently only one visual quality level (no Low/Medium/High
  preset). See PERFORMANCE.md for what such a preset would need to touch
  (glow, MSAA, shadow atlas size) once there's a device to tune it against.

## Screen compatibility / safe area

`window/stretch/mode="canvas_items"` + `aspect="expand"` handles the
common 16:9 / 18:9 / 19.5:9 aspect ratios by keeping UI elements anchored
to screen edges/center rather than fixed pixel coordinates. Concretely:
`HUD` anchors score/combo to top-center, coins to top-right, crosshair to
dead-center; `MainMenu` and `GameOverScreen` center their content via
`CenterContainer`/anchor-centered panels. None of this has been checked
against an actual notch/cutout yet -- Godot's `"expand"` stretch mode
adds letterboxing-free extra width/height at unusual ratios but doesn't
know about notch-safe-area insets, so a real cutout device (Phase 7) is
the only way to confirm nothing critical (the crosshair, in particular)
ends up under a camera cutout in portrait-locked-to-landscape mode.

## App icon & boot splash

- `config/icon="res://icon.svg"` -- a simple original vector mark (not a
  final logo). Used for both the editor icon and, once exported, as the
  Android launcher icon source.
- `boot_splash/bg_color` is set to the game's dark background color and
  `boot_splash/fullsize`/`use_filter` are on, so the splash reads as an
  intentional dark screen rather than Godot's default light gray while
  the engine boots. No custom `boot_splash/image` is set yet -- that
  needs a real logo asset, which doesn't exist (see ART_DIRECTION.md).

## Package configuration

Working package name: `com.breakline.game`, set only when the Android
export preset is created (see below) -- nothing in `project.godot` or
gameplay code hardcodes it, so it's safe to finalize later.

## Export preset -- not included in this repo, on purpose

There is intentionally no `export_presets.cfg` checked in. That file's
schema is tied to the exact Godot version and installed export templates,
so a hand-written one risks being subtly wrong in a way nobody can catch
without the editor open. Instead, here's the exact one-time setup a
person with the Godot editor needs to do:

1. Install the Android build template matching the editor's version
   (Editor > Manage Export Templates), and point Godot at an Android SDK
   (Editor > Editor Settings > Export > Android) if not already configured.
2. Project > Export... > Add... > Android.
3. Package name: `com.breakline.game` (or whatever's been finalized by
   then). Orientation: landscape (should already follow the project
   setting, verify it isn't overridden).
4. **Permissions**: enable `VIBRATE` (haptics via `Input.vibrate_handheld`,
   used in `VFXManager.trigger_haptic()`). No other permission is needed
   for this vertical slice -- no network, no storage, no camera/mic.
5. For a debug/on-device test build, Godot's auto-generated debug keystore
   is enough (no credentials needed from anyone). A release keystore is
   Phase 10 (Release) work only -- see ROADMAP.md.
6. Export an `.apk` (debug) directly to a USB-connected device, or a
   `.aab` once Phase 10 needs a Play Console upload.

## Phase 7 (on-device testing) -- not started

Everything below needs real hardware and is not something a static
review or the editor's "remote deploy" preview can substitute for:

- Touch responsiveness / input latency (the tap-vs-drag thresholds in
  `InputManager` -- `TAP_MAX_DRAG`, `TAP_MAX_DURATION` -- were chosen by
  feel, not measured against a real touchscreen).
- Actual sustained FPS at 30 vs 60 target, and whether the fragment/
  projectile pool sizes (PERFORMANCE.md) hold up under a long, dense
  combo chain on a mid/low-end device.
- Thermal throttling over a long session (BREAKLINE has no session-length
  cap).
- Memory footprint (procedural meshes/materials only today, so this
  should be light, but unverified).
- Battery drain over a 10-15 minute session.
- Notch/cutout safe-area behavior (see "Screen compatibility" above).
- Different real aspect ratios beyond what the editor's device previews
  simulate.
- Haptics actually firing (`OS.get_name() == "Android"` gate in
  `VFXManager.trigger_haptic()` means this literally cannot be verified
  outside a real Android device or export).

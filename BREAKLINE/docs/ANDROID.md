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

---

## Verified headless build recipe (2026-09-22)

This produced a real, signed, installable debug APK from a clean Linux
container with **no Android Studio and no Google SDK download**. Every
step below was actually run, not written from memory.

**Why this matters:** `dl.google.com` is blocked by the egress policy in
the build environment, so `sdkmanager` cannot be used. The workaround is
that Godot's non-Gradle Android export only ever invokes two SDK
binaries — `zipalign` and `apksigner` — and Ubuntu ships both in
`universe` as genuine AOSP builds. A minimal SDK *layout* around them is
enough to satisfy Godot's path validation.

```bash
# 1. Engine (50 MB zip) — github.com is reachable
curl -sSL -o godot.zip \
  https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip
unzip -q godot.zip && mv Godot_v4.3-stable_linux.x86_64 /usr/local/bin/godot
chmod +x /usr/local/bin/godot

# 2. Export templates (1.0 GB .tpz — needs ~2 GB free during unpack)
curl -sSL -o templates.tpz \
  https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_export_templates.tpz
unzip -q templates.tpz -d tpl
mkdir -p ~/.local/share/godot/export_templates
mv tpl/templates ~/.local/share/godot/export_templates/4.3.stable

# 3. The only two Android SDK binaries Godot actually calls
apt-get install -y apksigner zipalign adb

# 4. Minimal SDK layout. Godot validates that platform-tools/,
#    build-tools/ and platforms/ exist under the SDK path; the version
#    number in build-tools/ is arbitrary.
SDK=/opt/android-sdk
mkdir -p $SDK/{platform-tools,build-tools/34.0.0,platforms/android-34,cmdline-tools/latest/bin}
ln -sf /usr/bin/apksigner $SDK/build-tools/34.0.0/apksigner
ln -sf /usr/bin/zipalign  $SDK/build-tools/34.0.0/zipalign
ln -sf /usr/bin/adb       $SDK/platform-tools/adb

# 5. Debug keystore (keytool ships with the JDK)
mkdir -p ~/.android
keytool -genkeypair -keystore ~/.android/debug.keystore \
  -storepass android -alias androiddebugkey -keypass android \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Android Debug,O=Android,C=US"

# 6. Editor settings (headless Godot reads this file)
mkdir -p ~/.config/godot
cat > ~/.config/godot/editor_settings-4.3.tres <<'SETTINGS'
[gd_resource type="EditorSettings" format=3]

[resource]
export/android/android_sdk_path = "/opt/android-sdk"
export/android/java_sdk_path = "/usr/lib/jvm/java-21-openjdk-amd64"
export/android/debug_keystore = "/root/.android/debug.keystore"
export/android/debug_keystore_user = "androiddebugkey"
export/android/debug_keystore_pass = "android"
SETTINGS

# 7. Import, then export
cd /path/to/BREAKLINE
godot --headless --import
mkdir -p build
godot --headless --export-debug "Android" build/breakline-debug.apk
```

### Result of the verified run

| | |
|---|---|
| Output | `build/breakline-debug.apk`, 24.6 MB |
| ABI | `arm64-v8a` only (see `export_presets.cfg`) |
| Signatures | v1 **and** v2 **and** v3 verified by `apksigner verify` |
| Contents | `lib/arm64-v8a/libgodot_android.so` (62.5 MB uncompressed) + 137 `assets/` entries |
| Install | `adb install -r build/breakline-debug.apk` |

### Gotchas this run actually hit

1. **`clamp()` / `lerp()` return Variant, and Godot 4.3 treats inferring
   a type from Variant as a hard compile error** (not a warning). Four
   sites blocked the import entirely. Always use the typed variants —
   `clampf`, `lerpf`, `maxf`, `minf` — in `var x := ...` position.
   Static reading of the code never caught these; only the real engine
   did.
2. **`--headless --import` is not optional.** Without it the export has
   no import cache and fails.
3. `export_presets.cfg` **is** committed (it carries no secrets).
   A *release* preset's keystore password must never be committed —
   pass it via `--export-release` with the credentials in editor
   settings or environment, not in the preset file.

### Not covered by this recipe

- **Release AAB for Play Store.** Needs a real upload keystore, which is
  explicitly out of scope until the release phase.
- **Custom Gradle build** (`gradle_build/use_gradle_build=true`). That
  path *does* need the real Android SDK with NDK and platform jars, so
  it is blocked in this environment.
- **Anything actually observed on a device.** This recipe proves the APK
  builds, is signed correctly, and that both `MainMenu.tscn` and
  `ShowcaseSection.tscn` run headless without a single script error. It
  proves nothing about how the game looks or performs.

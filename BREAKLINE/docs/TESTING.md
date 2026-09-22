# BREAKLINE — Testing

## Vertical slice acceptance chain (section 62 of the design brief)

The slice is only "done" when this chain runs uninterrupted:

```
Open game -> Main Menu -> Play -> 3D world -> auto-forward -> touch aim ->
shoot -> target hit -> glass shatter -> VFX -> SFX(*) -> combo -> obstacle ->
collision -> game over -> result -> retry
```

`(*)` SFX will silently no-op until real audio files are dropped in (see
ASSETS.md) — this does not block the chain from being considered complete,
since `AudioManager` is built to degrade gracefully.

## Manual test checklist (run this in the Godot editor / on-device)

- **First launch** — game opens to `MainMenu` without errors.
- **Movement** — player moves forward automatically and speeds up over time.
- **Aim** — dragging moves the reticle and produces a matching lane drift.
- **Projectile** — tapping fires toward the exact tap position (verify by
  tapping directly on a target from a few different screen positions).
- **Hit** — a hit target disappears and cannot be hit twice.
- **Fracture** — shatter spawns fragments that burst outward then visibly
  pull back toward the impact point and fade out (not fall and freeze),
  plus impact flash, particles, camera shake, haptic (on Android), and
  increments score/coins. See docs/PHYSICS.md.
- **Precision hit** — tapping near a target's glowing core (vs. its outer
  facets) produces a visibly bigger flash/shake, a brief hit-pause, and a
  score bonus; tapping off-center does not. See docs/TARGETS.md.
- **Fake target** — an Unstable Signal (warm-red, flickering-core,
  jittered-silhouette) target breaks combo and scores nothing when hit.
- **Combo** — consecutive hits raise the multiplier shown in the HUD; a
  miss/FAKE-hit/obstacle collision resets it to 0.
- **Score** — HUD score matches `base_points * multiplier` for each hit.
- **Obstacle** — colliding with a lane-blocking obstacle ends the run
  immediately; the other two lanes are always clear.
- **Game Over** — stats shown match the run (score, best, distance,
  accuracy, max combo, coins).
- **Retry** — reloads the level cleanly: score/combo/coins/distance reset to
  zero, spawners restart from a fresh pool.
- **Home** — returns to `MainMenu` without leftover state affecting the next
  run.
- **Save** — best score persists after Retry/Home and after fully closing
  and reopening the game.
- **Load** — a corrupted or hand-deleted save file doesn't crash the game
  (see SAVE_SYSTEM.md).

## Automated tests

None yet. If/when a test framework (e.g. GUT) is introduced, priority
targets are `ComboManager` (multiplier/timeout math), `ScoreManager`
(scoring math), and `SaveManager` (migration/corruption handling) since
they're pure logic with no scene dependencies.

## Phase 7 — Android device testing

Not started. See ANDROID.md.

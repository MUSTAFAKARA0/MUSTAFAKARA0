# UI DIRECTION — foundation

Status: **foundation only.** The in-game HUD has had a consistency pass
against the FRACTURE PROTOCOL art direction (see `scenes/ui/HUD.tscn`),
but BREAKLINE still runs on the **default Godot theme**. This document
records the decisions that pass was based on and what the real UI work
has to deliver, so that work does not restart from taste every time.

Nothing here has been verified on a device or at runtime.

---

## 1. Where the default Godot theme currently shows

These are the places a player would read as "engine default", not as a
game:

| Where | What gives it away |
|---|---|
| Every label in the game | Godot's bundled Open Sans. Neutral humanist sans — the single strongest "this is a prototype" signal in the build. |
| `MainMenu` buttons | Default `Button` StyleBox: grey rounded rect, default hover/pressed tints, default focus ring. Nothing about it belongs to a fracturing industrial facility. |
| `GameOverScreen` panel | Default `Panel` StyleBox — flat mid-grey, uniform corner radius, no material identity. |
| Focus outlines | Default focus rings appear on keyboard/controller focus; they are not part of any intended look. |
| Spacing | Every offset is a hand-typed pixel value. There is no scale, so nothing lines up by construction. |
| Safe area | Fixed pixel margins only. Landscape phones put cutouts and gesture bars exactly where the HUD's corner elements sit. |

## 2. Colour contract (shared with the 3D game)

The UI uses the **same** contract as the world. See
`docs/ART_DIRECTION.md`; repeated here because UI work is where it is
most often broken:

| Meaning | Colour | In the UI |
|---|---|---|
| Structural / neutral | dark desaturated blue-greys | panels, backgrounds, inactive text |
| Gameplay / actionable | cyan | score, crosshair, interactive highlights |
| Danger | warm orange | failure states, hazard warnings, destructive actions |
| Anomaly | magenta | rare/unusual events only — never decoration |
| Reward | gold | coins, combo, unlocks, best-score |

Rules that follow from it:
- **Combo is gold, not cyan.** Combo is a reward read. Giving it the
  gameplay cyan made it compete with the thing the player is aiming at.
- **White is not a colour in this game.** The crosshair used to be pure
  white; it now sits in palette cyan over a dark backing arm.
- Warm orange in UI means *this ends your run* or *this is destructive*.
  It is never a highlight colour.

## 3. Typography — what to pick

Not yet chosen. Requirements when it is:

- **Licence:** OFL/Apache/CC0 only, and the licence file ships in
  `assets/fonts/`. No system fonts, no foundry fonts, no "found it
  online".
- **Character:** technical/industrial grotesque or a squarish
  semi-condensed. Must have real numerals — the score is the single
  most-read element in the game.
- **Numerals:** tabular/lining, so a counting-up score does not jitter
  in width as digits change.
- **Weights:** two is enough (regular + bold). More is maintenance
  without payoff at phone size.
- **Coverage:** Latin + Turkish (ç ğ ı İ ö ş ü) from the start, since
  the game is being built in Turkish.
- **Hinting at size:** must stay legible at 24px on a 1080p phone, which
  rules out most display faces.

Until then: Godot's default font, with outlines carrying legibility.

## 4. Spacing scale

Adopt a 4px base unit; all margins, paddings and gaps are multiples:

```
xs  4    sm  8    md  16    lg  24    xl  40    2xl  64
```

Current HUD values (24 top margin, 44 right) are roughly on this scale
and should be snapped to it exactly when the theme lands.

**Safe area:** landscape Android needs a minimum 44px inset on the left
and right edges for cutouts and gesture navigation, on top of the
spacing scale. This is not implemented — `DisplayServer.
get_display_safe_area()` should drive a root margin container once the
theme exists.

## 5. Panel language

Panels should read as *facility interface plating*, not as generic
rounded cards:

- Square or minimally-rounded corners (0–4px). The default 8px+ radius
  is the wrong material.
- Dark translucent fill (structural blue-grey, ~0.85 alpha) so the world
  stays faintly visible behind — reinforces "this is an overlay on a
  place".
- A single **1px cyan edge on one side only** (top or left), not a full
  border. Asymmetric trim is the environment's language; symmetric
  borders are the default theme's.
- No drop shadows. Depth comes from the edge and the fill, as in the 3D.

## 6. Icon language

- Geometric, stroke-based, 2px at 24px, square caps — same construction
  logic as the facility's beams and trim.
- No filled/rounded "friendly" icon sets; they fight the material world.
- Coins currently use the text glyph `◆` as a placeholder (`HUD.gd`).
  This is a stand-in, not the icon.
- Icons are monochrome and take their meaning colour from §2.

## 7. Score

- Top-centre, largest element, tabular numerals.
- Counts up over ~0.35s rather than snapping (already implemented in
  `HUD.gd`) — a big multiplier hit should *feel* bigger without extra UI.
- Cyan, because score is the gameplay read.
- Never gets a panel behind it. The outline carries it.

## 8. Combo

- Directly under the score, smaller, gold (§2).
- Punches to 1.35× and settles over 0.22s on change (already in
  `HUD.gd`).
- Hidden entirely below 2×, so it is an event rather than a permanent
  widget.
- A combo **break** currently has audio only (`combo_break` SFX). The
  UI should eventually mark it — a single quick desaturate-and-drop of
  the combo label, not a new element.

## 9. Warning / danger states

Not implemented. When they are:

- Warm orange (§2), and only for run-ending things.
- Prefer an **edge** treatment (a brief vignette pulse at the screen
  edge on the side the hazard is on) over a centre-screen icon — the
  centre belongs to the crosshair and the shard.
- Must never flash at a rate that competes with the destruction
  sequence's own flash; hazard feedback is slower and duller than
  impact feedback on purpose.
- Pair every warning with its existing audio cue rather than adding new
  visual noise.

## 10. What the real UI pass must produce

1. A licensed font in `assets/fonts/` with its licence file.
2. One `Theme` resource in `assets/themes/` covering Label, Button,
   Panel, and focus, replacing every `theme_override_*` currently spread
   across the scenes.
3. A safe-area root container driven by the real display insets.
4. Replacement of the `◆` placeholder with a real coin icon.
5. A combo-break visual beat.
6. Verification at 16:9, 18:9, 19.5:9 and 20:9, in landscape, on a real
   device.

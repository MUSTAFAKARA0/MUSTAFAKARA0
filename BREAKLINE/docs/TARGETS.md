# BREAKLINE — Target System

## The abstraction

`scripts/targets/behaviors/TargetBehavior.gd` is a small strategy base
class (`RefCounted`, not a `Resource` -- it has no data to serialize,
only two virtual methods) deciding what KIND of target a `GlassTarget`
is: whether a hit scores (`on_hit`) and what it does every frame while
alive (`on_process`, e.g. movement). This is separate from
`MaterialProfile` (docs/MATERIALS.md), which decides what SUBSTANCE it's
made of. See docs/ARCHITECTURE.md's note on why these two axes are split.

Behaviors are **stateless and shared**: `TargetManager` constructs exactly
one instance of each (`_behavior_normal`, `_behavior_fake`,
`_behavior_moving`) in `_ready()` and hands the same reference to every
pooled target that needs it. Adding a new archetype costs one small
object for the whole level, not one per pooled target instance.

## Implemented today

| Behavior | `on_hit` | `on_process` | Paired material |
|---|---|---|---|
| `NormalTargetBehavior` | scores | — | Containment Glass |
| `MovingTargetBehavior` | scores | drifts side to side (two summed sine waves, randomized phase/speed per spawn — see `GlassTarget.advance_moving_motion`) | Containment Glass |
| `FakeTargetBehavior` | breaks combo, no score | flickers the core (`GlassTarget.update_flicker`) | Unstable Signal |

`TargetManager._spawn_at()` picks a `(behavior, material)` pair by a
difficulty-gated random roll — see docs/LEVELS.md for the exact
thresholds and the honest note that this is still RNG-driven, not
authored pacing.

## Telling a fake target apart — three independent signals

Per design review, color alone is not enough (a real accessibility and
readability gap). A fake target differs by:

1. **Material color** — Unstable Signal's warm red/orange vs.
   Containment Glass's cyan.
2. **Silhouette** — `GlassTarget.spawn_reset()` jitters each facet's
   rotation by up to ~9° when the behavior is fake, so the cluster looks
   subtly irregular even before color registers.
3. **Behavior** — the core visibly flickers (two uneven sine terms)
   instead of holding the steady glow a real target's core has.

## Precision hits

Every `GlassTarget` has a visible core (`$Core`) that is its actual weak
point. `take_hit()` checks the hit position against
`GlassTarget.PRECISION_RADIUS` (0.42 world units) around the core's world
position. A precision hit gets: a brighter impact flash, a stronger
camera shake, a brief hit-pause (`VFXManager.request_hit_pause`), the
`perfect_hit` SFX, and the score bonus already wired into
`ScoreManager.add_target_hit`'s `perfect` flag (previously a dead
parameter -- see docs/PERFORMANCE.md's earlier audit finding, now
resolved). This is the "aim for the center" skill-expression layer the
flat-panel design never had room for.

## Adding a new archetype later (armored, timed, chain, explosive, shielded, ...)

1. New file under `scripts/targets/behaviors/`, extending `TargetBehavior`.
   Example sketch for "armored" (needs 2 hits): the behavior would need
   its own small piece of per-target state (hit count), which doesn't fit
   the current fully-stateless design -- see the note below.
2. `TargetManager` constructs one shared instance and adds a weighted
   branch in `_spawn_at()`.
3. Pair it with whichever `MaterialProfile` makes sense -- a behavior and
   a material are chosen independently.

**Note on stateful behaviors:** the current three behaviors are
stateless by design (no per-instance data lives on the behavior object
itself -- anything that needs per-target state, like `move_time`, lives
on `GlassTarget`). A behavior like "armored" that needs to remember "how
many times has *this* target been hit" doesn't fit that pattern as
cleanly. The straightforward extension is for `GlassTarget` to own that
counter (the same way it owns `move_time` for `MovingTargetBehavior`) and
expose it to the behavior via a method, rather than making behaviors
stop being shared/stateless — this keeps the "one behavior instance per
level" performance property intact. This is documented rather than
built now because there's no second stateful archetype yet to validate
the pattern against.

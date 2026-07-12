# Notes Canvas — Fling-Focus Pass (content-aware pan settling)
Created: 2026-07-12
Status: COMPLETE (2026-07-12)
Follows: notes-canvas-feel-plan.md (COMPLETE)

## Outcome & deviations
- [x] All items shipped as planned: `projectDecay` + `chooseFocusTarget` (+12
  tests, 110 total), `fling(vx, vy, resolveTarget?)` with `withSpring`
  landings, canvas-view resolver wiring via the live ref. Checks clean.
- **Verified in-harness:** new bundle boots clean; selection via trusted
  click; a trusted drag-release ran pan → onEnd → resolver → decay branch
  with zero errors and an exact camera save. The `withSpring` branch is
  typechecked + geometry-unit-tested; its runtime execution and all feel
  aspects are the user's real-browser check (hidden-pane rAF suspension, as
  in the feel pass).
- **Deviation (F3) — harness truths (memory-recorded):** patching only
  `setPointerCapture` (the prior pass's synthetic-drag trick) corrupts RNGH's
  capture bookkeeping — the next REAL interaction crashes with an uncaught
  `releasePointerCapture` LogBox overlay; and even fully patched, untrusted
  PointerEvent streams no longer activate RNGH at all. Trusted CDP input
  only. Also: browser-pane tool coordinates are CSS×0.625, and hidden-page
  chained timers escalate to 1/min after ~5 min, so sleep-heavy in-page
  scripts overrun the 30s tool budget and leave stuck pointers — reload the
  page after any timed-out gesture script.

## Context

Feel-pass panning uses pure `withDecay` — physically fine but "slippery": the
camera rests wherever friction says, often leaving nearby images half-clipped
or just off-screen. User direction (2026-07-12): the camera should behave like
you're panning *to see content* — project where the release would naturally
land, and if an image is near that landing zone, retarget the settle onto it
with a spring (slight overshoot, then it comes back and frames the image).
Flings clearly aimed past everything keep pure decay.

Decisions (user-confirmed):
- **Focus target = minimal nudge**: correct just enough that the chosen image
  sits fully inside the viewport with a margin; an image already fully visible
  at the natural landing spot means zero correction (plain decay).
- **Engages on EVERY pan release**, not just fast flings. Zero-velocity
  release ⇒ projected landing = current camera; same math applies.
- **Correction cap ≈ half a viewport** per axis; beyond that, no retarget.
- Zoom is never changed by this — translation only.

## Approach

### 1. Pure math — `canvas-math.ts` (+ tests)
- `projectDecay(v)` — natural rest displacement of reanimated's decay curve
  (deceleration 0.998): `Δ ≈ v / (1000 · ln(1/d))`.
- `chooseFocusTarget(naturalCamera, viewport, itemRects)` → `Camera | null`:
  - Endpoint viewport in world space (screenToWorld of corners under the
    projected camera).
  - Candidates: items whose center falls within the endpoint viewport
    expanded by a search factor (~50%). Score by center distance to the
    endpoint viewport center; pick min.
  - Correction: minimal translation putting the candidate rect fully inside
    the viewport inset by a margin (~48px screen). Axis where the image is
    larger than the viewport ⇒ no correction on that axis.
  - Return null if no candidate or |correction| exceeds the cap
    (~0.5 · viewport per axis).

### 2. Camera — `use-camera.ts`
- `fling(vx, vy, resolveTarget?)`: compute the projected endpoint in JS, ask
  the resolver for a corrected camera. With a target:
  `tx/ty = withSpring(target, { velocity })` — initial velocity gives the
  carry-past-then-return feel. Without: today's `withDecay`. Existing
  cancel/interrupt plumbing (touch-down stops everything) unchanged.
- All feel constants (search factor, margin, cap, spring damping/stiffness)
  in one tunable block for fast iteration rounds.

### 3. Wiring — `canvas-view.tsx`
- Pan `onEnd` supplies a resolver built from the current items snapshot +
  measured viewport size. Runs once per release in JS — no per-frame cost.

### 4. Verify
- Unit tests: projection formula; candidate selection (near/far/empty,
  already-visible ⇒ null, oversized image, cap exceeded ⇒ null, zero
  velocity); minimal-nudge geometry per corner/axis.
- typecheck/lint/format + full `bun test src/`.
- In-pane: pipeline verification (resolver called with right inputs, spring
  targets set correctly). Frame-feel is user-verified in a real browser
  (document.hidden suspends rAF in the pane), then a constants tuning round.

## Risks
- Spring per-axis with differing velocities curves the path slightly —
  expected to read as natural; tune damping if it wobbles.
- "Every release" mode can feel magnetic while arranging the viewport
  precisely; the minimal-nudge rule + cap are the guardrails. If it fights,
  fallback knob: velocity threshold (constants block already supports it).

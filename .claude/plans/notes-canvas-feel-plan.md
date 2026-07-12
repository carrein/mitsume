# Notes Canvas — Motion & Feel Pass (reanimated)
Created: 2026-07-11 · Revised 2026-07-12: rebuilt on react-native-reanimated (user decision — use the installed canonical library, not hand-rolled physics)
Status: COMPLETE (2026-07-12)

## Outcome & deviations
- [x] All implementation items below shipped; 68 unit tests, typecheck/lint/format clean.
- **Verified in-harness:** full input pipeline (wheel/pinch handlers → camera api → shared values → exact-anchor reaction → animated styles; pinch measured mathematically exact, 0.675→1.502 = e^0.8); screen-space item rendering tracking the camera; selection/delete/ctrl+Z through the new architecture; paste; per-canvas viewport persistence (now saves zoom too).
- **Deviation (F1) — harness truth:** the verification browser pane runs with `document.hidden = true`, so Chrome suspends ALL requestAnimationFrame callbacks — time-based animations (withTiming/withDecay AND any hand-rolled rAF ticker) cannot progress there. Mid-diagnosis this masqueraded as a "reanimated web defect" and the motion was temporarily rewritten as a JS ticker; once the real cause surfaced, the LIBRARY primitives were restored (user directive: use the library). Animation start/targets/cancellation are verified; frame progression is library-internal and needs a visible browser — folded into the user's real-mouse feel check.
- **Deviation (F2):** synthetic (untrusted) PointerEvents stopped activating RNGH item gestures in this pass — trusted CDP input works (selection verified). Harness artifact; noted in memory.
Follows: notes-canvas-plan.md (V1, COMPLETE)

## Context

V1 interactions are functionally correct but stiff: the camera stops dead on
release, wheel ticks jump the zoom ~18% instantly, items snap live in 32px
jumps mid-drag. Decisions (user-confirmed): fling momentum for panning; damped
animated wheel zoom; free-follow items with a snapped ghost preview and an
ease-out settle on release. Foundation: **react-native-reanimated 4.3.1**
(already installed; research-verified web-supported + React-Compiler
compatible) — `withDecay` for momentum, `withTiming` for zoom glide; animated
styles mutate the DOM/UI thread directly, removing V1's per-frame React
re-renders of the camera.

## Approach

### A. Camera on shared values — `use-camera.ts` (components/notes/)
- `tx`, `ty`, `zoom` become shared values; the transform layer becomes an
  `Animated.View` with a `useAnimatedStyle` transform. Gestures keep
  `runOnJS(true)` (web-first; JS writes to shared values are legal) and mutate
  the values directly — pan/pinch stay 1:1.
- **Momentum:** pan `onEnd` → `tx/ty = withDecay({ velocity })`. Any
  pointer-down / wheel / pinch / item-gesture begin calls `cancelAnimation`
  on all three first.
- **Zoom glide (exact anchoring):** wheel ticks retarget
  `zoom = withTiming(clampedTarget, ~120ms ease-out)`; a
  `useAnimatedReaction` on zoom applies the camera invariant INCREMENTALLY
  per frame — `t = anchor − (anchor − t)·(z/zPrev)` — which is `zoomAtPoint`'s
  step form, so the cursor stays exactly fixed under any easing. Zoom
  buttons/reset glide the same way (anchor = viewport center); trackpad pinch
  stays direct.
- **Consumers of camera values:** paste + item-gesture math read `.value`
  imperatively in JS callbacks (replaces the live-ref zoom); viewport
  persistence via reaction → existing debounced save; ZoomControl % label via
  reaction → setState only when the rounded % changes.
- **Dot grid:** platform split. `dot-grid.web.tsx` — an Animated div whose
  CSS `radial-gradient` backgroundSize/backgroundPosition are animated styles
  (the research-noted approach; cheapest possible per-frame grid). Native
  keeps the SVG-pattern grid fed by a camera mirror state (reaction →
  setState — same cost native pays today; acceptable, native is secondary).

### A2. Cross-platform structure — screen-space items (user requirement 2026-07-12)
Interactions must work on desktop AND mobile. V1's transformed 0×0 anchor
container breaks Android structurally (Android doesn't deliver touches to
children outside parent bounds), so this pass REMOVES the transformed
container: every item (and the selection chrome/ghost) is positioned in
SCREEN space by its own `useAnimatedStyle` computing world→screen from the
camera shared values (`translate = world·zoom + t`, sized `w·zoom`). One
mechanism, native hit-testing on all platforms, and items ride the UI thread
during camera motion on Android. Corner handles gain touch-sized hit slop
(~24px effective). Scope decisions: NO touch delete/undo toolbar yet
(keyboard remains the only delete/undo — mobile edit completeness comes
later); verification stays web-only this pass, but no web-only architecture
is permitted anywhere in the design.

### B. Item motion — free-follow, ghost, settle
- `interactionRect` returns the UNSNAPPED rect mid-gesture (move: exact
  `item.x + dx`; resize: new `resizeRectFree` — exact width, aspect-locked
  height, fixed opposite corner). Commit on release stays SNAPPED
  (new `snapRect` = existing snap/resizeRect semantics) — doc data unchanged.
- **Ghost:** while interacting, a faint dashed outline (textSecondary,
  pointerEvents none) renders at the snapped rect between items and chrome.
- **Settle:** CSS transitions would fight the animated transforms, so the
  settle is reanimated too: one settle shared-value rect in canvas-view
  (only one item interacts at a time) — on release it `withTiming`s from the
  free rect to the snapped rect (~120ms ease-out), then interaction state
  clears and the item renders from committed doc values. Cross-platform by
  construction.

## Implementation
- [ ] `canvas-math.ts`: `resizeRectFree`, `snapRect` + tests (physics now comes from reanimated — none to hand-roll or test)
- [ ] `components/notes/use-camera.ts` (new): shared values, decay, glide reaction, cancel plumbing, persistence + %-label mirrors
- [ ] `canvas-view.tsx`: remove transformed anchor; screen-space Animated items/chrome/ghost; gestures → shared values; unsnapped `interactionRect`; snapped commit; settle shared-value rect
- [ ] `dot-grid.web.tsx` (new, animated gradient) + keep `dot-grid.tsx` (native SVG, mirrored camera)
- [ ] `canvas-item.tsx` + `selection-chrome.tsx`: per-item animated screen-space styles; handle hitSlop for touch
- [ ] Checks + tests; browser verification: fling glides + decays + interrupts cleanly; wheel glides anchored at cursor; buttons/reset glide; drag follows 1:1 with ghost; release settles; Yjs values still snapped; paste/delete/undo + calendar regression. (Android emulator verification deferred by user decision; the structure is native-ready.)

## Risks
- Reanimated/worklets interplay with React Compiler (officially compatible;
  project fallback precedent: 'use no memo' per component if a specific
  component misbehaves).
- Metro has no watchman on this machine — new files need a Metro restart
  before browser verification (known, in memory).
- Watch the "Yjs was already imported"-class dual-instance console warnings
  after adding reanimated imports to the canvas path (none expected — it's
  already bundled app-wide via gesture-handler root).

# Wheel Paging via wheel-gestures — Implementation Plan
Created: 2026-07-13
Status: COMPLETE (pending user trackpad tuning loop)

## Context

The month pager's web wheel path chain-skips months on real trackpad flicks.
Three rounds of hand-rolled heuristics (idle gaps → spike detection →
decay-streak gating) all failed; root cause confirmed: Chrome coalesces wheel
events under main-thread jank (deltas summed), defeating any per-event
magnitude/gap heuristic. User wants Apple Calendar behavior — one flick =
exactly one month — and approved (via /questions): adopt the `wheel-gestures`
npm package; keep mid-animation chaining (one more month per distinct flick);
tune feel via a try-and-report loop after landing.

## Research Summary

See wheel-paging-research.md. wheel-gestures@2.2.48 segments the wheel stream
into gestures with momentum classification via coalescing-tolerant velocity
ratios; re-flick during a momentum tail emits isMomentumCancel → new gesture.
Pattern from embla's plugin: act only during the finger phase, ignore the
whole momentum tail, one action per gesture.

## Approach

Replace the hand-rolled wheel handler in month-grid.tsx with a thin adapter
over wheel-gestures. Extract the per-gesture hop decision as a pure reducer so
bun tests can drive it — including through the REAL analyzer via feedWheel().

### Design Priorities (in order)
1. Minimal code / simplicity — delete all three rounds of heuristics
2. Performance — library is 2.1 kB gzip, zero deps
3. Explicit and traceable — pure reducer + tiny attach helper
4. Reusability — reducer testable headless
5. Readability

## Implementation Phases

### Phase A: dependency + wheel-paging module + tests
- [x] `cd app && bun add wheel-gestures@2.2.48` (exact pin)
- [x] New `app/src/components/calendar/wheel-paging.ts`:
      - `stepWheelPaging(state, event)` pure reducer: isStart resets
        {consumed, acc}; isMomentum/isEnding ignored; acc += deltaY;
        threshold crossing while !consumed → hop ±1, consumed=true.
        HOP_THRESHOLD_PX = 60 exported (tuning knob, documented).
      - `attachWheelPaging(node, onHop)` — WheelGestures({preventWheelAction:
        'y', reverseSign: false}), observe + on('wheel'), returns cleanup.
- [x] New `wheel-paging.test.ts` (bun): reducer unit tests (one hop per
      gesture; momentum ignored; re-flick = second hop; reversal within
      gesture; slow scroll = one hop) + integration test feeding a realistic
      flick profile (ramp + decaying tail with timestamps) through the real
      WheelGestures analyzer via feedWheel(), asserting exactly one hop, and a
      double-flick profile asserting exactly two.
- Files: app/package.json, app/bun.lock, wheel-paging.ts, wheel-paging.test.ts

### Phase B: wire into month-grid
- [x] Replace the wheel useEffect in month-grid.tsx with attachWheelPaging;
      onHop(dir): base = animating ? animTarget : lastOffset; target =
      monthStartNeighbors(...); clamp; animateScrollTo (unchanged animator —
      mid-animation chaining preserved).
- [x] Delete dead constants (WHEEL_STEP_PX, WHEEL_IDLE_MS, WHEEL_LINE_PX,
      WHEEL_SPIKE_*, WHEEL_DECAY_EVENTS) and the old handler; update comments.
      Library owns preventDefault (passive:false) — no listener of our own.
- Files: app/src/components/calendar/month-grid.tsx

### Phase C: verification
- [x] typecheck / lint / format:check, bun test (139 pass, 10 new)
- [x] Browser pane: wiring smoke test through the real library listener
      (flick-shaped burst = exactly 1 month). NOTE: gesture SEGMENTATION
      (flick=1 / re-flick=2 / reversal / slow scroll) is covered by the bun
      feedWheel integration tests with realistic 16ms timestamps — the pane
      throttles timers so synthetic streams can't carry realistic timing.
- [x] e2e run.sh — passed
- [ ] User try-and-report loop on a real trackpad; tune HOP_THRESHOLD_PX
      (40–120) and, only if ghost hops appear, add the velocity-floor gate

## Summary

Files: app/package.json + bun.lock (wheel-gestures@2.2.48 exact pin),
app/src/components/calendar/wheel-paging.ts (new: pure per-gesture reducer +
attach adapter), wheel-paging.test.ts (new: 6 reducer tests + 4 integration
tests driving the real analyzer via feedWheel), month-grid.tsx (wheel effect
replaced by attachWheelPaging; all hand-rolled wheel constants/heuristics
deleted — WHEEL_STEP/IDLE/LINE/SPIKE_*/DECAY_EVENTS).

Key decisions: act only during the analyzer-confirmed finger phase (embla
pattern), drop the whole momentum tail, one hop per gesture via a consumed
flag; re-flick chains via the library's momentum-cancel → fresh-gesture
re-publish; mid-animation hops chain from animTarget (unchanged). Root cause
of prior failures documented in wheel-paging-research.md (Chrome wheel-event
coalescing sums deltas under jank).

Deviations from plan: none.

## Edge Cases & Error Handling
- Range ends: existing hop logic no-ops when target ≈ current (kept).
- Momentum-cancel false positive under extreme jank: ghost gesture accumulates
  only decaying momentum deltas, rarely reaches 60px; velocity-floor knob
  documented as the escalation.
- Unmount/effect re-run: cleanup = off() + unobserve().
- deltaMode (Firefox line mode): now normalized by the library; our manual
  ×16 math deleted.
- Non-web platforms: attach effect stays Platform.OS === 'web'-gated.

## Risks & Open Questions
- Threshold feel (60px) unverifiable without a real trackpad → tuning loop.
- wheel-gestures last core publish 2024-08 (embla plugin pinning it published
  2025-08) — acceptable: tiny, fixture-tested, massively deployed.

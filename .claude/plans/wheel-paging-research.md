# Wheel paging research — wheel-gestures adoption
Date: 2026-07-13
Researcher: uberthink Phase 2 sub-agent (sources verified against GitHub source + npm registry)

## Verdict

Adopt `wheel-gestures@2.2.48` (xiel, MIT, zero deps, 2.1 kB gzip, ~859k dl/wk,
engine behind embla-carousel-wheel-gestures 8.1.0 which is actively published).
It does gesture SEGMENTATION (isStart / finger phase / isMomentum tail /
isEnding / isMomentumCancel) via velocity-ratio analysis over merged event
pairs — robust to Chrome's wheel-event coalescing, which is the confirmed root
cause of our three hand-rolled failures.

## Root cause of hand-rolled failures (confirmed)

Chromium coalesces wheel events when the main thread is busy — deltas are
literally SUMMED (`WebMouseWheelEvent::Coalesce`, web_mouse_wheel_event.cc:58-97;
queued via MainThreadEventQueue::FilterNewEvent). Our own settle animation +
FlatList row mounting jank the main thread, so single events arrive carrying
2-3× magnitude. Any per-event magnitude/gap heuristic (all three of our rounds,
also lethargy and Swiper's approach) misclassifies those as fresh pushes.
Velocity (Δpx/Δt) is approximately preserved under coalescing — wheel-gestures
analyzes velocity decay ratios (last 5 factors in [0.6, 0.96] ⇒ momentum;
constants.ts:2-4, wheel-gestures.ts:209-242), which survives.

## Key API facts (v2.2.48, from source)

- `WheelGestures({ preventWheelAction: 'y', reverseSign: false })` — factory.
  It attaches its own `{passive:false}` listener and calls preventDefault()
  itself for y-dominant events (wheel-gestures.ts:70-97). reverseSign default
  is [true,true,false] (drag-space); `false` keeps natural signs
  (scroll down ⇒ positive axisDelta[1]).
- `wg.observe(node)` → returns unobserve thunk; `wg.on('wheel', cb)` → off thunk.
- Callback `WheelEventState`: isStart, isMomentum, isEnding, isMomentumCancel,
  axisDelta [x,y,z] px (deltaMode-normalized, clamped ±700), axisVelocity px/ms,
  axisMovement (cumulative per gesture), previous.
- Re-flick during momentum tail: event with |delta| > max(2, 2×last) while
  isMomentum ⇒ ends gesture with isMomentumCancel ⇒ same event re-published
  with isStart (wheel-gestures.ts:102-106, 264-275). Fixture-tested upstream
  (double-swipe-right.json).
- Momentum recognition latency ≈ 10-14 raw events (~100-150 ms into the tail).
- `feedWheel(events)` lets us drive the REAL analyzer headlessly in bun tests.

## Pattern to imitate (embla-carousel-wheel-gestures)

Ignore the entire momentum tail (its "release" = first isMomentum event);
act only during the finger phase; movement clamp prevents slide-skipping;
a re-flick arrives as momentum-cancel → new gesture. Distilled for our pager:

```ts
if (s.isStart) { consumed = false; acc = 0 }
if (s.isMomentum || s.isEnding) return
acc += s.axisDelta[1]
if (!consumed && Math.abs(acc) >= HOP_THRESHOLD_PX) { consumed = true; hop(sign(acc)) }
```

HOP_THRESHOLD_PX ≈ 60 (tune 40-120). Optional hardening if ghost hops are ever
observed: also require |axisVelocity[1]| > vMin at the threshold crossing.

## Alternatives rejected

- lethargy / lethargy-ts: per-event magnitude classification — defeated by
  coalescing (the same family we hand-rolled). lethargy unmaintained (2019).
- normalize-wheel (Facebook): units only, no intent; fbjs deprecated.
- fullpage.js: rolling averages + cooldown; GPLv3 — do not copy; misfires on tails.
- Swiper mousewheel: last-2-events rising-edge heuristics — same failed family.

## Integration constraints

Plain DOM/TS, no React; construct anywhere, `observe()` in an effect with the
node from `getScrollableNode()`; window access already guarded for static
rendering; Metro-compatible (CJS main + ESM module + exports map, bundled
.d.ts); normal `bun add`. MUST remove our own wheel listener — the library owns
preventDefault via preventWheelAction.

## Sources

- https://github.com/xiel/wheel-gestures (src/wheel-gestures/wheel-gestures.ts,
  constants.ts, wheel-normalizer.ts, WheelTargetObserver.ts, types/index.ts,
  test fixtures + snapshots), issues #724 #725 #133
- https://github.com/xiel/embla-carousel-wheel-gestures (WheelGesturesPlugin.ts v8.1.0)
- https://registry.npmjs.org/wheel-gestures (2.2.48, 2024-08-31)
- Chromium: third_party/blink/common/input/web_mouse_wheel_event.cc (Coalesce :58),
  third_party/blink/renderer/platform/widget/input/main_thread_event_queue.cc

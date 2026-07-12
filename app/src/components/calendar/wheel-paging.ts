// Wheel → month-paging adapter (web only). Raw wheel streams are unusable for
// "one flick = one page": macOS momentum events are indistinguishable
// per-event from finger events, and Chrome COALESCES wheel events under
// main-thread jank (deltas are summed), which defeats any per-event
// magnitude/gap heuristic — three hand-rolled attempts failed exactly there
// (see .claude/plans/wheel-paging-research.md). wheel-gestures segments the
// stream into gestures with coalescing-tolerant velocity-ratio momentum
// detection; this module reduces each gesture to at most one hop, imitating
// embla-carousel-wheel-gestures: act only during the finger phase, drop the
// entire momentum tail, and let a re-flick mid-tail (published by the library
// as momentum-cancel → fresh gesture) hop again.
import { WheelGestures, type WheelEventState } from 'wheel-gestures';

/** Accumulated finger-phase px that commit a hop. Tuning knob: lower = more
 *  hair-trigger, higher = more deliberate; sensible range ~40–120. */
export const HOP_THRESHOLD_PX = 60;

/** The slice of WheelEventState the reducer consumes (tests build these). */
export type WheelPagingEvent = {
  isStart: boolean;
  isMomentum: boolean;
  isEnding: boolean;
  /** Normalized y-delta in px, natural sign (scroll down = positive). */
  deltaY: number;
};

export type WheelPagingState = {
  /** This gesture already produced its one hop. */
  consumed: boolean;
  /** Finger-phase y-accumulation (signed, so mid-gesture reversal cancels). */
  acc: number;
};

export const initialWheelPagingState: WheelPagingState = {
  consumed: false,
  acc: 0,
};

/**
 * One step of the per-gesture state machine. `hop` is ±1 on the event that
 * commits the gesture's single page turn (+1 = next month), else 0. A
 * gesture start resets state — including the re-published start event of a
 * flick that cancelled the previous gesture's momentum tail, which is what
 * makes rapid successive flicks page one month each.
 */
export function stepWheelPaging(
  state: WheelPagingState,
  event: WheelPagingEvent
): { state: WheelPagingState; hop: -1 | 0 | 1 } {
  let { consumed, acc } = state;
  if (event.isStart) {
    consumed = false;
    acc = 0;
  }
  if (event.isMomentum || event.isEnding) {
    return { state: { consumed, acc }, hop: 0 };
  }
  acc += event.deltaY;
  if (consumed || Math.abs(acc) < HOP_THRESHOLD_PX) {
    return { state: { consumed, acc }, hop: 0 };
  }
  return { state: { consumed: true, acc }, hop: acc > 0 ? 1 : -1 };
}

/**
 * Attach one-hop-per-gesture wheel paging to a DOM node. The library owns the
 * listener ({passive: false}) and preventDefault()s y-dominant events, so the
 * page never scroll-chains. Returns a cleanup that detaches everything.
 */
export function attachWheelPaging(
  node: EventTarget,
  onHop: (direction: -1 | 1) => void
): () => void {
  const gestures = WheelGestures({
    preventWheelAction: 'y',
    // Natural wheel signs (scroll down = positive), not drag-space.
    reverseSign: false,
  });
  let state = initialWheelPagingState;
  const offWheel = gestures.on('wheel', (s: WheelEventState) => {
    const step = stepWheelPaging(state, {
      isStart: s.isStart,
      isMomentum: s.isMomentum,
      isEnding: s.isEnding,
      deltaY: s.axisDelta[1],
    });
    state = step.state;
    if (step.hop !== 0) onHop(step.hop);
  });
  const unobserve = gestures.observe(node);
  return () => {
    offWheel();
    unobserve();
  };
}

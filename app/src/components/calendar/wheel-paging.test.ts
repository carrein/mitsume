import { WheelGestures, type WheelEventData } from 'wheel-gestures';

import {
  HOP_THRESHOLD_PX,
  initialWheelPagingState,
  stepWheelPaging,
  type WheelPagingEvent,
} from './wheel-paging';

const ev = (
  deltaY: number,
  flags: Partial<Omit<WheelPagingEvent, 'deltaY'>> = {}
): WheelPagingEvent => ({
  isStart: false,
  isMomentum: false,
  isEnding: false,
  deltaY,
  ...flags,
});

/** Run a sequence through the reducer, returning the emitted hops. */
function hopsOf(events: WheelPagingEvent[]): number[] {
  const hops: number[] = [];
  let state = initialWheelPagingState;
  for (const event of events) {
    const step = stepWheelPaging(state, event);
    state = step.state;
    if (step.hop !== 0) hops.push(step.hop);
  }
  return hops;
}

describe('stepWheelPaging (reducer)', () => {
  it('hops once when the finger phase crosses the threshold, then stays consumed', () => {
    expect(
      hopsOf([ev(20, { isStart: true }), ev(30), ev(30), ev(100), ev(100)])
    ).toEqual([1]);
  });

  it('ignores the momentum tail entirely', () => {
    expect(
      hopsOf([
        ev(20, { isStart: true }),
        ev(HOP_THRESHOLD_PX),
        ev(500, { isMomentum: true }),
        ev(400, { isMomentum: true }),
        ev(0, { isMomentum: true, isEnding: true }),
      ])
    ).toEqual([1]);
  });

  it('a new gesture start (incl. momentum-cancel re-publish) resets and can hop again', () => {
    expect(
      hopsOf([
        ev(HOP_THRESHOLD_PX, { isStart: true }),
        ev(50, { isMomentum: true }),
        ev(HOP_THRESHOLD_PX, { isStart: true }), // re-flick mid-tail
      ])
    ).toEqual([1, 1]);
  });

  it('scroll up hops backward', () => {
    expect(hopsOf([ev(-HOP_THRESHOLD_PX, { isStart: true })])).toEqual([-1]);
  });

  it('mid-gesture reversal cancels accumulation instead of hopping', () => {
    expect(hopsOf([ev(40, { isStart: true }), ev(-40), ev(30)])).toEqual([]);
  });

  it('sub-threshold gestures never hop', () => {
    expect(
      hopsOf([
        ev(20, { isStart: true }),
        ev(20),
        ev(10, { isMomentum: true }),
        ev(0, { isEnding: true, isMomentum: true }),
      ])
    ).toEqual([]);
  });
});

// Integration: drive the REAL wheel-gestures analyzer with realistic trackpad
// profiles via feedWheel(), wired to the same reducer attachWheelPaging uses.
// This is the exact failure mode the hand-rolled heuristics kept losing:
// flicks have a ramp-up + a long machine-decayed momentum tail.

function pagingHarness() {
  const hops: number[] = [];
  const gestures = WheelGestures({
    preventWheelAction: false,
    reverseSign: false,
  });
  let state = initialWheelPagingState;
  gestures.on('wheel', (s) => {
    const step = stepWheelPaging(state, {
      isStart: s.isStart,
      isMomentum: s.isMomentum,
      isEnding: s.isEnding,
      deltaY: s.axisDelta[1],
    });
    state = step.state;
    if (step.hop !== 0) hops.push(step.hop);
  });
  return { gestures, hops };
}

/** Build a wheel event stream: finger ramp then a ~0.9-decay momentum tail. */
function flick(
  startTs: number,
  sign: 1 | -1,
  tailEvents = 16
): WheelEventData[] {
  const finger = [4, 12, 30, 60, 100, 130, 140];
  const deltas = [...finger];
  for (let i = 1; i <= tailEvents; i++) {
    deltas.push(130 * Math.pow(0.9, i));
  }
  return deltas.map((d, i) => ({
    deltaMode: 0,
    deltaX: 0,
    deltaY: sign * d,
    timeStamp: startTs + i * 16,
  }));
}

const FLICK_MS = (7 + 16) * 16;

describe('wheel-gestures integration (real analyzer, feedWheel)', () => {
  it('one flick (ramp + momentum tail) = exactly one hop', () => {
    const { gestures, hops } = pagingHarness();
    gestures.feedWheel(flick(1000, 1));
    expect(hops).toEqual([1]);
  });

  it('a second flick during the momentum tail = exactly two hops', () => {
    const { gestures, hops } = pagingHarness();
    const first = flick(1000, 1);
    // Re-flick lands 16ms after the last tail event, mid-momentum: the
    // analyzer cancels the tail and starts a fresh gesture.
    const second = flick(1000 + FLICK_MS, 1);
    gestures.feedWheel([...first, ...second]);
    expect(hops).toEqual([1, 1]);
  });

  it('flick down then flick up nets out (one hop each way)', () => {
    const { gestures, hops } = pagingHarness();
    gestures.feedWheel([...flick(1000, 1), ...flick(1000 + FLICK_MS, -1)]);
    expect(hops).toEqual([1, -1]);
  });

  it('slow steady scroll (no momentum) = exactly one hop', () => {
    const { gestures, hops } = pagingHarness();
    const events: WheelEventData[] = Array.from({ length: 12 }, (_, i) => ({
      deltaMode: 0,
      deltaX: 0,
      deltaY: 20,
      timeStamp: 1000 + i * 40,
    }));
    gestures.feedWheel(events);
    expect(hops).toEqual([1]);
  });
});

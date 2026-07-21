import {
  DEFAULT_SPLIT,
  PANE_FLEX,
  SPLIT_FRACTIONS,
  loadSplitRatio,
  parseSplitRatio,
  saveSplitRatio,
  snapCalendarFraction,
  type SplitRatio,
} from './split-ratio';

const RATIOS = Object.keys(SPLIT_FRACTIONS) as SplitRatio[];

describe('snapCalendarFraction', () => {
  it('maps each preset fraction to itself', () => {
    expect(snapCalendarFraction(1 / 2)).toBe('1/2');
    expect(snapCalendarFraction(2 / 5)).toBe('2/5');
    expect(snapCalendarFraction(1 / 3)).toBe('1/3');
  });

  it('snaps to the nearest preset across midpoint boundaries', () => {
    // Midpoints sit at ~0.3667 (1/3 vs 2/5) and 0.45 (2/5 vs 1/2).
    expect(snapCalendarFraction(0.36)).toBe('1/3');
    expect(snapCalendarFraction(0.375)).toBe('2/5');
    expect(snapCalendarFraction(0.44)).toBe('2/5');
    expect(snapCalendarFraction(0.46)).toBe('1/2');
  });

  it('clamps out-of-range drags to the edge presets', () => {
    expect(snapCalendarFraction(0)).toBe('1/3');
    expect(snapCalendarFraction(-1)).toBe('1/3');
    expect(snapCalendarFraction(1)).toBe('1/2');
    expect(snapCalendarFraction(5)).toBe('1/2');
  });

  it('falls back to the default on non-finite input', () => {
    expect(snapCalendarFraction(NaN)).toBe(DEFAULT_SPLIT);
    expect(snapCalendarFraction(Infinity)).toBe(DEFAULT_SPLIT);
    expect(snapCalendarFraction(-Infinity)).toBe(DEFAULT_SPLIT);
  });
});

describe('parseSplitRatio', () => {
  it('round-trips every valid token', () => {
    for (const ratio of RATIOS) expect(parseSplitRatio(ratio)).toBe(ratio);
  });

  it('rejects anything else', () => {
    expect(parseSplitRatio('garbage')).toBeNull();
    expect(parseSplitRatio('')).toBeNull();
    expect(parseSplitRatio(null)).toBeNull();
  });
});

describe('PANE_FLEX', () => {
  it('realizes the exact fraction for every ratio', () => {
    for (const ratio of RATIOS) {
      const { notes, calendar } = PANE_FLEX[ratio];
      expect(calendar / (notes + calendar)).toBeCloseTo(
        SPLIT_FRACTIONS[ratio],
        10
      );
    }
  });
});

describe('storage without localStorage', () => {
  it('loads the default and saves without throwing', () => {
    expect(loadSplitRatio()).toBe(DEFAULT_SPLIT);
    expect(() => saveSplitRatio('1/2')).not.toThrow();
  });
});

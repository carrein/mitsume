import { BACKOFF_BASE_MS, BACKOFF_MAX_MS, backoffDelayMs } from './backoff';

describe('backoffDelayMs', () => {
  it('grows exponentially at zero jitter (random=0 → half the exponential)', () => {
    expect(backoffDelayMs(1, () => 0)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelayMs(2, () => 0)).toBe(BACKOFF_BASE_MS * 2);
    expect(backoffDelayMs(3, () => 0)).toBe(BACKOFF_BASE_MS * 4);
  });

  it('caps at the max delay', () => {
    expect(backoffDelayMs(30, () => 1)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelayMs(30, () => 0)).toBe(BACKOFF_MAX_MS / 2);
  });

  it('keeps jitter within [0.5, 1.0] of the exponential', () => {
    // attempt 2 → exponential = base·2² = 20s → jittered range [10s, 20s]
    for (let i = 0; i < 50; i++) {
      const d = backoffDelayMs(2);
      expect(d).toBeGreaterThanOrEqual(BACKOFF_BASE_MS * 2);
      expect(d).toBeLessThanOrEqual(BACKOFF_BASE_MS * 4);
    }
  });
});

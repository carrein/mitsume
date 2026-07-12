import {
  DISPLAY_MAX_BYTES,
  DISPLAY_MAX_EDGE,
  renditionPlan,
} from './ingest-plan';

describe('renditionPlan', () => {
  it('passes small images through untouched', () => {
    expect(renditionPlan(800, 600, 'image/png', 100_000)).toEqual({
      reencode: false,
    });
  });

  it('re-encodes oversized dimensions, capped to the max edge', () => {
    const plan = renditionPlan(4096, 2048, 'image/png', 100_000);
    expect(plan).toEqual({ reencode: true, w: DISPLAY_MAX_EDGE, h: 1024 });
  });

  it('re-encodes heavy files even when dimensions fit', () => {
    const plan = renditionPlan(1000, 1000, 'image/png', DISPLAY_MAX_BYTES + 1);
    // dimensions already fit → scale 1, but bytes force a WebP re-encode
    expect(plan).toEqual({ reencode: true, w: 1000, h: 1000 });
  });

  it('never re-encodes GIFs (animation would flatten)', () => {
    expect(renditionPlan(5000, 5000, 'image/gif', 10_000_000)).toEqual({
      reencode: false,
    });
  });

  it('preserves aspect ratio and never emits zero dimensions', () => {
    const plan = renditionPlan(10_000, 3, 'image/png', 100_000);
    if (!plan.reencode) throw new Error('expected re-encode');
    expect(plan.w).toBe(DISPLAY_MAX_EDGE);
    expect(plan.h).toBeGreaterThanOrEqual(1);
  });
});

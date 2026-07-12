import {
  addDays,
  buildWeekRange,
  gridFetchRange,
  isBanner,
  layoutWeek,
  mondayOf,
  monthAnchorOf,
  monthStartNeighbors,
  monthStartWeekIndex,
  monthStartWeekIndices,
  pagerTargetIndex,
  weekIndexOfDay,
  weeksBetween,
  type GridEventLike,
} from './calendar-grid';
import { toDateString } from './date';

// Mon 2026-07-06 .. Sun 2026-07-12 — the reference week for layout tests.
const WEEK = new Date(2026, 6, 6);

const ev = (
  id: string,
  start: Date,
  end: Date,
  allDay = false
): GridEventLike => ({ id, start, end, allDay });

describe('mondayOf', () => {
  it('maps every day of a week to its Monday (Sunday included)', () => {
    for (let i = 0; i < 7; i++) {
      expect(toDateString(mondayOf(addDays(WEEK, i)))).toBe('2026-07-06');
    }
  });

  it('crosses month and year boundaries', () => {
    // Fri 2027-01-01 belongs to the week of Mon 2026-12-28.
    expect(toDateString(mondayOf(new Date(2027, 0, 1)))).toBe('2026-12-28');
  });
});

describe('weeksBetween / weekIndexOfDay', () => {
  it('counts whole weeks between Mondays', () => {
    expect(weeksBetween(WEEK, WEEK)).toBe(0);
    expect(weeksBetween(WEEK, addDays(WEEK, 7))).toBe(1);
    expect(weeksBetween(WEEK, addDays(WEEK, 70))).toBe(10);
    expect(weeksBetween(addDays(WEEK, 7), WEEK)).toBe(-1);
  });

  it('increments once per 7 days across a year boundary (DST-safe)', () => {
    const rangeStart = new Date(2026, 9, 5); // Mon 2026-10-05
    for (let i = 0; i < 26; i++) {
      expect(weekIndexOfDay(addDays(rangeStart, i * 7 + 3), rangeStart)).toBe(
        i
      );
    }
  });
});

describe('buildWeekRange', () => {
  const today = new Date(2026, 6, 12);
  const { rangeStart, weeks } = buildWeekRange(today);

  it('starts on a Monday and spans ~10 years of weeks', () => {
    expect(rangeStart.getDay()).toBe(1);
    expect(weeks[0]).toBe(toDateString(rangeStart));
    expect(weeks.length).toBeGreaterThan(500);
    expect(weeks.length).toBeLessThan(550);
  });

  it('lists consecutive Mondays and contains today’s week', () => {
    expect(weeks[1]).toBe(toDateString(addDays(rangeStart, 7)));
    const todayIndex = weekIndexOfDay(today, rangeStart);
    expect(weeks[todayIndex]).toBe(toDateString(mondayOf(today)));
  });
});

describe('monthStartWeekIndex / monthStartWeekIndices', () => {
  const rangeStart = new Date(2026, 0, 5); // Mon 2026-01-05
  const weekCount = 105; // ~2 years

  it('targets the week containing the 1st', () => {
    // Jul 1 2026 is a Wednesday — its week starts Mon Jun 29.
    const index = monthStartWeekIndex(2026, 6, rangeStart);
    expect(toDateString(addDays(rangeStart, index * 7))).toBe('2026-06-29');
  });

  it('lists unique ascending in-range indices', () => {
    const indices = monthStartWeekIndices(rangeStart, weekCount);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
    expect(indices[0]).toBeGreaterThanOrEqual(0);
    expect(indices[indices.length - 1]).toBeLessThan(weekCount);
    expect(indices).toContain(monthStartWeekIndex(2026, 6, rangeStart));
    // Jan 2026's 1st falls before rangeStart — excluded.
    expect(monthStartWeekIndex(2026, 0, rangeStart)).toBeLessThan(0);
  });
});

describe('monthAnchorOf', () => {
  it('assigns the week containing the 1st to that month, for any weekday 1st', () => {
    // Months starting Mon..Sun: Feb 2027 (Mon), Sep 2026 (Tue), Jul 2026 (Wed),
    // Oct 2026 (Thu), May 2026 (Fri), Aug 2026 (Sat), Mar 2026 (Sun).
    const cases: [number, number][] = [
      [2027, 1],
      [2026, 8],
      [2026, 6],
      [2026, 9],
      [2026, 4],
      [2026, 7],
      [2026, 2],
    ];
    for (const [year, month0] of cases) {
      const anchor = monthAnchorOf(mondayOf(new Date(year, month0, 1)));
      expect([anchor.year, anchor.month0]).toEqual([year, month0]);
    }
  });

  it('keeps the preceding week in the previous month', () => {
    const firstWeek = mondayOf(new Date(2026, 6, 1));
    const anchor = monthAnchorOf(addDays(firstWeek, -7));
    expect([anchor.year, anchor.month0]).toEqual([2026, 5]);
  });
});

describe('gridFetchRange', () => {
  it('covers all six grid rows of a Monday-starting short month', () => {
    // Feb 2027 starts Mon — the settled grid shows through Sun Mar 14.
    const { start, end } = gridFetchRange(2027, 1);
    expect(toDateString(start)).toBe('2027-01-25');
    expect(end.getTime()).toBeGreaterThan(new Date(2027, 2, 15).getTime() - 1);
  });

  it('is one week of slack either side of the month’s first week', () => {
    const { start, end } = gridFetchRange(2026, 6); // first week Mon Jun 29
    expect(toDateString(start)).toBe('2026-06-22');
    expect(toDateString(end)).toBe('2026-08-17');
  });
});

describe('isBanner', () => {
  it('is true for all-day events', () => {
    expect(
      isBanner(ev('a', new Date(2026, 6, 8), new Date(2026, 6, 9), true))
    ).toBe(true);
  });

  it('is false for a same-day timed event', () => {
    expect(
      isBanner(ev('a', new Date(2026, 6, 8, 10), new Date(2026, 6, 8, 11)))
    ).toBe(false);
  });

  it('treats an exact-midnight end as same-day (end-exclusive)', () => {
    expect(
      isBanner(ev('a', new Date(2026, 6, 8, 22), new Date(2026, 6, 9, 0, 0)))
    ).toBe(false);
  });

  it('is true for a timed event crossing midnight', () => {
    expect(
      isBanner(ev('a', new Date(2026, 6, 8, 23), new Date(2026, 6, 9, 1)))
    ).toBe(true);
  });
});

describe('layoutWeek', () => {
  const SLOTS = 10; // roomy default so packing tests aren’t clipped

  it('places a timed event as a chip in its column', () => {
    const layout = layoutWeek(
      WEEK,
      [ev('a', new Date(2026, 6, 8, 10), new Date(2026, 6, 8, 11))],
      SLOTS
    );
    expect(layout.banners).toEqual([]);
    expect(layout.chips).toMatchObject([{ col: 2, slot: 0 }]);
    expect(layout.overflow).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('spans a multi-day timed event across its columns', () => {
    const layout = layoutWeek(
      WEEK,
      [ev('a', new Date(2026, 6, 8, 10), new Date(2026, 6, 10, 11))],
      SLOTS
    );
    expect(layout.banners).toMatchObject([
      {
        startCol: 2,
        span: 3,
        slot: 0,
        continuesLeft: false,
        continuesRight: false,
      },
    ]);
  });

  it('clamps banners at week edges and flags continuation', () => {
    const layout = layoutWeek(
      WEEK,
      [ev('a', new Date(2026, 6, 4), new Date(2026, 6, 15), true)],
      SLOTS
    );
    expect(layout.banners).toMatchObject([
      { startCol: 0, span: 7, continuesLeft: true, continuesRight: true },
    ]);
  });

  it('treats all-day DTEND as exclusive (single covered day)', () => {
    const layout = layoutWeek(
      WEEK,
      [ev('a', new Date(2026, 6, 8), new Date(2026, 6, 9), true)],
      SLOTS
    );
    expect(layout.banners).toMatchObject([{ startCol: 2, span: 1 }]);
  });

  it('drops events that do not touch the week', () => {
    const layout = layoutWeek(
      WEEK,
      [
        ev('before', new Date(2026, 6, 1, 10), new Date(2026, 6, 1, 11)),
        // Timed event ending exactly at the week's first midnight — exclusive.
        ev('edge', new Date(2026, 6, 5, 22), new Date(2026, 6, 6, 0, 0)),
        ev('after', new Date(2026, 6, 13, 10), new Date(2026, 6, 13, 11)),
      ],
      SLOTS
    );
    expect(layout.banners).toEqual([]);
    expect(layout.chips).toEqual([]);
  });

  it('packs overlapping banners into lanes and reuses freed columns', () => {
    const layout = layoutWeek(
      WEEK,
      [
        ev('a', new Date(2026, 6, 6), new Date(2026, 6, 9), true), // Mon–Wed
        ev('b', new Date(2026, 6, 7), new Date(2026, 6, 10), true), // Tue–Thu
        ev('c', new Date(2026, 6, 9), new Date(2026, 6, 11), true), // Thu–Fri
      ],
      SLOTS
    );
    const bySlot = Object.fromEntries(
      layout.banners.map((b) => [b.event.id, b.slot])
    );
    expect(bySlot).toEqual({ a: 0, b: 1, c: 0 }); // c fits beside a
  });

  it('orders same-start banners longer-first, deterministically', () => {
    const layout = layoutWeek(
      WEEK,
      [
        ev('short', new Date(2026, 6, 6), new Date(2026, 6, 8), true),
        ev('long', new Date(2026, 6, 6), new Date(2026, 6, 11), true),
      ],
      SLOTS
    );
    const bySlot = Object.fromEntries(
      layout.banners.map((b) => [b.event.id, b.slot])
    );
    expect(bySlot).toEqual({ long: 0, short: 1 });
  });

  it('fills chip gaps under partial banners', () => {
    const layout = layoutWeek(
      WEEK,
      [
        ev('banner', new Date(2026, 6, 6), new Date(2026, 6, 9), true), // Mon–Wed
        ev('under', new Date(2026, 6, 7, 9), new Date(2026, 6, 7, 10)), // Tue
        ev('clear', new Date(2026, 6, 10, 9), new Date(2026, 6, 10, 10)), // Fri
      ],
      SLOTS
    );
    const chip = (id: string) => layout.chips.find((c) => c.event.id === id)!;
    expect(chip('under').slot).toBe(1);
    expect(chip('clear').slot).toBe(0);
  });

  it('sorts chips within a column by start time', () => {
    const layout = layoutWeek(
      WEEK,
      [
        ev('late', new Date(2026, 6, 8, 15), new Date(2026, 6, 8, 16)),
        ev('early', new Date(2026, 6, 8, 9), new Date(2026, 6, 8, 10)),
      ],
      SLOTS
    );
    const bySlot = Object.fromEntries(
      layout.chips.map((c) => [c.event.id, c.slot])
    );
    expect(bySlot).toEqual({ early: 0, late: 1 });
  });

  it('hides from slotCount−1 up in overflowing columns and counts them', () => {
    const layout = layoutWeek(
      WEEK,
      [
        ev('a', new Date(2026, 6, 8, 9), new Date(2026, 6, 8, 10)),
        ev('b', new Date(2026, 6, 8, 10), new Date(2026, 6, 8, 11)),
        ev('c', new Date(2026, 6, 8, 11), new Date(2026, 6, 8, 12)),
      ],
      2
    );
    expect(layout.chips).toMatchObject([{ event: { id: 'a' }, slot: 0 }]);
    expect(layout.overflow).toEqual([0, 0, 2, 0, 0, 0, 0]);
  });

  it('keeps full columns visible when they exactly fit', () => {
    const layout = layoutWeek(
      WEEK,
      [
        ev('a', new Date(2026, 6, 8, 9), new Date(2026, 6, 8, 10)),
        ev('b', new Date(2026, 6, 8, 10), new Date(2026, 6, 8, 11)),
      ],
      2
    );
    expect(layout.chips).toHaveLength(2);
    expect(layout.overflow).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('hides clipped banners row-wide and cascades into covered columns', () => {
    // Packing (span desc): A slot 0, C slot 1, B slot 2; chip under C on Wed
    // packs to slot 2. slotCount 2: Mon overflows (B at slot 2) and hides
    // everything from slot 1 up; C's row-wide hide then drags Wed's chip out
    // even though Wed itself never exceeded the visible slots.
    const layout = layoutWeek(
      WEEK,
      [
        ev('A', new Date(2026, 6, 6), new Date(2026, 6, 13), true), // Mon–Sun
        ev('B', new Date(2026, 6, 6), new Date(2026, 6, 8), true), // Mon–Tue
        ev('C', new Date(2026, 6, 6), new Date(2026, 6, 10), true), // Mon–Thu
        ev('chip', new Date(2026, 6, 8, 9), new Date(2026, 6, 8, 10)), // Wed
      ],
      2
    );
    expect(layout.banners.map((b) => b.event.id)).toEqual(['A']);
    expect(layout.chips).toEqual([]);
    expect(layout.overflow).toEqual([2, 2, 2, 1, 0, 0, 0]);
  });

  it('hides everything when slotCount is 0', () => {
    const layout = layoutWeek(
      WEEK,
      [
        ev('a', new Date(2026, 6, 8, 9), new Date(2026, 6, 8, 10)),
        ev('b', new Date(2026, 6, 6), new Date(2026, 6, 9), true),
      ],
      0
    );
    expect(layout.banners).toEqual([]);
    expect(layout.chips).toEqual([]);
    expect(layout.overflow).toEqual([1, 1, 2, 0, 0, 0, 0]);
  });
});

describe('monthStartNeighbors / pagerTargetIndex', () => {
  // Month-start indices ~4/5 weeks apart, like the real ribbon.
  const INDICES = [0, 4, 9, 13, 17, 22];

  it('finds the nearest month start and its neighbors', () => {
    expect(monthStartNeighbors(INDICES, 9)).toEqual({
      prev: 4,
      current: 9,
      next: 13,
    });
    expect(monthStartNeighbors(INDICES, 10.4)).toEqual({
      prev: 4,
      current: 9,
      next: 13,
    });
    expect(monthStartNeighbors(INDICES, 11.6)).toEqual({
      prev: 9,
      current: 13,
      next: 17,
    });
  });

  it('collapses prev/next at the range ends', () => {
    expect(monthStartNeighbors(INDICES, 0)).toEqual({
      prev: 0,
      current: 0,
      next: 4,
    });
    expect(monthStartNeighbors(INDICES, 23)).toEqual({
      prev: 17,
      current: 22,
      next: 22,
    });
  });

  it('commits a page turn past the commit fraction, else springs back', () => {
    const window = { prev: 4, current: 9, next: 13 };
    expect(pagerTargetIndex(window, 9.5, 0)).toBe(9); // 12.5% toward next
    expect(pagerTargetIndex(window, 10.5, 0)).toBe(13); // 37.5% toward next
    expect(pagerTargetIndex(window, 8.5, 0)).toBe(9); // 10% toward prev
    expect(pagerTargetIndex(window, 7, 0)).toBe(4); // 40% toward prev
  });

  it('flicks commit regardless of distance; a reverse flick bounces back', () => {
    const window = { prev: 4, current: 9, next: 13 };
    expect(pagerTargetIndex(window, 9.2, 1)).toBe(13); // barely moved, flick on
    expect(pagerTargetIndex(window, 8.8, -1)).toBe(4);
    expect(pagerTargetIndex(window, 12, -1)).toBe(9); // dragged far, flicked back
    expect(pagerTargetIndex(window, 5, 1)).toBe(9);
    expect(pagerTargetIndex(window, 9, 1)).toBe(13); // flick from rest
    expect(pagerTargetIndex(window, 9, -1)).toBe(4);
  });

  it('stays put at collapsed range ends', () => {
    expect(pagerTargetIndex({ prev: 0, current: 0, next: 4 }, 0, -1)).toBe(0);
    expect(pagerTargetIndex({ prev: 17, current: 22, next: 22 }, 22, 1)).toBe(
      22
    );
  });
});

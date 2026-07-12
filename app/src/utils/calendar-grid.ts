// Pure math for the scrollable month grid: week indexing over a bounded range
// (the FlatList data), month-start snap targets, and per-week banner/chip lane
// layout. No React or react-native imports — runs under bun test and CI jest.
import { toDateString } from '@/utils/date';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Grid range: today ± this many years of week rows. */
const RANGE_YEARS = 5;

/** Calendar-safe day arithmetic (setDate-style); also normalizes to local midnight. */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Local-midnight Monday of the week containing `d` (weeks start Monday). */
export function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

/**
 * Whole weeks between two local-midnight Mondays. Math.round absorbs the ±1h
 * drift a DST transition introduces into the raw ms difference.
 */
export function weeksBetween(fromMonday: Date, toMonday: Date): number {
  return Math.round((toMonday.getTime() - fromMonday.getTime()) / WEEK_MS);
}

/**
 * The bounded week ribbon: Monday dateStrings from the week containing
 * (today − RANGE_YEARS) through the week containing (today + RANGE_YEARS).
 * The array is the FlatList data; each entry doubles as its key.
 */
export function buildWeekRange(today: Date): {
  rangeStart: Date;
  weeks: string[];
} {
  const rangeStart = mondayOf(
    new Date(
      today.getFullYear() - RANGE_YEARS,
      today.getMonth(),
      today.getDate()
    )
  );
  const rangeEnd = mondayOf(
    new Date(
      today.getFullYear() + RANGE_YEARS,
      today.getMonth(),
      today.getDate()
    )
  );
  const count = weeksBetween(rangeStart, rangeEnd) + 1;
  const weeks: string[] = [];
  for (let i = 0; i < count; i++) {
    weeks.push(toDateString(addDays(rangeStart, i * 7)));
  }
  return { rangeStart, weeks };
}

/** Row index of the week containing `day` (negative / past-end when out of range). */
export function weekIndexOfDay(day: Date, rangeStart: Date): number {
  return weeksBetween(rangeStart, mondayOf(day));
}

/** Row index of the week containing the 1st of (year, month0) — the snap target. */
export function monthStartWeekIndex(
  year: number,
  month0: number,
  rangeStart: Date
): number {
  return weekIndexOfDay(new Date(year, month0, 1), rangeStart);
}

/** Every in-range month-start row index, ascending — feeds Android snapToOffsets. */
export function monthStartWeekIndices(
  rangeStart: Date,
  weekCount: number
): number[] {
  const endMs = addDays(rangeStart, weekCount * 7).getTime();
  const indices: number[] = [];
  let year = rangeStart.getFullYear();
  let month0 = rangeStart.getMonth();
  while (new Date(year, month0, 1).getTime() < endMs) {
    const index = monthStartWeekIndex(year, month0, rangeStart);
    if (index >= 0 && index < weekCount) indices.push(index);
    month0 += 1;
    if (month0 > 11) {
      month0 = 0;
      year += 1;
    }
  }
  return indices;
}

/** A calendar month reference (month0 is 0-based like Date#getMonth). */
export type MonthAnchor = { year: number; month0: number };

/** Month-start week indices bracketing a pager position (see below). */
export type MonthNeighbors = { prev: number; current: number; next: number };

/**
 * For a fractional week position (scroll offset ÷ row height), the nearest
 * month-start index plus its neighbors — the pager's clamp window and snap
 * candidates. At the range ends prev/next collapse onto current.
 */
export function monthStartNeighbors(
  monthIndices: number[],
  position: number
): MonthNeighbors {
  let lo = 0;
  let hi = monthIndices.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (monthIndices[mid] < position) lo = mid + 1;
    else hi = mid;
  }
  // lo = first index ≥ position; nearest is that one or its predecessor.
  if (lo > 0 && position - monthIndices[lo - 1] < monthIndices[lo] - position) {
    lo -= 1;
  }
  return {
    prev: monthIndices[Math.max(lo - 1, 0)],
    current: monthIndices[lo],
    next: monthIndices[Math.min(lo + 1, monthIndices.length - 1)],
  };
}

/** Fraction of the way toward an adjacent month a released drag must reach
 *  to commit the page turn (flicks commit regardless). */
const PAGE_COMMIT_FRACTION = 0.25;

/**
 * Where a released pager drag should land. `flickDirection` +1/−1 is a
 * decisive flick toward later/earlier months — it snaps to the adjacent
 * candidate in that direction (or bounces back to `current` when the drag
 * had strayed the other way); 0 falls back to the commit-fraction rule.
 */
export function pagerTargetIndex(
  { prev, current, next }: MonthNeighbors,
  position: number,
  flickDirection: -1 | 0 | 1
): number {
  const pos = Math.min(Math.max(position, prev), next);
  if (flickDirection > 0) return pos >= current ? next : current;
  if (flickDirection < 0) return pos <= current ? prev : current;
  if (pos >= current) {
    const span = next - current;
    return span > 0 && (pos - current) / span > PAGE_COMMIT_FRACTION
      ? next
      : current;
  }
  const span = current - prev;
  return span > 0 && (current - pos) / span > PAGE_COMMIT_FRACTION
    ? prev
    : current;
}

/**
 * The month that "owns" a week row = the month of the week's Sunday. With
 * Monday-start weeks, the week containing a month's 1st always has its Sunday
 * in that month, and every following week up to (excluding) the next month's
 * start week does too — so this drives both the header label and day dimming.
 */
export function monthAnchorOf(weekStart: Date): MonthAnchor {
  const sunday = addDays(weekStart, 6);
  return { year: sunday.getFullYear(), month0: sunday.getMonth() };
}

/**
 * Fetch window covering a settled month's full 6-row viewport:
 * [monday(1st) − 7d, monday(1st) + 49d). Unlike the old [1st−7d, last+7d)
 * window, this covers the 6th grid row even for short months starting on
 * Monday (e.g. Feb 2027 shows through Mar 14 but last+7d ends Mar 8).
 */
export function gridFetchRange(
  year: number,
  month0: number
): { start: Date; end: Date } {
  const firstWeek = mondayOf(new Date(year, month0, 1));
  return { start: addDays(firstWeek, -7), end: addDays(firstWeek, 49) };
}

/** The minimal event shape the layout needs (CalEvent satisfies it). */
export type GridEventLike = {
  id: string;
  start: Date;
  end: Date;
  allDay: boolean;
};

export type BannerPlacement<T extends GridEventLike = GridEventLike> = {
  event: T;
  /** 0..6 within this week. */
  startCol: number;
  /** 1..7 columns covered in this week. */
  span: number;
  /** Vertical slot; 0 sits directly under the day-number line. */
  slot: number;
  /** Event started before this week — render a squared-off left edge. */
  continuesLeft: boolean;
  continuesRight: boolean;
};

export type ChipPlacement<T extends GridEventLike = GridEventLike> = {
  event: T;
  col: number;
  slot: number;
};

export type WeekLayout<T extends GridEventLike = GridEventLike> = {
  banners: BannerPlacement<T>[];
  chips: ChipPlacement<T>[];
  /** Hidden-event count per weekday column; >0 renders "+N more" in the last slot. */
  overflow: number[];
};

/**
 * All-day events and anything touching more than one local day render as
 * spanning banners. Computed from raw start/end (`end` exclusive at exact
 * midnight, matching eventDays) — NOT via eventDays(), whose 62-day cap would
 * truncate very long events.
 */
export function isBanner(event: GridEventLike): boolean {
  if (event.allDay) return true;
  const lastMs = Math.max(event.start.getTime(), event.end.getTime() - 1);
  return toDateString(event.start) !== toDateString(new Date(lastMs));
}

/** Day-column offset of `d`'s local midnight from weekStart (DST-safe). */
function dayDiff(weekStart: Date, d: Date): number {
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((midnight.getTime() - weekStart.getTime()) / DAY_MS);
}

/**
 * Lay out one week row. Banners pack greedily into the lowest free slot
 * (sorted startCol asc → span desc → start asc → id, so packing is
 * deterministic); chips then fill per-column gaps under partial banners.
 * With `slotCount` visible slots, an overflowing column hides everything from
 * slot (slotCount − 1) up and reports the hidden count; a banner hidden in any
 * covered column hides row-wide, which can cascade "+N more" into columns that
 * previously fit — the hide pass iterates to a fixpoint. Hidden occupants are
 * not re-packed (an occasional empty slot beats layout jumps). slotCount ≤ 0
 * hides everything; callers only render "+N more" when slotCount ≥ 1.
 */
export function layoutWeek<T extends GridEventLike>(
  weekStart: Date,
  events: T[],
  slotCount: number
): WeekLayout<T> {
  const weekStartMs = weekStart.getTime();
  const weekEndMs = addDays(weekStart, 7).getTime();

  const banners: BannerPlacement<T>[] = [];
  const chipsByCol: T[][] = [[], [], [], [], [], [], []];
  for (const event of events) {
    const lastMs = Math.max(event.start.getTime(), event.end.getTime() - 1);
    if (event.start.getTime() >= weekEndMs || lastMs < weekStartMs) continue;
    if (isBanner(event)) {
      const startDay = dayDiff(weekStart, event.start);
      const endDay = dayDiff(weekStart, new Date(lastMs));
      const startCol = Math.max(0, startDay);
      const endCol = Math.min(6, endDay);
      banners.push({
        event,
        startCol,
        span: endCol - startCol + 1,
        slot: 0,
        continuesLeft: startDay < 0,
        continuesRight: endDay > 6,
      });
    } else {
      const col = dayDiff(weekStart, event.start);
      if (col >= 0 && col <= 6) chipsByCol[col].push(event);
    }
  }

  banners.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.span - a.span ||
      a.event.start.getTime() - b.event.start.getTime() ||
      a.event.id.localeCompare(b.event.id)
  );

  // occupied[slot][col]; slots grow unbounded — visibility is applied after.
  const occupied: boolean[][] = [];
  const freeSlot = (from: number, to: number): number => {
    for (let slot = 0; ; slot++) {
      if (slot >= occupied.length) return slot;
      let free = true;
      for (let c = from; c <= to; c++) {
        if (occupied[slot][c]) {
          free = false;
          break;
        }
      }
      if (free) return slot;
    }
  };
  const claim = (slot: number, from: number, to: number) => {
    while (occupied.length <= slot) occupied.push(new Array(7).fill(false));
    for (let c = from; c <= to; c++) occupied[slot][c] = true;
  };

  for (const banner of banners) {
    const endCol = banner.startCol + banner.span - 1;
    banner.slot = freeSlot(banner.startCol, endCol);
    claim(banner.slot, banner.startCol, endCol);
  }

  const chips: ChipPlacement<T>[] = [];
  chipsByCol.forEach((list, col) => {
    list.sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id)
    );
    for (const event of list) {
      const slot = freeSlot(col, col);
      claim(slot, col, col);
      chips.push({ event, col, slot });
    }
  });

  const coversCol = (b: BannerPlacement<T>, col: number) =>
    col >= b.startCol && col < b.startCol + b.span;
  const hiddenBanners = new Set<BannerPlacement<T>>();
  const hiddenChips = new Set<ChipPlacement<T>>();

  let changed = true;
  while (changed) {
    changed = false;
    for (let col = 0; col < 7; col++) {
      const colBanners = banners.filter((b) => coversCol(b, col));
      const colChips = chips.filter((chip) => chip.col === col);
      const anyHidden =
        colBanners.some((b) => hiddenBanners.has(b)) ||
        colChips.some((chip) => hiddenChips.has(chip));
      const visibleSlots = [
        ...colBanners.filter((b) => !hiddenBanners.has(b)),
        ...colChips.filter((chip) => !hiddenChips.has(chip)),
      ];
      const needsMore =
        anyHidden || visibleSlots.some((p) => p.slot >= slotCount);
      if (!needsMore) continue;
      for (const b of colBanners) {
        if (!hiddenBanners.has(b) && b.slot >= slotCount - 1) {
          hiddenBanners.add(b);
          changed = true;
        }
      }
      for (const chip of colChips) {
        if (!hiddenChips.has(chip) && chip.slot >= slotCount - 1) {
          hiddenChips.add(chip);
          changed = true;
        }
      }
    }
  }

  const overflow = Array.from(
    { length: 7 },
    (_, col) =>
      banners.filter((b) => hiddenBanners.has(b) && coversCol(b, col)).length +
      chips.filter((chip) => hiddenChips.has(chip) && chip.col === col).length
  );

  return {
    banners: banners.filter((b) => !hiddenBanners.has(b)),
    chips: chips.filter((chip) => !hiddenChips.has(chip)),
    overflow,
  };
}

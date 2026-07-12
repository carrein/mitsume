import { dayHeader, groupByDay, headerDate } from './format';
import type { WidgetEvent } from './types';

const ev = (
  start: Date,
  overrides: Partial<WidgetEvent> = {}
): WidgetEvent => ({
  summary: 'x',
  start: start.toISOString(),
  end: new Date(start.getTime() + 3_600_000).toISOString(),
  allDay: false,
  ...overrides,
});

const now = new Date(2026, 6, 8, 12, 0); // Wed 8 Jul 2026, noon

describe('headerDate', () => {
  it('formats weekday • day short-month', () => {
    expect(headerDate(new Date(2026, 6, 9, 8, 0))).toBe('Thu • 9 Jul');
  });
});

describe('dayHeader', () => {
  it('formats weekday, day, and full month', () => {
    expect(dayHeader(new Date(2026, 6, 13, 9, 0), now)).toBe('Mon 13 July');
    expect(dayHeader(new Date(2026, 0, 1, 0, 0), now)).toBe('Thu 1 January');
  });

  it('marks today and tomorrow', () => {
    expect(dayHeader(new Date(2026, 6, 8, 23, 0), now)).toBe(
      'Wed 8 July · Today'
    );
    expect(dayHeader(new Date(2026, 6, 9, 1, 0), now)).toBe(
      'Thu 9 July · Tomorrow'
    );
  });
});

describe('groupByDay', () => {
  it('buckets by local start day, days ascending', () => {
    const groups = groupByDay(
      [
        ev(new Date(2026, 6, 14, 9, 0)),
        ev(new Date(2026, 6, 13, 15, 0)),
        ev(new Date(2026, 6, 13, 9, 0)),
      ],
      now
    );
    expect(groups.map((g) => g.day)).toEqual(['2026-07-13', '2026-07-14']);
    expect(groups[0].header).toBe('Mon 13 July');
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
    expect(groups[0].items[0].spanDays).toBe(1);
  });

  it('orders all-day before timed within a day', () => {
    const [group] = groupByDay(
      [
        ev(new Date(2026, 6, 13, 9, 0), { summary: 'timed' }),
        ev(new Date(2026, 6, 13, 0, 0), { summary: 'allday', allDay: true }),
      ],
      now
    );
    expect(group.items.map((i) => i.event.summary)).toEqual([
      'allday',
      'timed',
    ]);
  });

  it('expands a multi-day event across every day it covers, with (n/N)', () => {
    const groups = groupByDay(
      [
        ev(new Date(2026, 6, 13, 0, 0), {
          summary: 'trip',
          allDay: true,
          end: new Date(2026, 6, 16, 0, 0).toISOString(),
        }),
      ],
      now
    );
    expect(groups.map((g) => g.day)).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
    ]);
    expect(groups.map((g) => g.items[0].dayIndex)).toEqual([1, 2, 3]);
    expect(groups.every((g) => g.items[0].spanDays === 3)).toBe(true);
  });

  it('drops past days of a running event but keeps true-start indices', () => {
    // now = Wed 8 Jul; a Mon 6 → Fri 11 (exclusive) event: days 6 & 7 dropped,
    // dayIndex still counts from the true start (Jul 6).
    const groups = groupByDay(
      [
        ev(new Date(2026, 6, 6, 0, 0), {
          summary: 'vacation',
          allDay: true,
          end: new Date(2026, 6, 11, 0, 0).toISOString(),
        }),
      ],
      now
    );
    expect(groups.map((g) => g.day)).toEqual([
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
    ]);
    expect(groups.map((g) => g.items[0].dayIndex)).toEqual([3, 4, 5]);
    expect(groups[0].items[0].spanDays).toBe(5);
  });
});

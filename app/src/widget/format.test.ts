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
    expect(groups[0].events).toHaveLength(2);
    expect(groups[1].events).toHaveLength(1);
  });

  it('orders all-day before timed within a day', () => {
    const [group] = groupByDay(
      [
        ev(new Date(2026, 6, 13, 9, 0), { summary: 'timed' }),
        ev(new Date(2026, 6, 13, 0, 0), { summary: 'allday', allDay: true }),
      ],
      now
    );
    expect(group.events.map((e) => e.summary)).toEqual(['allday', 'timed']);
  });
});

import { dayLabel, formatWhen } from './format';

const now = new Date(2026, 6, 7, 12, 0); // Tue 7 Jul 2026, noon

describe('dayLabel', () => {
  it('labels today and tomorrow', () => {
    expect(dayLabel(new Date(2026, 6, 7, 23, 59), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 6, 8, 0, 0), now)).toBe('Tomorrow');
  });

  it('falls back to weekday + date', () => {
    expect(dayLabel(new Date(2026, 6, 14, 9, 0), now)).toBe('Tue 14 Jul');
  });

  it('handles month rollover for tomorrow', () => {
    const endOfMonth = new Date(2026, 6, 31, 12, 0);
    expect(dayLabel(new Date(2026, 7, 1), endOfMonth)).toBe('Tomorrow');
  });
});

describe('formatWhen', () => {
  it('shows time for timed events and a marker for all-day', () => {
    expect(
      formatWhen(
        {
          summary: 'x',
          start: new Date(2026, 6, 7, 15, 0).toISOString(),
          end: new Date(2026, 6, 7, 16, 0).toISOString(),
          allDay: false,
        },
        now
      )
    ).toBe('Today 15:00');
    expect(
      formatWhen(
        {
          summary: 'x',
          start: new Date(2026, 6, 8).toISOString(),
          end: new Date(2026, 6, 9).toISOString(),
          allDay: true,
        },
        now
      )
    ).toBe('Tomorrow · all day');
  });
});

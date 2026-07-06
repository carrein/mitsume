import type { CalEvent } from '@/caldav/types';

import { selectUpcoming, toWidgetEvent } from './select-upcoming';

function mkEvent(
  summary: string,
  start: Date,
  end: Date,
  allDay = false
): CalEvent {
  return {
    id: `${summary}:${start.toISOString()}`,
    url: `/dav/${summary}.ics`,
    etag: '"1"',
    uid: summary,
    summary,
    start,
    end,
    allDay,
    raw: '',
  };
}

const now = new Date(2026, 6, 7, 12, 0); // Tue 7 Jul 2026, noon

describe('selectUpcoming', () => {
  it('drops past events and sorts the rest by start', () => {
    const past = mkEvent(
      'past',
      new Date(2026, 6, 7, 9, 0),
      new Date(2026, 6, 7, 10, 0)
    );
    const later = mkEvent(
      'later',
      new Date(2026, 6, 9, 9, 0),
      new Date(2026, 6, 9, 10, 0)
    );
    const soon = mkEvent(
      'soon',
      new Date(2026, 6, 7, 15, 0),
      new Date(2026, 6, 7, 16, 0)
    );
    expect(
      selectUpcoming([past, later, soon], now).map((e) => e.summary)
    ).toEqual(['soon', 'later']);
  });

  it('keeps an event that is in progress at now', () => {
    const running = mkEvent(
      'running',
      new Date(2026, 6, 7, 11, 0),
      new Date(2026, 6, 7, 13, 0)
    );
    expect(selectUpcoming([running], now)).toHaveLength(1);
  });

  it('keeps a today all-day event (exclusive end at next midnight)', () => {
    const allDay = mkEvent(
      'holiday',
      new Date(2026, 6, 7),
      new Date(2026, 6, 8),
      true
    );
    const yesterday = mkEvent(
      'gone',
      new Date(2026, 6, 6),
      new Date(2026, 6, 7),
      true
    );
    expect(
      selectUpcoming([allDay, yesterday], now).map((e) => e.summary)
    ).toEqual(['holiday']);
  });

  it('caps at the limit, counting each recurring instance separately', () => {
    const instances = Array.from({ length: 12 }, (_, i) =>
      mkEvent(
        'standup',
        new Date(2026, 6, 8 + i, 9, 0),
        new Date(2026, 6, 8 + i, 9, 15)
      )
    );
    expect(selectUpcoming(instances, now)).toHaveLength(10);
  });
});

describe('toWidgetEvent', () => {
  it('serializes dates and keeps location only when present', () => {
    const event = mkEvent(
      'lunch',
      new Date(Date.UTC(2026, 6, 8, 4, 0)),
      new Date(Date.UTC(2026, 6, 8, 5, 0))
    );
    expect(toWidgetEvent({ ...event, location: 'Lau Pa Sat' })).toEqual({
      summary: 'lunch',
      start: '2026-07-08T04:00:00.000Z',
      end: '2026-07-08T05:00:00.000Z',
      allDay: false,
      location: 'Lau Pa Sat',
    });
    expect('location' in toWidgetEvent(event)).toBe(false);
  });
});

import { reviveEvents, serializeEvents } from './event-snapshot';
import type { CalEvent } from '@/caldav/types';

const event: CalEvent = {
  id: 'uid-1:2026-07-08T10:00:00.000Z',
  url: '/dav/cal/uid-1.ics',
  etag: '"abc"',
  uid: 'uid-1',
  summary: 'Physio',
  start: new Date(2026, 6, 8, 10, 0),
  end: new Date(2026, 6, 8, 11, 0),
  allDay: false,
  location: 'Clinic',
  raw: 'BEGIN:VCALENDAR…',
};

describe('serializeEvents / reviveEvents', () => {
  it('round-trips events through JSON', () => {
    const revived = reviveEvents(
      JSON.parse(JSON.stringify(serializeEvents([event])))
    );
    expect(revived).toHaveLength(1);
    expect(revived![0]).toEqual(event);
    expect(revived![0].start).toBeInstanceOf(Date);
  });

  it('rejects non-array snapshots', () => {
    expect(reviveEvents(null)).toBeNull();
    expect(reviveEvents({ events: [] })).toBeNull();
  });

  it('rejects entries with missing or non-string fields', () => {
    expect(reviveEvents([{ id: 'x' }])).toBeNull();
    expect(
      reviveEvents([{ ...serializeEvents([event])[0], start: 42 }])
    ).toBeNull();
  });

  it('rejects unparseable dates', () => {
    expect(
      reviveEvents([{ ...serializeEvents([event])[0], end: 'not-a-date' }])
    ).toBeNull();
  });

  it('accepts an empty snapshot (an empty month is cacheable)', () => {
    expect(reviveEvents([])).toEqual([]);
  });
});

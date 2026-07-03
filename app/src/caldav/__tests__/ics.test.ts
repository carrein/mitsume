import { buildEventICS, editPreserving } from '../ics';

// A realistic Apple-created event: carries VTIMEZONE, ORGANIZER, ATTENDEE and an
// X-APPLE-* extension — all of which MUST survive an edit (the plan's #1 risk).
const APPLE_EVENT = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'CALSCALE:GREGORIAN',
  'PRODID:-//Apple Inc.//macOS 26.5//EN',
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Singapore',
  'BEGIN:STANDARD',
  'DTSTART:19811231T233000',
  'TZOFFSETFROM:+0730',
  'TZOFFSETTO:+0800',
  'TZNAME:SGT',
  'END:STANDARD',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'UID:APPLE-UID-1',
  'DTSTAMP:20260601T000000Z',
  'DTSTART;TZID=Asia/Singapore:20260605T130000',
  'DTEND;TZID=Asia/Singapore:20260605T134500',
  'SUMMARY:Original title',
  'LOCATION:Office',
  'ORGANIZER;CN=Addison:mailto:addison@example.com',
  'ATTENDEE;CN=Duncan;ROLE=REQ-PARTICIPANT:mailto:duncan@example.com',
  'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-TITLE=Office:geo:1.3,103.8',
  'SEQUENCE:2',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('editPreserving', () => {
  it('changes only the target field and preserves unknown/Apple properties', () => {
    const out = editPreserving(APPLE_EVENT, { summary: 'New title' });

    expect(out).toContain('SUMMARY:New title');
    expect(out).not.toContain('SUMMARY:Original title');

    // the whole point: nothing else is dropped
    expect(out).toContain('X-APPLE-STRUCTURED-LOCATION');
    expect(out).toContain('ATTENDEE');
    expect(out).toContain('ORGANIZER');
    expect(out).toContain('LOCATION:Office');
  });

  it('bumps SEQUENCE on edit', () => {
    const out = editPreserving(APPLE_EVENT, { summary: 'x' });
    expect(out).toMatch(/SEQUENCE:3/); // 2 -> 3
  });

  it('leaves DTSTART;TZID byte-identical on a title-only edit', () => {
    const out = editPreserving(APPLE_EVENT, { summary: 'x' });
    expect(out).toContain('DTSTART;TZID=Asia/Singapore:20260605T130000');
    expect(out).toContain('DTEND;TZID=Asia/Singapore:20260605T134500');
  });

  it('rewrites times as UTC without leaving a stale TZID parameter', () => {
    const out = editPreserving(APPLE_EVENT, {
      start: new Date('2026-06-05T06:00:00Z'),
      end: new Date('2026-06-05T07:00:00Z'),
      allDay: false,
    });
    expect(out).toContain('DTSTART:20260605T060000Z');
    expect(out).not.toMatch(/DTSTART;TZID/);
  });

  it('keeps all-day events VALUE=DATE with a non-inclusive DTEND', () => {
    const allDayEvent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//test//EN',
      'BEGIN:VEVENT',
      'UID:ALLDAY-1',
      'DTSTAMP:20260601T000000Z',
      'DTSTART;VALUE=DATE:20260621',
      'DTEND;VALUE=DATE:20260622',
      'SUMMARY:👽 Xuan',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const day = new Date(2026, 6, 10); // 2026-07-10 local
    const out = editPreserving(allDayEvent, {
      start: day,
      end: day,
      allDay: true,
    });
    expect(out).toContain('DTSTART;VALUE=DATE:20260710');
    expect(out).toContain('DTEND;VALUE=DATE:20260711'); // +1 day, non-inclusive
    expect(out).toContain('SUMMARY:👽 Xuan'); // emoji + untouched fields survive
  });
});

describe('buildEventICS', () => {
  it('produces a valid timed VEVENT written in UTC', () => {
    const ics = buildEventICS(
      {
        summary: 'Lunch',
        start: new Date('2026-07-02T12:00:00Z'),
        end: new Date('2026-07-02T13:00:00Z'),
        allDay: false,
      },
      'UID-2'
    );

    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:UID-2');
    expect(ics).toContain('SUMMARY:Lunch');
    expect(ics).toMatch(/DTSTART:20260702T120000Z/);
  });
});

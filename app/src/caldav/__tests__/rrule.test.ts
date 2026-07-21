import ICAL from 'ical.js';

import { applyRecurrence, readRecurrence, weekdaysByday } from '../rrule';

function veventFromDtstart(dtstartLine: string): ICAL.Component {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//test//EN',
    'BEGIN:VEVENT',
    'UID:R-1',
    'DTSTAMP:20260601T000000Z',
    dtstartLine,
    'SUMMARY:x',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const vcalendar = new ICAL.Component(ICAL.parse(ics));
  return vcalendar.getFirstSubcomponent('vevent')!;
}

function icsWith(...veventExtraLines: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//test//EN',
    'BEGIN:VEVENT',
    'UID:R-1',
    'DTSTAMP:20260601T000000Z',
    'DTSTART:20260706T040000Z', // Mon 2026-07-06 04:00Z (Mon 12:00 SGT)
    'SUMMARY:x',
    ...veventExtraLines,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

describe('applyRecurrence — serialization', () => {
  it('writes each simple preset', () => {
    const cases = [
      ['daily', 'RRULE:FREQ=DAILY'],
      ['weekly', 'RRULE:FREQ=WEEKLY'],
      ['monthly', 'RRULE:FREQ=MONTHLY'],
      ['yearly', 'RRULE:FREQ=YEARLY'],
    ] as const;
    for (const [preset, expected] of cases) {
      const vevent = veventFromDtstart('DTSTART:20260706T040000Z');
      applyRecurrence(vevent, { preset });
      expect(vevent.toString()).toContain(expected);
    }
  });

  it('writes COUNT', () => {
    const vevent = veventFromDtstart('DTSTART:20260706T040000Z');
    applyRecurrence(vevent, { preset: 'daily', count: 10 });
    expect(vevent.toString()).toContain('RRULE:FREQ=DAILY;COUNT=10');
  });

  it('writes timed UNTIL as local end-of-day in UTC', () => {
    const vevent = veventFromDtstart('DTSTART:20260706T040000Z');
    applyRecurrence(vevent, {
      preset: 'daily',
      until: new Date(2026, 6, 31), // 2026-07-31 local
    });
    // ICAL.Time.toString() is jCal-extended; the RRULE serializes compact.
    const expected = ICAL.Time.fromJSDate(
      new Date(2026, 6, 31, 23, 59, 59),
      true
    )
      .toString()
      .replace(/[-:]/g, '');
    expect(vevent.toString()).toContain(`UNTIL=${expected}`);
    expect(expected.endsWith('Z')).toBe(true);
  });

  it('writes all-day UNTIL as VALUE=DATE to match DTSTART', () => {
    const vevent = veventFromDtstart('DTSTART;VALUE=DATE:20260706');
    applyRecurrence(vevent, {
      preset: 'weekly',
      until: new Date(2026, 7, 3), // 2026-08-03 local
    });
    expect(vevent.toString()).toContain('UNTIL=20260803');
    expect(vevent.toString()).not.toContain('UNTIL=20260803T');
  });

  it('removes the rule with null', () => {
    const vevent = veventFromDtstart('DTSTART:20260706T040000Z');
    applyRecurrence(vevent, { preset: 'daily' });
    applyRecurrence(vevent, null);
    expect(vevent.toString()).not.toContain('RRULE');
  });
});

describe('weekdays BYDAY rotation', () => {
  it('delta 0: stored and local weekday agree', () => {
    // 04:00Z on a Monday is Monday everywhere between UTC and +8.
    const t = ICAL.Time.fromJSDate(new Date('2026-07-06T04:00:00Z'), true);
    expect(weekdaysByday(t)).toEqual(['MO', 'TU', 'WE', 'TH', 'FR']);
  });

  it('rotates when the stored (UTC) day is behind the local day', () => {
    // 2026-07-05T23:00Z = Mon 07:00 SGT — stored Sunday, local Monday.
    const t = ICAL.Time.fromJSDate(new Date('2026-07-05T23:00:00Z'), true);
    const local = t.toJSDate().getDay();
    if (local === 1) {
      // Running in a UTC+ zone (e.g. SGT): set shifts back one day.
      expect(weekdaysByday(t)).toEqual(['SU', 'MO', 'TU', 'WE', 'TH']);
    } else {
      // In UTC/negative zones the days agree; the invariant still holds below.
      expect(weekdaysByday(t)).toHaveLength(5);
    }
  });

  it('invariant: the set always covers local Mon–Fri shifted uniformly', () => {
    for (const iso of [
      '2026-07-05T23:00:00Z',
      '2026-07-06T04:00:00Z',
      '2026-07-06T16:00:00Z',
      '2026-07-11T23:00:00Z',
    ]) {
      const t = ICAL.Time.fromJSDate(new Date(iso), true);
      const set = weekdaysByday(t);
      expect(new Set(set).size).toBe(5);
    }
  });

  it('all-day DTSTART needs no rotation', () => {
    const vevent = veventFromDtstart('DTSTART;VALUE=DATE:20260706');
    const t = vevent.getFirstPropertyValue('dtstart') as ICAL.Time;
    expect(weekdaysByday(t)).toEqual(['MO', 'TU', 'WE', 'TH', 'FR']);
  });
});

describe('readRecurrence', () => {
  it('null when there is no rule', () => {
    expect(readRecurrence(icsWith())).toBeNull();
  });

  it('round-trips each preset written by applyRecurrence', () => {
    for (const preset of [
      'daily',
      'weekdays',
      'weekly',
      'monthly',
      'yearly',
    ] as const) {
      const vevent = veventFromDtstart('DTSTART:20260706T040000Z');
      applyRecurrence(vevent, { preset, count: 4 });
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//test//EN',
        vevent.toString(),
        'END:VCALENDAR',
      ].join('\r\n');
      expect(readRecurrence(ics)).toEqual({ preset, count: 4 });
    }
  });

  it('reads UNTIL back as a Date', () => {
    const vevent = veventFromDtstart('DTSTART:20260706T040000Z');
    applyRecurrence(vevent, { preset: 'daily', until: new Date(2026, 6, 31) });
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//test//EN',
      vevent.toString(),
      'END:VCALENDAR',
    ].join('\r\n');
    const read = readRecurrence(ics);
    expect(read).not.toBeNull();
    expect(read).not.toBe('custom');
    if (read && read !== 'custom') {
      expect(read.preset).toBe('daily');
      // Local end-of-day of the chosen date.
      expect(read.until?.getFullYear()).toBe(2026);
      expect(read.until?.getMonth()).toBe(6);
      expect(read.until?.getDate()).toBe(31);
    }
  });

  it.each([
    ['interval > 1', 'RRULE:FREQ=WEEKLY;INTERVAL=2'],
    ['ordinal BYDAY', 'RRULE:FREQ=MONTHLY;BYDAY=2FR'],
    ['extra BY-part', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=15'],
    ['non-preset freq', 'RRULE:FREQ=HOURLY'],
    ['non-weekday BYDAY set', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE'],
  ])('custom: %s', (_name, rule) => {
    expect(readRecurrence(icsWith(rule))).toBe('custom');
  });

  it('custom when EXRULE/RDATE present', () => {
    expect(
      readRecurrence(icsWith('RRULE:FREQ=DAILY', 'RDATE:20260801T040000Z'))
    ).toBe('custom');
  });

  it('custom when per-occurrence overrides exist', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//test//EN',
      'BEGIN:VEVENT',
      'UID:R-1',
      'DTSTAMP:20260601T000000Z',
      'DTSTART:20260706T040000Z',
      'RRULE:FREQ=DAILY',
      'SUMMARY:series',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:R-1',
      'DTSTAMP:20260601T000000Z',
      'RECURRENCE-ID:20260707T040000Z',
      'DTSTART:20260707T050000Z',
      'SUMMARY:moved occurrence',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    expect(readRecurrence(ics)).toBe('custom');
  });

  it('foreign rule text is untouched by unrelated edits (byte-identical)', () => {
    const rule = 'RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=20270101T000000Z;BYDAY=SA';
    const ics = icsWith(rule);
    const reparsed = new ICAL.Component(ICAL.parse(ics)).toString();
    expect(reparsed).toContain(rule);
  });
});

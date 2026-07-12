// Small local-timezone date helpers for the calendar UI (device-local tz per plan).

/** Local date as a dateString: 'YYYY-MM-DD'. */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'HH:MM' (24h, local). */
export function toTimeString(d: Date): string {
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}

/**
 * All local days an event touches, as dateStrings. `end` is treated as exclusive at
 * exact midnight (all-day DTEND is non-inclusive; a timed event ending 00:00 shouldn't
 * mark the next day). Capped defensively for degenerate ranges.
 */
export function eventDays(start: Date, end: Date): string[] {
  const lastMs = Math.max(start.getTime(), end.getTime() - 1);
  const days: string[] = [];
  const cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  while (cursor.getTime() <= lastMs && days.length < 62) {
    days.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Parse 'YYYY-MM-DD' + 'HH:MM' into a local Date; null when invalid. */
export function parseDayTime(day: string, time: string): Date | null {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dayMatch || !timeMatch) return null;
  const [, y, m, d] = dayMatch.map(Number);
  const [, hh, mm] = timeMatch.map(Number);
  if (hh > 23 || mm > 59) return null;
  const date = new Date(y, m - 1, d, hh, mm);
  // Reject silent rollover (e.g. 2026-02-31).
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  )
    return null;
  return date;
}

/** Parse 'YYYY-MM-DD' into a local-midnight Date; null when invalid. */
export function parseDay(day: string): Date | null {
  return parseDayTime(day, '00:00');
}

/** Next full hour after `from` (e.g. 14:23 → 15:00). */
export function nextFullHour(from: Date): Date {
  const d = new Date(from);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

// Day grouping + headings for the agenda widget. Pure — hardcoded English names
// keep it deterministic across devices (no Intl dependence in the headless
// context).
import { parseDay, toDateString } from '@/utils/date';

import type { WidgetEvent } from './types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Day-group heading — 'Mon 13 July', with a '· Today' / '· Tomorrow' marker
 * on the near days (matches the in-app agenda's day labels). */
export function dayHeader(d: Date, now: Date): string {
  const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (sameLocalDay(d, now)) return `${base} · Today`;
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );
  if (sameLocalDay(d, tomorrow)) return `${base} · Tomorrow`;
  return base;
}

/** All-day first, then chronological — matches the in-app agenda ordering. */
function compareEvents(a: WidgetEvent, b: WidgetEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return new Date(a.start).getTime() - new Date(b.start).getTime();
}

export type WidgetDayGroup = {
  /** 'YYYY-MM-DD' local day key (the event's start day). */
  day: string;
  /** Rendered heading for the group, e.g. 'Mon 13 July'. */
  header: string;
  events: WidgetEvent[];
};

/**
 * Bucket already-upcoming events by their local start day: days ascending, and
 * events within a day ordered for display. Multi-day events sit under their
 * start day (same placement the flat list used before grouping).
 */
export function groupByDay(events: WidgetEvent[], now: Date): WidgetDayGroup[] {
  const byDay = new Map<string, WidgetEvent[]>();
  for (const event of events) {
    const day = toDateString(new Date(event.start));
    const list = byDay.get(day);
    if (list) list.push(event);
    else byDay.set(day, [event]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayEvents]) => ({
      day,
      header: dayHeader(parseDay(day) ?? new Date(day), now),
      events: dayEvents.sort(compareEvents),
    }));
}

// Row formatting for the agenda widget. Pure — hardcoded English names keep it
// deterministic across devices (no Intl dependence in the headless context).
import { toTimeString } from '@/utils/date';

import type { WidgetEvent } from './types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 'Today' / 'Tomorrow' / 'Tue 14 Jul' (local tz). */
export function dayLabel(d: Date, now: Date): string {
  if (sameLocalDay(d, now)) return 'Today';
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );
  if (sameLocalDay(d, tomorrow)) return 'Tomorrow';
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** One-line "when": 'Today 14:00' / 'Tomorrow · all day' / 'Tue 14 Jul 09:30'. */
export function formatWhen(event: WidgetEvent, now: Date): string {
  const start = new Date(event.start);
  const label = dayLabel(start, now);
  return event.allDay
    ? `${label} · all day`
    : `${label} ${toTimeString(start)}`;
}

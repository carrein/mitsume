// (De)serialization for cached CalEvent lists: snapshots are JSON (see
// snapshot-cache), so Dates travel as ISO strings. Reviving validates shape —
// a corrupt or foreign snapshot yields null rather than malformed events.
import type { CalEvent } from '@/caldav/types';

export type EventSnapshot = (Omit<CalEvent, 'start' | 'end'> & {
  start: string;
  end: string;
})[];

export function serializeEvents(events: CalEvent[]): EventSnapshot {
  return events.map((event) => ({
    ...event,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
  }));
}

export function reviveEvents(snapshot: unknown): CalEvent[] | null {
  if (!Array.isArray(snapshot)) return null;
  const events: CalEvent[] = [];
  for (const item of snapshot as EventSnapshot) {
    if (
      typeof item?.id !== 'string' ||
      typeof item.summary !== 'string' ||
      typeof item.start !== 'string' ||
      typeof item.end !== 'string'
    ) {
      return null;
    }
    const start = new Date(item.start);
    const end = new Date(item.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    events.push({ ...item, start, end });
  }
  return events;
}

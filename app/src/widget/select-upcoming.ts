// Pure selection logic for the agenda widget — no tsdav/expo imports.
import type { CalEvent } from '@/caldav/types';

import type { WidgetEvent } from './types';

/** How many events the widget shows. */
export const UPCOMING_LIMIT = 10;

/**
 * The next `limit` events at `now`: anything still in progress or starting
 * later, ordered by start. `end > now` is the correct liveness test for both
 * kinds — CalEvent's all-day `end` is already the exclusive midnight boundary.
 */
export function selectUpcoming(
  events: CalEvent[],
  now: Date,
  limit: number = UPCOMING_LIMIT
): CalEvent[] {
  return events
    .filter((e) => e.end.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, limit);
}

/** CalEvent → JSON-safe widget snapshot. */
export function toWidgetEvent(e: CalEvent): WidgetEvent {
  return {
    summary: e.summary,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    ...(e.location ? { location: e.location } : {}),
  };
}

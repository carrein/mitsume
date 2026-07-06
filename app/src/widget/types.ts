/**
 * Data shapes for the Android agenda widget. Events are cached as a slim,
 * JSON-safe snapshot (dates as ISO strings, no ICS payload) so the last-good
 * file stays small across headless runs.
 */

/** One upcoming event as the widget renders it. */
export type WidgetEvent = {
  summary: string;
  /** ISO timestamp. */
  start: string;
  /** ISO timestamp; exclusive boundary for all-day events (like CalEvent). */
  end: string;
  allDay: boolean;
  location?: string;
};

/** Last successful fetch, persisted between headless widget runs. */
export type WidgetCache = {
  events: WidgetEvent[];
  /** ISO timestamp of the fetch — rendered as the "↻ HH:MM" freshness hint. */
  fetchedAt: string;
};

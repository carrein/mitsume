/** A concrete, UI-facing calendar event (one occurrence for a recurring series). */
export type CalEvent = {
  /** Stable key for lists/markers: `uid:occurrenceStart` (recurrence-safe). */
  id: string;
  /** CalDAV object URL — used for update/delete. */
  url: string;
  /** Object etag — sent as If-Match on update/delete. */
  etag: string;
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  description?: string;
  /** The event's `URL` property (meeting link etc.) — NOT the CalDAV object URL. */
  link?: string;
  /** CONFERENCE / X-GOOGLE-CONFERENCE property — a joinable meeting URI. */
  conference?: string;
  /** True for occurrences of a recurring series (RRULE / RECURRENCE-ID). */
  recurring?: boolean;
  /** True when a reminder is armed (the VEVENT carries a VALARM). */
  alarm?: boolean;
  /** Original object ICS — required to edit while preserving unknown properties. */
  raw: string;
};

/** Fields for creating an event. */
export type EventInput = {
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  description?: string;
};

/**
 * Editable fields (whole-series; single-occurrence editing is deferred). Include only
 * fields that actually changed — untouched properties (e.g. an Apple TZID DTSTART)
 * are then left byte-identical. `allDay` describes how start/end should be written
 * and must be set whenever start/end are present.
 */
export type EventChanges = Partial<
  Pick<
    EventInput,
    'summary' | 'start' | 'end' | 'location' | 'description' | 'allDay'
  >
>;

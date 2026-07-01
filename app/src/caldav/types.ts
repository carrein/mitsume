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

/** Editable fields (whole-series; single-occurrence editing is deferred). */
export type EventChanges = Partial<
  Pick<EventInput, 'summary' | 'start' | 'end' | 'location' | 'description'>
>;

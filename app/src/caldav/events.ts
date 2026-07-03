// High-level CalDAV event API used by the UI. Online-first: every call talks to
// Radicale (no local cache yet); writes use If-Match (etag) for lost-update safety.
import * as Crypto from 'expo-crypto';

import { getClient, getDefaultCalendar } from './client';
import { buildEventICS, editPreserving, expandEvents } from './ics';
import type { CalEvent, EventChanges, EventInput } from './types';

/** Server rejected the write because the object changed underneath us (HTTP 412). */
export class ConflictError extends Error {
  constructor() {
    super('Event changed on the server');
    this.name = 'ConflictError';
  }
}

function ensureOk(res: Response, action: string): void {
  if (res.status === 412) throw new ConflictError();
  if (!res.ok) throw new Error(`CalDAV ${action} failed (HTTP ${res.status})`);
}

/** Fetch + expand all events overlapping [rangeStart, rangeEnd). */
export async function fetchMonth(
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalEvent[]> {
  const client = await getClient();
  const calendar = await getDefaultCalendar();
  const objects = await client.fetchCalendarObjects({
    calendar,
    timeRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
  });

  const events: CalEvent[] = [];
  for (const obj of objects) {
    if (!obj.data) continue;
    events.push(
      ...expandEvents(obj.data, obj.url, obj.etag ?? '', rangeStart, rangeEnd)
    );
  }
  return events;
}

export async function createEvent(input: EventInput): Promise<void> {
  const client = await getClient();
  const calendar = await getDefaultCalendar();
  const uid = Crypto.randomUUID();
  const res = await client.createCalendarObject({
    calendar,
    filename: `${uid}.ics`, // Radicale keys the object by filename
    iCalString: buildEventICS(input, uid),
  });
  ensureOk(res, 'create');
}

export async function updateEvent(
  event: CalEvent,
  changes: EventChanges
): Promise<void> {
  const client = await getClient();
  const res = await client.updateCalendarObject({
    calendarObject: {
      url: event.url,
      data: editPreserving(event.raw, changes), // preserves unknown props
      etag: event.etag, // If-Match → 412 on concurrent change
    },
  });
  ensureOk(res, 'update');
}

/** Hard delete. For a recurring event this removes the whole series (first cut). */
export async function deleteEvent(event: CalEvent): Promise<void> {
  const client = await getClient();
  const res = await client.deleteCalendarObject({
    calendarObject: { url: event.url, etag: event.etag },
  });
  ensureOk(res, 'delete');
}

/** Undo for a hard delete: re-PUT the original ICS under the original UID. */
export async function restoreEvent(event: CalEvent): Promise<void> {
  const client = await getClient();
  const calendar = await getDefaultCalendar();
  const res = await client.createCalendarObject({
    calendar,
    filename: `${event.uid}.ics`,
    iCalString: event.raw,
  });
  ensureOk(res, 'restore');
}

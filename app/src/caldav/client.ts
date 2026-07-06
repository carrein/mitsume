import { DAVClient, type DAVCalendar } from 'tsdav';

import { DAV } from '@/config';

// Lazily-created, cached CalDAV client + default calendar. Online-first: a single
// logged-in client is reused across calls. A failed connect resets the cache so the
// next call retries rather than replaying a rejected promise.
let clientPromise: Promise<DAVClient> | null = null;
let calendarPromise: Promise<DAVCalendar> | null = null;

async function connect(): Promise<DAVClient> {
  // Credential-less by default — the reverse proxy injects Authorization on
  // /dav/* (verified: tsdav completes the full round-trip with empty
  // credentials). Username/password attach only when provided (dev fallback
  // pointing straight at Radicale).
  const hasCreds = Boolean(DAV.user && DAV.pass);
  const client = new DAVClient({
    serverUrl: DAV.url,
    credentials: hasCreds ? { username: DAV.user, password: DAV.pass } : {},
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
  await client.login(); // PROPFIND: discovers principal + calendar-home-set
  return client;
}

export function getClient(): Promise<DAVClient> {
  if (!clientPromise) {
    clientPromise = connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

export function getDefaultCalendar(): Promise<DAVCalendar> {
  if (!calendarPromise) {
    calendarPromise = getClient()
      .then(async (client) => {
        const calendars = await client.fetchCalendars();
        if (!calendars.length) throw new Error('No CalDAV calendars found');
        return calendars[0]; // single default calendar for the first cut
      })
      .catch((err) => {
        calendarPromise = null;
        throw err;
      });
  }
  return calendarPromise;
}

/** Drop cached connection (after a config change or auth failure). */
export function resetClient(): void {
  clientPromise = null;
  calendarPromise = null;
}

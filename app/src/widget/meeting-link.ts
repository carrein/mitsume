// Meeting-link discovery for the agenda widget. Pure string logic — no RN or
// tsdav imports — so it stays unit-testable offline.

/** Calendar apps happily store scheme-less URLs ('google.com'); ACTION_VIEW
 * needs a real scheme to resolve, so default to https. */
export function normalizeLink(link: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`;
}

/** Hosts whose URLs are joinable meetings (matched as host or subdomain). */
const MEETING_HOSTS = [
  'meet.google.com',
  'zoom.us',
  'teams.microsoft.com',
  'teams.live.com',
  'webex.com',
  'whereby.com',
  'meet.jit.si',
  'join.skype.com',
  'facetime.apple.com',
];

function hostOf(url: string): string {
  const stripped = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  return stripped.split(/[/?#]/, 1)[0].toLowerCase();
}

export function isMeetingLink(url: string): boolean {
  const host = hostOf(url);
  return MEETING_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"')\]]+/gi;

/**
 * The event's joinable meeting URL, if any. Sources, most-trusted first: the
 * CONFERENCE property (that is its whole purpose, any https value counts),
 * the URL property when it points at a known meeting host, then the first
 * meeting-host URL found in the description text.
 */
export function findMeetingLink(e: {
  conference?: string;
  link?: string;
  description?: string;
}): string | undefined {
  if (e.conference && /^https?:\/\//i.test(e.conference.trim())) {
    return e.conference.trim();
  }
  if (e.link) {
    const normalized = normalizeLink(e.link);
    if (isMeetingLink(normalized)) return normalized;
  }
  if (e.description) {
    for (const match of e.description.match(URL_IN_TEXT) ?? []) {
      const url = match.replace(/[.,;!?]+$/, '');
      if (isMeetingLink(url)) return url;
    }
  }
  return undefined;
}

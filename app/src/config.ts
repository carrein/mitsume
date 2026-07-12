import { Platform } from 'react-native';

import { resolveDavUrl } from '@/caldav/resolve-url';

// Radicale (CalDAV) connection. Credentials are SERVER-SIDE by design: the host
// Caddy injects Authorization on /dav/* (see docs/Deploy.md), so clients normally
// run credential-less and only need a URL.
//
// EXPO_PUBLIC_* env vars are Metro-inlined at build time; access must stay fully
// dotted (no destructuring / bracket access) or it won't be replaced.
//
// URL precedence: EXPO_PUBLIC_DAV_URL → (web only) `/dav/` on the page's own
// origin. Native builds must bake a URL (see app/.env.example).
// Username/password are an OPTIONAL dev fallback (e.g. Android dev straight at
// Radicale without a proxy) — when absent, requests carry no Authorization.

const rawUrl =
  process.env.EXPO_PUBLIC_DAV_URL ?? (Platform.OS === 'web' ? '/dav/' : '');

export const DAV = {
  url: resolveDavUrl(
    rawUrl,
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : null
  ),
  user: process.env.EXPO_PUBLIC_DAV_USER ?? '',
  pass: process.env.EXPO_PUBLIC_DAV_PASS ?? '',
};

/** Configured = a server URL exists. Credentials are never required client-side. */
export const davConfigured = Boolean(DAV.url);

// Notes backend (docs/Deploy.md §Notes backend): mitsume-sync (Yjs over
// websocket) and mitsume-blobs (image bytes by SHA-256), both authless behind
// the same origin. Functions, not consts: the web URLs derive from
// window.location at call time, and module scope also runs during static
// export (Node) where window doesn't exist.

/** Absolute websocket URL of the sync server, or null when unconfigured. */
export function notesSyncUrl(): string | null {
  const raw =
    process.env.EXPO_PUBLIC_SYNC_URL ?? (Platform.OS === 'web' ? '/sync' : '');
  if (!raw) return null;
  if (raw.startsWith('ws')) return raw;
  if (Platform.OS === 'web' && typeof window !== 'undefined')
    return window.location.origin.replace(/^http/, 'ws') + raw;
  return null;
}

/** Base URL for blob GET/HEAD/PUT/DELETE (trailing slash), or null. */
export function blobsBaseUrl(): string | null {
  const raw =
    process.env.EXPO_PUBLIC_BLOBS_URL ??
    (Platform.OS === 'web' ? '/blobs/' : '');
  if (!raw) return null;
  return raw.endsWith('/') ? raw : `${raw}/`;
}

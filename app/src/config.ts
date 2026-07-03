import { Platform } from 'react-native';

// Radicale (CalDAV) connection, read from EXPO_PUBLIC_* env vars (see .env.example).
// Metro inlines `process.env.EXPO_PUBLIC_*` at build time; access must stay fully
// dotted (no destructuring / bracket access) or it won't be replaced.

/**
 * The production web image bakes a RELATIVE url (`/dav/`) so one image works on any
 * host (same-origin behind Caddy). Resolve it against the page origin at runtime;
 * guarded because static export renders in Node where `window` doesn't exist.
 */
function resolveDavUrl(raw: string): string {
  if (
    Platform.OS === 'web' &&
    raw.startsWith('/') &&
    typeof window !== 'undefined'
  ) {
    return new URL(raw, window.location.origin).href;
  }
  return raw;
}

export const DAV = {
  url: resolveDavUrl(process.env.EXPO_PUBLIC_DAV_URL ?? ''),
  user: process.env.EXPO_PUBLIC_DAV_USER ?? '',
  pass: process.env.EXPO_PUBLIC_DAV_PASS ?? '',
};

/** True only when all three connection vars are present. UI shows a setup hint otherwise. */
export const davConfigured = Boolean(DAV.url && DAV.user && DAV.pass);

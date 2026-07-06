/**
 * Resolve the configured DAV base URL. Relative URLs (e.g. `/dav/`) resolve
 * against the page origin so one web build works on any host (same-origin
 * deployment behind Caddy). Pure — no react-native imports — so it stays
 * unit-testable under bun.
 */
export function resolveDavUrl(raw: string, origin: string | null): string {
  if (raw.startsWith('/') && origin) return new URL(raw, origin).href;
  return raw;
}

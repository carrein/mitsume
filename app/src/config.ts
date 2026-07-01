// Radicale (CalDAV) connection, read from EXPO_PUBLIC_* env vars (see .env.example).
// Metro inlines `process.env.EXPO_PUBLIC_*` at build time; access must stay fully
// dotted (no destructuring / bracket access) or it won't be replaced.
export const DAV = {
  url: process.env.EXPO_PUBLIC_DAV_URL ?? '',
  user: process.env.EXPO_PUBLIC_DAV_USER ?? '',
  pass: process.env.EXPO_PUBLIC_DAV_PASS ?? '',
};

/** True only when all three connection vars are present. UI shows a setup hint otherwise. */
export const davConfigured = Boolean(DAV.url && DAV.user && DAV.pass);

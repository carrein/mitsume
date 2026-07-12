// Generic last-good JSON snapshots, one file per key in the document
// directory. Hermes has no IndexedDB, so native stores plain files (web
// override: snapshot-cache.web.ts). Values must be JSON-serializable — the
// native side stringifies, so Dates etc. must be encoded by the caller.
// Best-effort on both sides: a miss or failed write only costs freshness.
import { File, Paths } from 'expo-file-system';

const fileFor = (key: string) =>
  new File(
    Paths.document,
    `snapshot-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}.json`
  );

/** Read a snapshot; null when missing or unreadable. */
export async function readSnapshot<T>(key: string): Promise<T | null> {
  try {
    return JSON.parse(await fileFor(key).text()) as T;
  } catch {
    return null;
  }
}

/** Fire-and-forget write; the next successful write overwrites. */
export function writeSnapshot(key: string, value: unknown): void {
  try {
    fileFor(key).write(JSON.stringify(value));
  } catch {
    // Not worth surfacing — the cache only ever costs freshness.
  }
}

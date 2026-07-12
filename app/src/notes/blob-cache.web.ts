import { openDB, type IDBPDatabase } from 'idb';

/**
 * Local blob cache + upload queue in one IndexedDB store, keyed by SHA-256.
 * `uploaded: false` IS the pending-upload queue — one store means the queue
 * and the bytes can never disagree. The server remains the source of truth;
 * this cache exists for instant rendering and offline work.
 */

export type CachedBlob = { blob: Blob; uploaded: boolean; createdAt: number };

const DB_NAME = 'mitsume-blobs';
const STORE = 'blobs';

let dbPromise: Promise<IDBPDatabase> | null = null;
const db = () =>
  (dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore(STORE);
    },
  }));

/**
 * Session-only copies of deleted blobs. Deleting an image removes its bytes
 * from IndexedDB and the server immediately (user decision), but ctrl+Z can
 * restore the item — reads fall through to this trash and resurrect the blob
 * as pending-upload. Closing the tab makes deletion final.
 */
const sessionTrash = new Map<string, CachedBlob>();

export async function putBlob(
  hash: string,
  blob: Blob,
  uploaded: boolean
): Promise<void> {
  await (
    await db()
  ).put(
    STORE,
    { blob, uploaded, createdAt: Date.now() } satisfies CachedBlob,
    hash
  );
}

/** Read a blob; a hit in the session trash resurrects it as pending-upload. */
export async function getBlob(hash: string): Promise<CachedBlob | undefined> {
  const record = (await (await db()).get(STORE, hash)) as
    | CachedBlob
    | undefined;
  if (record) return record;
  const trashed = sessionTrash.get(hash);
  if (!trashed) return undefined;
  sessionTrash.delete(hash);
  const resurrected: CachedBlob = { ...trashed, uploaded: false };
  await putBlob(hash, resurrected.blob, false);
  return resurrected;
}

export async function markUploaded(hash: string): Promise<void> {
  const d = await db();
  const record = (await d.get(STORE, hash)) as CachedBlob | undefined;
  if (record && !record.uploaded)
    await d.put(STORE, { ...record, uploaded: true }, hash);
}

/** Move a blob out of the cache into the session trash (undo window). */
export async function removeBlob(hash: string): Promise<void> {
  const d = await db();
  const record = (await d.get(STORE, hash)) as CachedBlob | undefined;
  if (record) sessionTrash.set(hash, record);
  await d.delete(STORE, hash);
}

/** Hashes still waiting to reach the server. */
export async function pendingHashes(): Promise<string[]> {
  const d = await db();
  const pending: string[] = [];
  let cursor = await d.transaction(STORE).store.openCursor();
  while (cursor) {
    if (!(cursor.value as CachedBlob).uploaded)
      pending.push(String(cursor.key));
    cursor = await cursor.continue();
  }
  return pending;
}

let persistRequested = false;
/** Ask the browser not to evict our storage under disk pressure (best effort). */
export function requestDurableStorage(): void {
  if (persistRequested || typeof navigator === 'undefined') return;
  persistRequested = true;
  navigator.storage
    ?.persist?.()
    .then((granted) => {
      if (!granted)
        console.warn(
          'mitsume: durable storage not granted (best-effort cache mode)'
        );
    })
    .catch(() => {});
}

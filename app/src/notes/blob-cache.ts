/**
 * Native fallback: in-memory only (no IndexedDB on Hermes). Remote blobs
 * render via direct URLs (see blob-source.ts), so this cache is barely used
 * on native in V1 — it exists to keep shared code platform-agnostic.
 */

export type CachedBlob = { blob: Blob; uploaded: boolean; createdAt: number };

const memory = new Map<string, CachedBlob>();

export async function putBlob(
  hash: string,
  blob: Blob,
  uploaded: boolean
): Promise<void> {
  memory.set(hash, { blob, uploaded, createdAt: Date.now() });
}

export async function getBlob(hash: string): Promise<CachedBlob | undefined> {
  return memory.get(hash);
}

export async function markUploaded(hash: string): Promise<void> {
  const record = memory.get(hash);
  if (record) record.uploaded = true;
}

export async function removeBlob(hash: string): Promise<void> {
  memory.delete(hash);
}

export async function pendingHashes(): Promise<string[]> {
  return [...memory.entries()].filter(([, r]) => !r.uploaded).map(([h]) => h);
}

export function requestDurableStorage(): void {}

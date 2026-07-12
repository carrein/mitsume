import { blobsBaseUrl } from '@/config';

import { backoffDelayMs } from './backoff';
import { getBlob, markUploaded, pendingHashes } from './blob-cache';

/**
 * Foreground upload drain — no service worker by design (Background Sync is
 * Chromium-only). Triggers: uploader start, the `online` event (a hint, never
 * a gate — fetch outcome is the truth), tab becoming visible, after each
 * paste, and a slow interval. Per-hash exponential backoff with jitter;
 * HEAD-then-PUT for dedup; a post-PUT HEAD length check catches webdav's
 * non-atomic truncated writes.
 */

const backoff = new Map<string, { attempt: number; until: number }>();
let draining = false;
let started = false;

const blobUrl = (hash: string): string | null => {
  const base = blobsBaseUrl();
  return base ? `${base}${hash}` : null;
};

/** Upload one pending blob. Returns true when the server has it. */
async function uploadOne(hash: string): Promise<boolean> {
  const url = blobUrl(hash);
  if (!url) return false;
  const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
  if (head.ok) return true; // dedup: an identical blob already uploaded
  if (head.status !== 404) throw new Error(`HEAD ${head.status}`);
  const record = await getBlob(hash);
  if (!record) return false; // nothing to upload (deleted meanwhile)
  const put = await fetch(url, { method: 'PUT', body: record.blob });
  if (!put.ok) throw new Error(`PUT ${put.status}`);
  const verify = await fetch(url, { method: 'HEAD', cache: 'no-store' });
  if (!verify.ok) throw new Error('blob missing after PUT');
  const length = Number(verify.headers.get('content-length'));
  if (length !== record.blob.size)
    throw new Error(`truncated PUT (${length} != ${record.blob.size})`);
  return true;
}

/** Push every pending blob to the server; safe to call at any time. */
export async function drainUploads(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    for (const hash of await pendingHashes()) {
      const state = backoff.get(hash);
      if (state && Date.now() < state.until) continue;
      try {
        if (await uploadOne(hash)) {
          await markUploaded(hash);
          backoff.delete(hash);
        }
      } catch {
        const attempt = (state?.attempt ?? 0) + 1;
        backoff.set(hash, {
          attempt,
          until: Date.now() + backoffDelayMs(attempt),
        });
      }
    }
  } finally {
    draining = false;
  }
}

/** Install drain triggers (idempotent) and kick an initial drain. */
export function startUploader(): void {
  if (started) return;
  started = true;
  window.addEventListener('online', () => void drainUploads());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void drainUploads();
  });
  setInterval(() => void drainUploads(), 60_000);
  void drainUploads();
}

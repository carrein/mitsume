import { blobsBaseUrl } from '@/config';

import { getBlob, putBlob } from './blob-cache';

/**
 * Read path for rendering: local cache first, then the blob server (the
 * response is written back so the image works offline afterwards). Object
 * URLs are refcounted per hash — items pasted twice share one URL, and the
 * URL is revoked when the last canvas item using it unmounts.
 */

const urls = new Map<string, { url: string; refs: number }>();

export async function acquireBlobUrl(hash: string): Promise<string | null> {
  const cached = urls.get(hash);
  if (cached) {
    cached.refs += 1;
    return cached.url;
  }
  let record = await getBlob(hash);
  if (!record) {
    const base = blobsBaseUrl();
    if (!base) return null;
    const res = await fetch(`${base}${hash}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    await putBlob(hash, blob, true); // came FROM the server — not pending
    record = { blob, uploaded: true, createdAt: Date.now() };
  }
  // Another acquire may have won while we awaited — share its URL.
  const raced = urls.get(hash);
  if (raced) {
    raced.refs += 1;
    return raced.url;
  }
  const url = URL.createObjectURL(record.blob);
  urls.set(hash, { url, refs: 1 });
  return url;
}

export function releaseBlobUrl(hash: string): void {
  const entry = urls.get(hash);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    URL.revokeObjectURL(entry.url);
    urls.delete(hash);
  }
}

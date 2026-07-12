// Last-good snapshot for the agenda widget — lets a headless run render
// something when the tailnet is unreachable. Stored via the generic
// snapshot-cache (a JSON file on Android); best-effort on both sides:
// failures only cost freshness.
import { readSnapshot, writeSnapshot } from '@/utils/snapshot-cache';

import type { WidgetCache } from './types';

const KEY = 'widget-agenda';

/** Read the cache; null when missing, unreadable, or not the expected shape. */
export async function readWidgetCache(): Promise<WidgetCache | null> {
  const cache = await readSnapshot<WidgetCache>(KEY);
  return Array.isArray(cache?.events) && typeof cache?.fetchedAt === 'string'
    ? cache
    : null;
}

export function writeWidgetCache(cache: WidgetCache): void {
  writeSnapshot(KEY, cache);
}

// Last-good snapshot for the agenda widget, one JSON file in the document
// directory — lets a headless run render something when the tailnet is
// unreachable. Best-effort on both sides: failures only cost freshness.
import { File, Paths } from 'expo-file-system';

import type { WidgetCache } from './types';

const cacheFile = () => new File(Paths.document, 'widget-agenda.json');

/** Read the cache; null when missing, unreadable, or not the expected shape. */
export async function readWidgetCache(): Promise<WidgetCache | null> {
  try {
    const parsed: unknown = JSON.parse(await cacheFile().text());
    const cache = parsed as WidgetCache;
    return Array.isArray(cache?.events) && typeof cache?.fetchedAt === 'string'
      ? cache
      : null;
  } catch {
    return null;
  }
}

export function writeWidgetCache(cache: WidgetCache): void {
  try {
    cacheFile().write(JSON.stringify(cache));
  } catch {
    // Next successful run overwrites; a failed write is not worth surfacing.
  }
}

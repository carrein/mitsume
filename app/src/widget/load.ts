// Fetch→cache pipeline shared by the headless task handler and the app-side
// refresh: fresh data when the server answers, last-good snapshot otherwise.
import { davConfigured } from '@/config';

import { readWidgetCache, writeWidgetCache } from './cache';
import { fetchUpcoming } from './fetch-upcoming';
import type { WidgetCache } from './types';

export async function loadAgendaCache(): Promise<WidgetCache | null> {
  if (davConfigured) {
    try {
      const now = new Date();
      const cache: WidgetCache = {
        events: await fetchUpcoming(now),
        fetchedAt: now.toISOString(),
      };
      writeWidgetCache(cache);
      return cache;
    } catch {
      // Off-tailnet or server down — fall back to the last-good snapshot.
    }
  }
  return readWidgetCache();
}

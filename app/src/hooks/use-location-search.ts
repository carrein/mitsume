import { useEffect, useState } from 'react';

import { MIN_QUERY_LENGTH, searchLocations } from '@/location/photon';

const DEBOUNCE_MS = 250;

/**
 * Debounced Photon suggestions for the location field. Empty array whenever
 * the query is short, matches a picked value, or the network is unhappy —
 * the field then behaves as plain text.
 */
export function useLocationSearch(query: string, enabled: boolean): string[] {
  // Results are tagged with the query they answered; staleness falls out of
  // the comparison instead of a generation counter + sync clears.
  const [result, setResult] = useState<{ query: string; labels: string[] }>({
    query: '',
    labels: [],
  });

  useEffect(() => {
    if (!enabled || query.trim().length < MIN_QUERY_LENGTH) return;
    const timer = setTimeout(async () => {
      const labels = await searchLocations(query);
      setResult({ query, labels });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, enabled]);

  return enabled && result.query === query ? result.labels : [];
}

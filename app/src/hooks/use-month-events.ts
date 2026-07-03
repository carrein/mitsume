import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchMonth } from '@/caldav/events';
import type { CalEvent } from '@/caldav/types';
import { davConfigured } from '@/config';
import { monthFetchRange } from '@/utils/date';

/**
 * Online-first month window: fetches events for the visible month (± grid overflow)
 * and exposes a manual refresh. A sequence guard drops stale responses when the
 * user pages months faster than the network answers.
 */
export function useMonthEvents(visibleMonth: Date) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(davConfigured);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const monthKey = `${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`;

  const refresh = useCallback(async () => {
    if (!davConfigured) return;
    const ticket = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const { start, end } = monthFetchRange(visibleMonth);
      const result = await fetchMonth(start, end);
      if (seq.current !== ticket) return; // stale response — a newer request is in flight
      setEvents(result);
    } catch (err) {
      if (seq.current !== ticket) return;
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reach the calendar server'
      );
    } finally {
      if (seq.current === ticket) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- monthKey stands in for visibleMonth identity
  }, [monthKey]);

  useEffect(() => {
    // Online-first by design (no cache/store to subscribe to yet): fetching on mount
    // and on month change IS the synchronization with the external system (Radicale).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { events, loading, error, refresh };
}

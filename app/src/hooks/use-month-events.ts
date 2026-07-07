import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { fetchMonth } from '@/caldav/events';
import type { CalEvent } from '@/caldav/types';
import { davConfigured } from '@/config';
import { monthFetchRange } from '@/utils/date';
import { refreshAgendaWidget } from '@/widget/app-refresh';

/** Poll cadence while the view is actually visible (zero network when hidden). */
const POLL_VISIBLE_MS = 60_000;

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

  useEffect(() => {
    // External writers (Apple Calendar, Etar, another tab) have no push channel
    // to us — decided: no WebSocket, HTTP pull only (widget plan §Field
    // debugging). So an open view revalidates on return-to-foreground and polls
    // gently while visible; hidden/backgrounded costs zero network. On web,
    // AppState maps to the Page Visibility API via react-native-web.
    if (!davConfigured) return;
    let interval: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };
    const startPolling = () => {
      stopPolling();
      interval = setInterval(refresh, POLL_VISIBLE_MS);
    };

    let lastRevalidate = 0;
    const revalidate = () => {
      // Focus + visibility can fire together on one return — refetch once.
      if (Date.now() - lastRevalidate < 5_000) return;
      lastRevalidate = Date.now();
      refresh();
      refreshAgendaWidget(); // foreground = the reliable widget trigger (no-op off-Android)
    };

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        revalidate();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling(); // mounted views start visible; the initial fetch is the effect above
    const subscription = AppState.addEventListener('change', onAppStateChange);
    // macOS Spaces/desktop switches never mark the tab hidden (no visibility
    // event) but do blur/focus the window — revalidate on focus too.
    const onWindowFocus = () => revalidate();
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      window.addEventListener('focus', onWindowFocus);
    }
    return () => {
      stopPolling();
      subscription.remove();
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        window.removeEventListener('focus', onWindowFocus);
      }
    };
  }, [refresh]);

  return { events, loading, error, refresh };
}

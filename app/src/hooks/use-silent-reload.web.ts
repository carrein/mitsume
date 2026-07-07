// Silent version swap for the web app: compare this bundle's baked version
// against the deployed /version.json (stamped by the Dockerfile) and reload —
// but ONLY while the tab is hidden, so the swap can never interrupt input.
// User-accepted UX (2026-07-07): leave the tab on v0.2.5, come back to v0.2.6.
import Constants from 'expo-constants';
import { useEffect } from 'react';

/** Hidden-tab timers are throttled by browsers; the hide-event check is primary. */
const CHECK_INTERVAL_MS = 5 * 60_000;

export function useSilentReload(): void {
  useEffect(() => {
    const current = Constants.expoConfig?.version;
    if (!current) return;

    let stale = false;
    const reloadIfSafe = () => {
      if (stale && document.hidden) window.location.reload();
    };
    const check = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        const { version } = (await res.json()) as { version?: string };
        stale = Boolean(version) && version !== current;
        reloadIfSafe();
      } catch {
        // Dev server / offline: no version.json — nothing to do.
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        reloadIfSafe(); // known-stale: swap immediately on hide
        check(); // otherwise look for one while hidden
      }
    };

    const interval = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}

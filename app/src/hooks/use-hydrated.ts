import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * False during server render and the hydration pass, true afterwards (and from
 * the first render on native, where there is no hydration). Lets components
 * render a placeholder that matches the static HTML, then swap once the real
 * environment (window size, color scheme) is readable.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

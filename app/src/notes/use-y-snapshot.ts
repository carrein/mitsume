import { useCallback, useRef, useSyncExternalStore } from 'react';

/** The slice of a Yjs shared type this hook needs (method-bivariant on purpose). */
type YObservable = {
  observeDeep(handler: () => void): void;
  unobserveDeep(handler: () => void): void;
  toJSON(): unknown;
};

/**
 * Subscribe a component to a Yjs shared type and read it as plain JSON.
 * The snapshot is cached and only invalidated by the deep observer —
 * useSyncExternalStore requires referential stability between changes
 * (a fresh toJSON() per getSnapshot call would render-loop forever).
 */
export function useYSnapshot<T>(type: YObservable): T {
  const cache = useRef<{ snap: T } | null>(null);
  const subscribe = useCallback(
    (onChange: () => void) => {
      const handler = () => {
        cache.current = null;
        onChange();
      };
      type.observeDeep(handler);
      return () => type.unobserveDeep(handler);
    },
    [type]
  );
  const getSnapshot = useCallback((): T => {
    if (cache.current === null) cache.current = { snap: type.toJSON() as T };
    return cache.current.snap;
  }, [type]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

import { useEffect } from 'react';

import type { RefObject } from 'react';
import type { View } from 'react-native';

/**
 * DOM wheel listener on a RN Web view — there is no RN onWheel prop. On RNW
 * 0.21 the host ref IS the underlying HTMLElement. `passive: false` so the
 * handler may preventDefault (page scroll AND the browser's own ctrl+wheel
 * pinch-zoom must not fire while over the canvas).
 */
export function useWheel(
  ref: RefObject<View | null>,
  onWheel: (e: WheelEvent) => void
): void {
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, onWheel]);
}

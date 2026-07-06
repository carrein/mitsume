import { useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';

import { WideLayoutMinWidth } from '@/constants/theme';

const emptySubscribe = () => () => {};

/**
 * Whether the window is wide enough for the side-by-side layout. Reports
 * narrow until hydration so the client's first render matches the static
 * HTML (same pattern as use-color-scheme.web.ts).
 */
export function useIsWide() {
  const hasHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const { width } = useWindowDimensions();

  return hasHydrated && width >= WideLayoutMinWidth;
}

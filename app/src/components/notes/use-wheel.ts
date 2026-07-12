import type { RefObject } from 'react';
import type { View } from 'react-native';

/**
 * Native twin of use-wheel.web.ts: no wheels on touch devices. Signature
 * matches the web version exactly — tsc resolves this file for callers.
 */
export function useWheel(
  _ref: RefObject<View | null>,
  _onWheel: (e: WheelEvent) => void
): void {}

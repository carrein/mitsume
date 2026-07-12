import type { SharedValue } from 'react-native-reanimated';

/**
 * The one in-flight settle animation (only a single item interacts at a
 * time): world-space rect shared values that ease from an item's free
 * released rect to its committed snapped rect. Owned by canvas-view.
 */
export type SettleRect = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
};

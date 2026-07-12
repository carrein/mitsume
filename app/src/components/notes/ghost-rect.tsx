import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { Rect } from '@/notes/canvas-math';
import type { SharedValue } from 'react-native-reanimated';

const GHOST_BORDER = 1.5;

/**
 * Faint dashed outline at the snapped landing spot while an item is being
 * dragged/resized (screen-space, like everything on the canvas).
 */
export function GhostRect({
  rect,
  tx,
  ty,
  zoom,
  color,
}: {
  rect: Rect;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  zoom: SharedValue<number>;
  color: string;
}) {
  const animated = useAnimatedStyle(() => {
    const z = zoom.value;
    return {
      width: rect.w * z,
      height: rect.h * z,
      transform: [
        { translateX: rect.x * z + tx.value },
        { translateY: rect.y * z + ty.value },
      ],
    };
  });
  return (
    <Animated.View style={[styles.ghost, { borderColor: color }, animated]} />
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: GHOST_BORDER,
    borderStyle: 'dashed',
    pointerEvents: 'none',
    // Between the items and the selection chrome.
    zIndex: 999_999,
  },
});

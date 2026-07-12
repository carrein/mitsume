import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { GRID } from '@/notes/canvas-math';
import { useTheme } from '@/hooks/use-theme';

import type { DotGridProps } from './dot-grid';
import type { ViewStyle } from 'react-native';

const DOT_RADIUS = 1.5;
const FADE_START_PX = 16;
const FADE_END_PX = 8;

/**
 * Web dot grid: one div whose CSS radial-gradient tile is driven per frame by
 * animated backgroundSize/backgroundPosition — the cheapest possible grid
 * (style-only mutation, no React re-render, no SVG repaint). The gradient dot
 * sits at the tile center, so the tile is offset by half a cell to land dots
 * exactly on world grid intersections.
 */
export function DotGrid({ tx, ty, zoom }: DotGridProps) {
  const theme = useTheme();

  const animated = useAnimatedStyle(() => {
    const s = GRID * zoom.value;
    const opacity =
      s >= FADE_START_PX
        ? 1
        : Math.max(0, (s - FADE_END_PX) / (FADE_START_PX - FADE_END_PX));
    const ox = ((tx.value % s) + s) % s;
    const oy = ((ty.value % s) + s) % s;
    return {
      opacity,
      backgroundSize: `${s}px ${s}px`,
      backgroundPosition: `${ox - s / 2}px ${oy - s / 2}px`,
    } as unknown as ViewStyle;
  });

  const gradient = {
    backgroundImage: `radial-gradient(circle, ${theme.backgroundSelected} ${DOT_RADIUS}px, transparent ${DOT_RADIUS + 0.5}px)`,
  } as unknown as ViewStyle;

  return <Animated.View style={[styles.grid, gradient, animated]} />;
}

const styles = StyleSheet.create({
  grid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
});

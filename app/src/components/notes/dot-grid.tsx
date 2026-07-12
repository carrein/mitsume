import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { GRID } from '@/notes/canvas-math';
import { useTheme } from '@/hooks/use-theme';

import type { SharedValue } from 'react-native-reanimated';

const DOT_RADIUS = 1.5;
/** Fade the grid out as cells shrink; fully gone below this screen spacing. */
const FADE_START_PX = 16;
const FADE_END_PX = 8;

export type DotGridProps = {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  zoom: SharedValue<number>;
};

/**
 * Native dot grid (web override: dot-grid.web.tsx renders an animated CSS
 * gradient instead). Screen-fixed SVG pattern — dots stay crisp at any zoom;
 * the camera shared values are mirrored into React state per frame, which is
 * the same per-event render cost the native canvas already pays for gestures.
 */
export function DotGrid({ tx, ty, zoom }: DotGridProps) {
  const theme = useTheme();
  const [cam, setCam] = useState(() => ({
    x: tx.value,
    y: ty.value,
    zoom: zoom.value,
  }));
  useAnimatedReaction(
    () => [tx.value, ty.value, zoom.value] as const,
    (v, prev) => {
      if (prev !== null) runOnJS(setCam)({ x: v[0], y: v[1], zoom: v[2] });
    }
  );

  const s = GRID * cam.zoom;
  const opacity =
    s >= FADE_START_PX
      ? 1
      : Math.max(0, (s - FADE_END_PX) / (FADE_START_PX - FADE_END_PX));
  if (opacity === 0) return null;
  // Shift the tile by the dot radius so dots aren't clipped at tile corners.
  const ox = ((cam.x % s) + s) % s;
  const oy = ((cam.y % s) + s) % s;
  return (
    <Svg width="100%" height="100%" style={styles.grid}>
      <Defs>
        <Pattern
          id="canvas-dots"
          x={ox - DOT_RADIUS}
          y={oy - DOT_RADIUS}
          width={s}
          height={s}
          patternUnits="userSpaceOnUse"
        >
          <Circle
            cx={DOT_RADIUS}
            cy={DOT_RADIUS}
            r={DOT_RADIUS}
            fill={theme.backgroundSelected}
            opacity={opacity}
          />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#canvas-dots)" />
    </Svg>
  );
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

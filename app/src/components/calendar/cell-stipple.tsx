import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

// Keep geometry/color in sync with cell-stipple.web.tsx.
const DOT_RADIUS = 1;
const TILE = 5;
const GREY = '#808080';
const OPACITY = 0.18;

/**
 * Grey-stipple wash marking out-of-month day cells (web override:
 * cell-stipple.web.tsx renders a repeating CSS gradient instead — no per-cell
 * SVG cost). Mid-grey at low opacity so it reads in both themes. Pattern ids
 * resolve within their own Svg root, so the fixed id is safe across cells.
 */
export function CellStipple() {
  return (
    <Svg
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <Pattern
          id="cell-stipple"
          x={0}
          y={0}
          width={TILE}
          height={TILE}
          patternUnits="userSpaceOnUse"
        >
          <Circle
            cx={DOT_RADIUS + 1}
            cy={DOT_RADIUS + 1}
            r={DOT_RADIUS}
            fill={GREY}
            fillOpacity={OPACITY}
          />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#cell-stipple)" />
    </Svg>
  );
}

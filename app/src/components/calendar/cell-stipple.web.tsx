import { StyleSheet, View, type ViewStyle } from 'react-native';

// Keep geometry/color in sync with cell-stipple.tsx (the native SVG version).
const DOT_RADIUS = 1;
const TILE = 5;
const DOT = `rgba(128, 128, 128, 0.18)`;

// RNW passes unrecognized camelCase style props through to CSS — a repeating
// radial gradient costs nothing per cell, unlike mounting an SVG in each.
const stipple = {
  backgroundImage: `radial-gradient(circle, ${DOT} ${DOT_RADIUS}px, transparent ${DOT_RADIUS + 0.5}px)`,
  backgroundSize: `${TILE}px ${TILE}px`,
} as unknown as ViewStyle;

/** Grey-stipple wash marking out-of-month day cells (web variant). */
export function CellStipple() {
  return (
    <View style={[StyleSheet.absoluteFill, stipple]} pointerEvents="none" />
  );
}

import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { AccentColor } from '@/constants/theme';

import type { Corner, Rect } from '@/notes/canvas-math';
import type { SettleRect } from './settle';
import type { SharedValue } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

/** Screen pixels — the chrome is positioned in screen space, so these are
 * naturally zoom-independent. */
const HANDLE_SIZE = 12;
/** Extra touch target around each handle (fingers need ~2× a mouse). */
const HANDLE_HIT_SLOP = 10;
const BORDER_WIDTH = 2;

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];

const webCursor = (cursor: string): ViewStyle | undefined =>
  Platform.OS === 'web' ? ({ cursor } as unknown as ViewStyle) : undefined;

/**
 * Selection border + corner resize handles, positioned in SCREEN space
 * (translate = world·zoom + t; width = w·zoom) as a SIBLING of the items —
 * nested GestureDetectors don't orchestrate on web, and screen space keeps
 * Android hit-testing honest. Border/handles are unscaled, so they stay
 * screen-constant at every zoom. Handlers must be referentially stable.
 */
export function SelectionChrome({
  rect,
  settling,
  settle,
  tx,
  ty,
  zoom,
  onBegin,
  onResizeBy,
  onEnd,
  onCancel,
}: {
  rect: Rect;
  settling: boolean;
  settle: SettleRect;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  zoom: SharedValue<number>;
  onBegin: () => void;
  onResizeBy: (corner: Corner, changeX: number) => void;
  onEnd: () => void;
  onCancel: () => void;
}) {
  const animated = useAnimatedStyle(() => {
    const z = zoom.value;
    const x = settling ? settle.x.value : rect.x;
    const y = settling ? settle.y.value : rect.y;
    const w = settling ? settle.w.value : rect.w;
    const h = settling ? settle.h.value : rect.h;
    return {
      width: w * z + 2 * BORDER_WIDTH,
      height: h * z + 2 * BORDER_WIDTH,
      transform: [
        { translateX: x * z + tx.value - BORDER_WIDTH },
        { translateY: y * z + ty.value - BORDER_WIDTH },
      ],
    };
  });

  return (
    <Animated.View style={[styles.chrome, animated]} pointerEvents="box-none">
      {CORNERS.map((corner) => (
        <CornerHandle
          key={corner}
          corner={corner}
          onBegin={onBegin}
          onResizeBy={onResizeBy}
          onEnd={onEnd}
          onCancel={onCancel}
        />
      ))}
    </Animated.View>
  );
}

function CornerHandle({
  corner,
  onBegin,
  onResizeBy,
  onEnd,
  onCancel,
}: {
  corner: Corner;
  onBegin: () => void;
  onResizeBy: (corner: Corner, changeX: number) => void;
  onEnd: () => void;
  onCancel: () => void;
}) {
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(1)
        .hitSlop(HANDLE_HIT_SLOP)
        .runOnJS(true)
        .onBegin(onBegin)
        .onChange((e) => onResizeBy(corner, e.changeX))
        .onEnd(onEnd)
        .onFinalize(onCancel),
    [corner, onBegin, onResizeBy, onEnd, onCancel]
  );

  const half = HANDLE_SIZE / 2;
  // Corner-anchored (left/right/top/bottom) so positions never depend on the
  // animated width/height.
  const position: ViewStyle = {
    ...(corner === 'nw' || corner === 'sw'
      ? { left: -half }
      : { right: -half }),
    ...(corner === 'nw' || corner === 'ne'
      ? { top: -half }
      : { bottom: -half }),
  };
  const cursor =
    corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.handle, position, webCursor(cursor)]}
        collapsable={false}
      />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  chrome: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: BORDER_WIDTH,
    borderColor: AccentColor,
    // Above every item (item zIndex = insertion order counter).
    zIndex: 1_000_000,
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    backgroundColor: AccentColor,
  },
});

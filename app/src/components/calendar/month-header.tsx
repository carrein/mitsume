import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { RefreshIcon } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { AccentColor, BrandColor, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** e.g. "July 2026" — tracks the visible month while scrolling. */
  label: string;
  /** year*12 + month0 of the visible month — orders labels so the slide
   *  direction matches the scroll direction. */
  monthIndex: number;
  /** Show a small spinner next to the label (initial fetch only). */
  loading: boolean;
  /** Spin the refresh icon (a button-pressed refresh is in flight). */
  refreshing: boolean;
  onToday: () => void;
  onRefresh: () => void;
};

/** Label slide-through when the visible month changes mid-scroll. */
const LABEL_FADE_OUT_MS = 100;
const LABEL_FADE_IN_MS = 160;
/** How far the label drifts while fading (px). */
const LABEL_SHIFT_PX = 10;

/** One full refresh-icon revolution. */
const SPIN_MS = 800;

/** Header bar above the month grid: the label (tap → today) and refresh. */
export function MonthHeader({
  label,
  monthIndex,
  loading,
  refreshing,
  onToday,
  onRefresh,
}: Props) {
  const theme = useTheme();

  // The displayed label trails the prop through a directional slide-fade:
  // scrolling to a later month carries the old label up and out and the new
  // one rises in from below (reversed for earlier months). A change landing
  // mid-animation retargets it, and the last-started exit's callback carries
  // the newest label (earlier ones are cancelled unfinished), so intermediate
  // months passed during a fast scroll are skipped, not queued.
  const [shown, setShown] = useState({ label, index: monthIndex });
  const labelOpacity = useSharedValue(1);
  const labelShift = useSharedValue(0);

  useEffect(() => {
    if (label !== shown.label) {
      const dir = monthIndex >= shown.index ? 1 : -1;
      labelShift.value = withTiming(-dir * LABEL_SHIFT_PX, {
        duration: LABEL_FADE_OUT_MS,
        easing: Easing.in(Easing.quad),
      });
      labelOpacity.value = withTiming(
        0,
        { duration: LABEL_FADE_OUT_MS, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (!finished) return;
          // Reposition to the entry side while invisible; the fade-in
          // branch below then animates it back to rest.
          labelShift.value = dir * LABEL_SHIFT_PX;
          runOnJS(setShown)({ label, index: monthIndex });
        }
      );
    } else {
      // Mount no-op (already at rest); after a swap, the entry animation.
      labelOpacity.value = withTiming(1, {
        duration: LABEL_FADE_IN_MS,
        easing: Easing.out(Easing.quad),
      });
      labelShift.value = withTiming(0, {
        duration: LABEL_FADE_IN_MS,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [label, monthIndex, shown, labelOpacity, labelShift]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: labelShift.value }],
  }));

  // Refresh-icon spin while a fetch is in flight — counterclockwise, the way
  // the glyph's arrow points.
  const spin = useSharedValue(0);
  useEffect(() => {
    if (!refreshing) return;
    spin.value = 0;
    spin.value = withRepeat(
      withTiming(-360, { duration: SPIN_MS, easing: Easing.linear }),
      -1
    );
    return () => {
      cancelAnimation(spin);
      spin.value = 0;
    };
  }, [refreshing, spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  return (
    <View style={styles.header}>
      <View style={styles.labelWrap}>
        <Pressable
          testID="calendar-today"
          onPress={onToday}
          hitSlop={8}
          accessibilityLabel="Go to today"
        >
          <Animated.View style={labelStyle}>
            <ThemedText
              type="subtitle"
              testID="calendar-header-label"
              style={styles.label}
            >
              {shown.label}
            </ThemedText>
          </Animated.View>
        </Pressable>
        {loading && <ActivityIndicator size="small" color={AccentColor} />}
      </View>
      <View style={styles.controls}>
        <Pressable onPress={onRefresh} hitSlop={8} accessibilityLabel="Refresh">
          <Animated.View style={spinStyle}>
            <RefreshIcon size={20} color={theme.textSecondary} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  label: {
    color: BrandColor,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});

import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthScreen } from '@/components/calendar/month-screen';
import { NotesScreen } from '@/components/notes/notes-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColor, Spacing } from '@/constants/theme';
import { useIsWide } from '@/hooks/use-is-wide';
import { useTheme } from '@/hooks/use-theme';

import {
  loadSplitRatio,
  PANE_FLEX,
  saveSplitRatio,
  snapCalendarFraction,
  type SplitRatio,
} from './split-ratio';

type Pane = 'notes' | 'calendar';

const webCursor = (cursor: string): ViewStyle | undefined =>
  Platform.OS === 'web' ? ({ cursor } as unknown as ViewStyle) : undefined;

/** While a divider drag is active the pointer routinely sits off the strip
 * (the layout jumps under it at each snap), so the element-level cursor
 * stops applying — pin it on the body for the drag's duration. */
function setBodyCursor(cursor: string | null) {
  if (Platform.OS !== 'web') return;
  document.body.style.cursor = cursor ?? '';
}

export function HomeScreen() {
  const isWide = useIsWide();
  const theme = useTheme();
  const [pane, setPane] = useState<Pane>('calendar');
  const { width } = useWindowDimensions();

  // Calendar-pane preset (1/2, 2/5, or 1/3 of the screen), dragged via the
  // divider and snapped live — see split-ratio.ts.
  const [split, setSplit] = useState<SplitRatio>(loadSplitRatio);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    saveSplitRatio(split);
  }, [split]);

  // Memoized so RNGH keeps the same gesture across re-renders (recreating it
  // mid-drag would detach the handler). `width` only changes outside a drag.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-4, 4])
        .failOffsetY([-12, 12])
        .hitSlop({ left: 8, right: 8 })
        .runOnJS(true)
        .onStart(() => {
          setDragging(true);
          setBodyCursor('col-resize');
        })
        .onChange((e) => {
          setSplit(snapCalendarFraction(1 - e.absoluteX / width));
        })
        .onFinalize(() => {
          setDragging(false);
          setBodyCursor(null);
        }),
    [width]
  );

  if (isWide) {
    return (
      <ThemedView style={styles.split}>
        <View style={{ flex: PANE_FLEX[split].notes }}>
          <NotesScreen />
        </View>
        <GestureDetector gesture={pan}>
          <View
            style={[styles.dividerHit, webCursor('col-resize')]}
            collapsable={false}
          >
            <View
              style={[
                styles.dividerLine,
                {
                  backgroundColor: dragging
                    ? BrandColor
                    : theme.backgroundSelected,
                },
              ]}
            />
          </View>
        </GestureDetector>
        <View style={{ flex: PANE_FLEX[split].calendar }}>
          <MonthScreen />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']}>
        <View style={styles.toggleRow}>
          <PaneButton
            label="Notes"
            active={pane === 'notes'}
            onPress={() => setPane('notes')}
          />
          <PaneButton
            label="Calendar"
            active={pane === 'calendar'}
            onPress={() => setPane('calendar')}
          />
        </View>
      </SafeAreaView>
      {pane === 'notes' ? <NotesScreen /> : <MonthScreen />}
    </ThemedView>
  );
}

function PaneButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedView
        type={active ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.paneButton}
      >
        <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  split: {
    flex: 1,
    flexDirection: 'row',
  },
  // Grabbable strip over the hairline: 12px of hit area, zero net row width
  // (so the flex fractions stay exact), painted above both pane siblings.
  dividerHit: {
    width: 12,
    marginHorizontal: -6,
    zIndex: 10,
    alignItems: 'center',
  },
  dividerLine: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
  },
  container: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  paneButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.one,
  },
});

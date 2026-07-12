import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
} from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { AccentColor, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** e.g. "July 2026" — tracks the visible month while scrolling. */
  label: string;
  /** Show a small spinner next to the label (initial fetch only). */
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onRefresh: () => void;
};

/** Header bar above the month grid: label, refresh, chevrons, Today. */
export function MonthHeader({
  label,
  loading,
  onPrev,
  onNext,
  onToday,
  onRefresh,
}: Props) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.labelWrap}>
        <ThemedText type="subtitle" testID="calendar-header-label">
          {label}
        </ThemedText>
        {loading && <ActivityIndicator size="small" color={AccentColor} />}
      </View>
      <View style={styles.controls}>
        <Pressable onPress={onRefresh} hitSlop={8} accessibilityLabel="Refresh">
          <RefreshIcon size={16} color={theme.textSecondary} />
        </Pressable>
        <Pressable
          testID="calendar-prev"
          onPress={onPrev}
          hitSlop={8}
          accessibilityLabel="Previous month"
        >
          <ChevronLeftIcon size={20} color={theme.text} />
        </Pressable>
        <Pressable
          testID="calendar-today"
          onPress={onToday}
          hitSlop={8}
          accessibilityLabel="Go to today"
        >
          <ThemedText type="smallBold" style={styles.today}>
            Today
          </ThemedText>
        </Pressable>
        <Pressable
          testID="calendar-next"
          onPress={onNext}
          hitSlop={8}
          accessibilityLabel="Next month"
        >
          <ChevronRightIcon size={20} color={theme.text} />
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
  today: {
    color: AccentColor,
  },
});

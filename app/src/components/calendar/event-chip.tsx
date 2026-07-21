import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { CalEvent } from '@/caldav/types';
import { ThemedText } from '@/components/themed-text';
import { AccentColor, Spacing } from '@/constants/theme';
import type { BannerPlacement } from '@/utils/calendar-grid';
import { readableTextColor } from '@/utils/color';
import { toTimeString } from '@/utils/date';

type ChipProps = {
  event: CalEvent;
  /** Show the start time — only when cells are wide enough to afford it. */
  showTime: boolean;
  /** Title lines the layout granted this chip; >1 renders the stacked form. */
  titleLines: number;
  /** Absolute slot position, supplied by the week row. */
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
};

/**
 * A single-day timed event inside a day cell: accent bar + content. With the
 * time shown it always stacks — time on its own line, title under it wrapping
 * to the granted lines. Without a time it's the title alone, wrapping only
 * when granted extra lines.
 */
export function EventChip({
  event,
  showTime,
  titleLines,
  style,
  onPress,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, style]}
      testID={`chip-${event.id}`}
    >
      {/* Accent bar tinted by the source calendar (falls back to the theme accent). */}
      <View
        style={[
          styles.chipBar,
          { backgroundColor: event.color ?? AccentColor },
        ]}
      />
      {showTime ? (
        <View style={styles.chipStack}>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.chipTime}
          >
            {toTimeString(event.start)}
          </ThemedText>
          <ThemedText
            type="small"
            numberOfLines={titleLines}
            style={styles.chipTitleWrapped}
          >
            {event.summary || '(untitled)'}
          </ThemedText>
        </View>
      ) : titleLines > 1 ? (
        <View style={styles.chipStack}>
          <ThemedText
            type="small"
            numberOfLines={titleLines}
            style={styles.chipTitleWrapped}
          >
            {event.summary || '(untitled)'}
          </ThemedText>
        </View>
      ) : (
        <ThemedText type="small" numberOfLines={1} style={styles.chipTitle}>
          {event.summary || '(untitled)'}
        </ThemedText>
      )}
    </Pressable>
  );
}

type BannerProps = {
  placement: BannerPlacement<CalEvent>;
  /** Title lines the layout granted this banner (>1 when it wraps). */
  titleLines: number;
  /** Absolute slot position + horizontal extent, supplied by the week row. */
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
};

/**
 * An all-day/multi-day event drawn as one filled bar across its covered day
 * cells — flush left, inset a hairline on the right so the end cell's border
 * stays visible. Past a week edge the event continues over, it bleeds to the
 * pane edge instead.
 */
export function EventBanner({
  placement,
  titleLines,
  style,
  onPress,
}: BannerProps) {
  const { event, continuesRight } = placement;
  // Fill by source calendar; title contrasts against whatever that fill is.
  const fill = event.color ?? AccentColor;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.banner,
        { backgroundColor: fill },
        continuesRight && styles.bannerContinuesRight,
        style,
      ]}
    >
      <ThemedText
        type="small"
        numberOfLines={titleLines}
        style={[styles.bannerTitle, { color: readableTextColor(fill) }]}
      >
        {event.summary || '(untitled)'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingRight: 3,
  },
  chipBar: {
    width: 3,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  chipStack: {
    flex: 1,
  },
  chipTitle: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
  },
  chipTitleWrapped: {
    fontSize: 11,
    lineHeight: 14,
  },
  chipTime: {
    fontSize: 10,
    lineHeight: 12,
  },
  banner: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
    marginRight: StyleSheet.hairlineWidth,
  },
  bannerContinuesRight: {
    marginRight: 0,
  },
  bannerTitle: {
    fontSize: 11,
    lineHeight: 14,
  },
});

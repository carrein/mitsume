import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { CalEvent } from '@/caldav/types';
import { ThemedText } from '@/components/themed-text';
import { AccentColor, OnAccentColor, Spacing } from '@/constants/theme';
import type { BannerPlacement } from '@/utils/calendar-grid';
import { toTimeString } from '@/utils/date';

type ChipProps = {
  event: CalEvent;
  /** Right-aligned start time — only when cells are wide enough to afford it. */
  showTime: boolean;
  /** Absolute slot position, supplied by the week row. */
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
};

/** A single-day timed event inside a day cell: accent bar + truncated title. */
export function EventChip({ event, showTime, style, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, style]}
      testID={`chip-${event.id}`}
    >
      <View style={styles.chipBar} />
      <ThemedText type="small" numberOfLines={1} style={styles.chipTitle}>
        {event.summary || '(untitled)'}
      </ThemedText>
      {showTime && (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.chipTime}
        >
          {toTimeString(event.start)}
        </ThemedText>
      )}
    </Pressable>
  );
}

type BannerProps = {
  placement: BannerPlacement<CalEvent>;
  /** Absolute slot position + horizontal span, supplied by the week row. */
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
};

/**
 * An all-day/multi-day event drawn as one filled bar across its covered day
 * cells. A week edge the event continues past renders squared-off.
 */
export function EventBanner({ placement, style, onPress }: BannerProps) {
  const { event, continuesLeft, continuesRight } = placement;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.banner,
        continuesLeft && styles.bannerContinuesLeft,
        continuesRight && styles.bannerContinuesRight,
        style,
      ]}
    >
      <ThemedText type="small" numberOfLines={1} style={styles.bannerTitle}>
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
    paddingLeft: 2,
    paddingRight: 3,
    borderRadius: Spacing.one,
  },
  chipBar: {
    width: 3,
    borderRadius: 1,
    alignSelf: 'stretch',
    marginVertical: 2,
    backgroundColor: AccentColor,
  },
  chipTitle: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
  },
  chipTime: {
    fontSize: 10,
    lineHeight: 12,
  },
  banner: {
    backgroundColor: AccentColor,
    borderRadius: Spacing.one,
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
    marginHorizontal: 1,
  },
  bannerContinuesLeft: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    marginLeft: 0,
  },
  bannerContinuesRight: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    marginRight: 0,
  },
  bannerTitle: {
    color: OnAccentColor,
    fontSize: 11,
    lineHeight: 14,
  },
});

import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CalEvent } from '@/caldav/types';
import { CellStipple } from '@/components/calendar/cell-stipple';
import { EventBanner, EventChip } from '@/components/calendar/event-chip';
import { ThemedText } from '@/components/themed-text';
import { AccentColor, OnAccentColor, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, layoutWeek } from '@/utils/calendar-grid';
import { parseDay, toDateString } from '@/utils/date';

/** Height of one banner/chip slot inside a day cell. */
export const SLOT_HEIGHT = 18;
/** Height of the day-number line at the top of each cell. */
export const DAY_NUMBER_HEIGHT = 22;

type WeekRowProps = {
  /** Monday dateString — the row's identity. */
  weekStart: string;
  rowHeight: number;
  /** Visible event slots per cell (from row height); ≤0 renders numbers only. */
  slotCount: number;
  /** Events touching this week (pre-bucketed by the grid). */
  events: CalEvent[];
  todayStr: string;
  /** The settled/visible month — days outside it render dimmed. */
  focusedYear: number;
  focusedMonth0: number;
  showChipTime: boolean;
  onPressDay: (day: string) => void;
  onPressEvent: (event: CalEvent) => void;
  onPressMore: (day: string) => void;
};

const pct = (n: number) => `${(n / 7) * 100}%` as const;

// Cell washes (translucent, so they read in both themes): weekends get a
// Firefox-blue tint; days outside the focused month a grey stippling — which
// takes precedence when a day is both.
const WEEKEND_TINT = 'rgba(0, 96, 224, 0.08)';

export const WeekRow = memo(function WeekRow({
  weekStart,
  rowHeight,
  slotCount,
  events,
  todayStr,
  focusedYear,
  focusedMonth0,
  showChipTime,
  onPressDay,
  onPressEvent,
  onPressMore,
}: WeekRowProps) {
  const theme = useTheme();

  const days = useMemo(() => {
    const monday = parseDay(weekStart) ?? new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [weekStart]);

  const layout = useMemo(
    () => layoutWeek(days[0], events, slotCount),
    [days, events, slotCount]
  );

  return (
    <View
      style={[
        styles.row,
        { height: rowHeight, borderTopColor: theme.backgroundSelected },
      ]}
    >
      <View style={styles.cells}>
        {days.map((day, col) => {
          const dateString = toDateString(day);
          const isToday = dateString === todayStr;
          const inMonth =
            day.getFullYear() === focusedYear &&
            day.getMonth() === focusedMonth0;
          const isWeekend = col >= 5; // Monday-start: cols 5/6 = Sat/Sun
          const tint = inMonth && isWeekend ? WEEKEND_TINT : undefined;
          const label =
            day.getDate() === 1
              ? `1 ${day.toLocaleDateString(undefined, { month: 'short' })}`
              : `${day.getDate()}`;
          return (
            <Pressable
              key={dateString}
              testID={`day-cell-${dateString}`}
              onPress={() => onPressDay(dateString)}
              style={[
                styles.cell,
                tint != null && { backgroundColor: tint },
                col < 6 && {
                  borderRightWidth: StyleSheet.hairlineWidth,
                  borderRightColor: theme.backgroundSelected,
                },
              ]}
            >
              {!inMonth && <CellStipple />}
              <View style={[styles.dayNumberWrap, isToday && styles.todayPill]}>
                <ThemedText
                  type="small"
                  numberOfLines={1}
                  style={[
                    styles.dayNumber,
                    {
                      color: isToday
                        ? OnAccentColor
                        : inMonth
                          ? theme.text
                          : theme.textSecondary,
                    },
                  ]}
                >
                  {label}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* box-none: empty-area taps fall through to the day cells; only the
          chips/banners/"+N more" Pressables capture their own pixels. */}
      <View style={styles.overlay}>
        {layout.banners.map((banner) => (
          <EventBanner
            key={banner.event.id}
            placement={banner}
            onPress={() => onPressEvent(banner.event)}
            style={{
              position: 'absolute',
              left: pct(banner.startCol),
              width: pct(banner.span),
              top: banner.slot * SLOT_HEIGHT,
              height: SLOT_HEIGHT - 2,
            }}
          />
        ))}
        {layout.chips.map((chip) => (
          <EventChip
            key={chip.event.id}
            event={chip.event}
            showTime={showChipTime}
            onPress={() => onPressEvent(chip.event)}
            style={{
              position: 'absolute',
              left: pct(chip.col),
              width: pct(1),
              top: chip.slot * SLOT_HEIGHT,
              height: SLOT_HEIGHT - 2,
            }}
          />
        ))}
        {slotCount >= 1 &&
          layout.overflow.map((count, col) =>
            count > 0 ? (
              <Pressable
                key={`more-${col}`}
                testID={`more-${toDateString(days[col])}`}
                onPress={() => onPressMore(toDateString(days[col]))}
                style={{
                  position: 'absolute',
                  left: pct(col),
                  width: pct(1),
                  top: (slotCount - 1) * SLOT_HEIGHT,
                  height: SLOT_HEIGHT - 2,
                  justifyContent: 'center',
                }}
              >
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}
                  style={styles.more}
                >
                  +{count} more
                </ThemedText>
              </Pressable>
            ) : null
          )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cells: {
    flex: 1,
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    paddingTop: 2,
    alignItems: 'flex-start',
  },
  dayNumberWrap: {
    minWidth: DAY_NUMBER_HEIGHT - 4,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.one,
    marginLeft: 2,
    alignItems: 'center',
  },
  todayPill: {
    backgroundColor: AccentColor,
  },
  dayNumber: {
    fontSize: 12,
    lineHeight: 18,
  },
  overlay: {
    position: 'absolute',
    top: DAY_NUMBER_HEIGHT,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  more: {
    fontSize: 10,
    lineHeight: 12,
    paddingLeft: 5,
  },
});

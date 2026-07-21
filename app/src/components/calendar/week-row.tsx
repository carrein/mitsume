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
  /** Week-start (Sunday) dateString — the row's identity. */
  weekStart: string;
  rowHeight: number;
  /** Day-cell width in px — drives the chip title wrap estimate. */
  cellWidth: number;
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

// Chip title wrap heuristic: slot layout runs before text renders, so fit is
// estimated from an averaged glyph width of the 11px title font. A title that
// fits beside its inline time keeps the one-slot form; an overflowing one
// takes the stacked form (time line, then the title wrapping to two lines).
// 11px Satoshi averages ~6px/glyph in mixed case; estimating slightly wide
// biases borderline titles toward wrapping (an extra slot) instead of
// ellipsizing, which is the failure users actually notice.
const CHIP_CHAR_PX = 6.2;
/** Horizontal chrome inside a chip: 3px bar + 3px gap + 3px right padding. */
const CHIP_CHROME_PX = 9;

/** Title lines a chip needs against the full cell width (time, when shown,
 *  sits on its own line and never competes with the title). */
function chipTitleLines(summary: string, cellWidth: number): number {
  const title = summary || '(untitled)';
  return title.length * CHIP_CHAR_PX > cellWidth - CHIP_CHROME_PX ? 2 : 1;
}

/** Horizontal chrome inside a banner: 4px padding each side + hairline. */
const BANNER_CHROME_PX = 9;

/** Same glyph-width estimate for banner titles, over the banner's full width. */
function bannerTitleLines(summary: string, widthPx: number): number {
  const title = summary || '(untitled)';
  return title.length * CHIP_CHAR_PX > widthPx - BANNER_CHROME_PX ? 2 : 1;
}

// Cell washes (translucent, so they read in both themes): weekends get a
// Firefox-blue tint; days outside the focused month a grey stippling — which
// takes precedence when a day is both.
const WEEKEND_TINT = 'rgba(0, 96, 224, 0.08)';

export const WeekRow = memo(function WeekRow({
  weekStart,
  rowHeight,
  cellWidth,
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
    const start = parseDay(weekStart) ?? new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  const layout = useMemo(() => {
    // With times shown every chip stacks (time line on top), so the span is
    // the title's lines plus one; without times it's just the title lines.
    const chipSpan = (event: CalEvent) =>
      chipTitleLines(event.summary, cellWidth) + (showChipTime ? 1 : 0);
    const bannerRows = (event: CalEvent, spanCols: number) =>
      bannerTitleLines(event.summary, spanCols * cellWidth);
    return layoutWeek(days[0], events, slotCount, chipSpan, bannerRows);
  }, [days, events, slotCount, cellWidth, showChipTime]);

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
          const isWeekend = col === 0 || col === 6; // Sunday-start: cols 0/6 = Sun/Sat
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
            titleLines={banner.rows > 1 ? 2 : 1}
            onPress={() => onPressEvent(banner.event)}
            style={{
              position: 'absolute',
              left: pct(banner.startCol),
              // left+right (not width) so the banner's own margins inset its
              // edges instead of shifting the whole bar sideways.
              right: pct(7 - banner.startCol - banner.span),
              top: banner.slot * SLOT_HEIGHT,
              height: banner.rows * SLOT_HEIGHT - 2,
            }}
          />
        ))}
        {layout.chips.map((chip) => (
          <EventChip
            key={chip.event.id}
            event={chip.event}
            showTime={showChipTime}
            titleLines={Math.min(2, showChipTime ? chip.span - 1 : chip.span)}
            onPress={() => onPressEvent(chip.event)}
            style={{
              position: 'absolute',
              left: pct(chip.col),
              width: pct(1),
              top: chip.slot * SLOT_HEIGHT,
              height: chip.span * SLOT_HEIGHT - 2,
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

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';

import type { CalEvent } from '@/caldav/types';
import {
  DAY_NUMBER_HEIGHT,
  SLOT_HEIGHT,
  WeekRow,
} from '@/components/calendar/week-row';
import {
  buildWeekRange,
  monthAnchorOf,
  monthStartWeekIndex,
  weekIndexOfDay,
  type MonthAnchor,
} from '@/utils/calendar-grid';
import { parseDay } from '@/utils/date';

export type MonthGridHandle = {
  /** Scroll so the week containing the 1st of (year, month0) sits at the top. */
  scrollToMonth: (year: number, month0: number, animated: boolean) => void;
};

type Props = {
  /** Measured grid pane size — the grid must only mount once these are known
   *  (defines rowHeight AND sidesteps Android's initialScrollIndex-at-zero-height bug). */
  width: number;
  height: number;
  events: CalEvent[];
  /** Today's dateString; also anchors the ±5y week range. */
  today: string;
  /** Month to land on at mount (deep-linked day's month or today's). */
  initialMonth: MonthAnchor;
  /** The month driving the header label + day dimming (live while scrolling). */
  focusedMonth: MonthAnchor;
  onVisibleMonthChange: (anchor: MonthAnchor) => void;
  onSettledMonthChange: (anchor: MonthAnchor) => void;
  /** Fired once, when the initial month's anchor week first becomes viewable —
   *  i.e. the grid is verifiably rendering at its landing position. */
  onAnchored: () => void;
  onPressDay: (day: string) => void;
  onPressEvent: (event: CalEvent) => void;
  onPressMore: (day: string) => void;
};

const NO_EVENTS: CalEvent[] = [];

/** Scroll-idle time after which the grid is considered settled on a month
 *  (drives the header label handoff, event fetching, and the week snap). */
const SETTLE_MS = 100;

/** Duration of the web rAF ease for animated programmatic jumps (Today). */
const SCROLL_ANIM_MS = 350;

/** Duration of the web settle-snap glide onto the nearest week row. */
const SNAP_ANIM_MS = 180;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Any sliver of the anchor week counts; fire without waiting for a gesture. */
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 1,
  waitForInteraction: false,
};

/**
 * The month grid: a virtualized FlatList of fixed-height week rows spanning
 * today ± 5 years, scrolled natively — touch, wheel, and trackpad all use the
 * platform's own scrolling. The header, day dimming, and event fetching
 * follow whichever week is on top via onScroll; programmatic jumps
 * (chevrons, Today, deep links) go through scrollToMonth.
 */
export const MonthGrid = forwardRef<MonthGridHandle, Props>(function MonthGrid(
  {
    width,
    height,
    events,
    today,
    initialMonth,
    focusedMonth,
    onVisibleMonthChange,
    onSettledMonthChange,
    onAnchored,
    onPressDay,
    onPressEvent,
    onPressMore,
  },
  ref
) {
  const listRef = useRef<FlatList<string>>(null);

  const { rangeStart, weeks } = useMemo(
    () => buildWeekRange(parseDay(today) ?? new Date()),
    [today]
  );

  const rowHeight = height / 6;
  const slotCount = Math.max(
    0,
    Math.floor((rowHeight - DAY_NUMBER_HEIGHT - 2) / SLOT_HEIGHT)
  );
  const showChipTime = width / 7 >= 96;

  const clampIndex = useCallback(
    (index: number) => Math.min(Math.max(index, 0), weeks.length - 1),
    [weeks.length]
  );

  // Bucket events by the weeks they touch; map identity changes per fetch,
  // so mounted rows re-render exactly when data does.
  const weekEvents = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const event of events) {
      const lastMs = Math.max(event.start.getTime(), event.end.getTime() - 1);
      const from = weekIndexOfDay(event.start, rangeStart);
      const to = weekIndexOfDay(new Date(lastMs), rangeStart);
      if (to < 0 || from > weeks.length - 1) continue;
      for (
        let i = Math.max(from, 0);
        i <= Math.min(to, weeks.length - 1);
        i++
      ) {
        const key = weeks[i];
        const list = map.get(key);
        if (list) list.push(event);
        else map.set(key, [event]);
      }
    }
    return map;
  }, [events, weeks, rangeStart]);

  const initialIndex = clampIndex(
    monthStartWeekIndex(initialMonth.year, initialMonth.month0, rangeStart)
  );

  const anchorAt = useCallback(
    (offset: number): MonthAnchor => {
      const index = clampIndex(Math.round(offset / rowHeight));
      return monthAnchorOf(parseDay(weeks[index]) ?? new Date());
    },
    [clampIndex, rowHeight, weeks]
  );

  const lastOffset = useRef(initialIndex * rowHeight);
  const visibleRef = useRef<MonthAnchor>(initialMonth);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated programmatic jumps (Today): native uses the platform's animated
  // scroll, but on web RNW's animated scrollToOffset rides on
  // element.scroll({behavior:'smooth'}), which silently no-ops in some
  // embedded/headless Chromium builds — so web animates via rAF steps that
  // feed the same onScroll pipeline.
  const animFrame = useRef<number | null>(null);

  const cancelWebScrollAnimation = useCallback(() => {
    if (animFrame.current != null) {
      cancelAnimationFrame(animFrame.current);
      animFrame.current = null;
    }
  }, []);

  const animateToOffset = useCallback(
    (to: number, durationMs: number = SCROLL_ANIM_MS) => {
      cancelWebScrollAnimation();
      const from = lastOffset.current;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const offset = from + (to - from) * easeOutCubic(t);
        lastOffset.current = offset;
        listRef.current?.scrollToOffset({ offset, animated: false });
        animFrame.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animFrame.current = requestAnimationFrame(step);
    },
    [cancelWebScrollAnimation]
  );

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.y;
    lastOffset.current = offset;
    const anchor = anchorAt(offset);
    if (
      anchor.year !== visibleRef.current.year ||
      anchor.month0 !== visibleRef.current.month0
    ) {
      visibleRef.current = anchor;
      onVisibleMonthChange(anchor);
    }
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      onSettledMonthChange(anchorAt(lastOffset.current));
      // Settle-snap (web): ease the rest position onto the nearest week-row
      // boundary. Native lands there by itself via snapToInterval, and
      // programmatic jumps already target row multiples, so this no-ops
      // after them — including after its own glide.
      if (Platform.OS !== 'web') return;
      const contentMax = Math.max(0, weeks.length * rowHeight - height);
      const snapped = Math.min(
        Math.max(Math.round(lastOffset.current / rowHeight) * rowHeight, 0),
        contentMax
      );
      if (Math.abs(snapped - lastOffset.current) >= 1) {
        animateToOffset(snapped, SNAP_ANIM_MS);
      }
    }, SETTLE_MS);
  };

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      cancelWebScrollAnimation();
    },
    [cancelWebScrollAnimation]
  );

  // Anchored latch: report once, the first time the anchor week (the initial
  // month's first week) is viewable at the landing position — the parent keeps
  // the grid area covered until then. Viewability recomputes on cell layout
  // and list updates, not just user scrolls, so this fires shortly after
  // mount. The callback must keep a stable identity (the list rejects a
  // changing onViewableItemsChanged), so it reads the moving parts from a ref.
  const anchoredFired = useRef(false);
  const anchorContext = useRef<{ week: string; onAnchored: () => void } | null>(
    null
  );
  useEffect(() => {
    anchorContext.current = { week: weeks[initialIndex], onAnchored };
  });
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const ctx = anchorContext.current;
      if (anchoredFired.current || !ctx) return;
      if (viewableItems.some((token) => token.key === ctx.week)) {
        anchoredFired.current = true;
        ctx.onAnchored();
      }
    },
    []
  );

  // Android hardening: initialScrollIndex can land at 0 in edge cases; one
  // idempotent post-mount jump to the intended offset costs nothing when it
  // already worked.
  const corrected = useRef(false);
  // A resize re-anchor to re-apply once the list's native content has adopted
  // the new row height — the resize effect's own scrollToOffset races the
  // native layout pass and can clamp against the stale content size (see the
  // resize effect below).
  const pendingResizeOffset = useRef<number | null>(null);
  const handleContentSizeChange = () => {
    if (!corrected.current) {
      corrected.current = true;
      listRef.current?.scrollToOffset({
        offset: initialIndex * rowHeight,
        animated: false,
      });
    }
    const pending = pendingResizeOffset.current;
    if (pending != null) {
      pendingResizeOffset.current = null;
      listRef.current?.scrollToOffset({ offset: pending, animated: false });
    }
  };

  // Pane resize (rotation / window resize): row height changed, so re-anchor
  // the focused month's first week to the top.
  const prevRowHeight = useRef(rowHeight);
  useEffect(() => {
    if (prevRowHeight.current === rowHeight) return;
    prevRowHeight.current = rowHeight;
    cancelWebScrollAnimation();
    const anchor = visibleRef.current;
    const index = clampIndex(
      monthStartWeekIndex(anchor.year, anchor.month0, rangeStart)
    );
    lastOffset.current = index * rowHeight;
    pendingResizeOffset.current = index * rowHeight;
    listRef.current?.scrollToOffset({
      offset: index * rowHeight,
      animated: false,
    });
  }, [rowHeight, rangeStart, clampIndex, cancelWebScrollAnimation]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToMonth(year, month0, animated) {
        const index = clampIndex(monthStartWeekIndex(year, month0, rangeStart));
        const contentMax = Math.max(0, weeks.length * rowHeight - height);
        const offset = Math.min(index * rowHeight, contentMax);
        // This jump is the newest intent — a not-yet-applied resize re-anchor
        // must not later yank the list away from it.
        pendingResizeOffset.current = null;
        if (!animated) {
          cancelWebScrollAnimation();
          lastOffset.current = offset;
          listRef.current?.scrollToOffset({ offset, animated: false });
          return;
        }
        // Glide only the final stretch: an animated scroll across a long
        // distance outruns row mounting and shows white until it settles (and
        // launched over a stale post-rotation offset, sometimes past it) — so
        // teleport to within two viewports of the target first.
        const maxGlide = 2 * height;
        if (Math.abs(offset - lastOffset.current) > maxGlide) {
          const jumpTo = Math.min(
            Math.max(
              offset - Math.sign(offset - lastOffset.current) * maxGlide,
              0
            ),
            contentMax
          );
          lastOffset.current = jumpTo;
          listRef.current?.scrollToOffset({ offset: jumpTo, animated: false });
        }
        if (Platform.OS === 'web') {
          animateToOffset(offset);
          return;
        }
        cancelWebScrollAnimation();
        lastOffset.current = offset;
        listRef.current?.scrollToOffset({ offset, animated: true });
      },
    }),
    [
      clampIndex,
      rangeStart,
      rowHeight,
      weeks.length,
      height,
      animateToOffset,
      cancelWebScrollAnimation,
    ]
  );

  const renderItem = ({ item }: ListRenderItemInfo<string>) => (
    <WeekRow
      weekStart={item}
      rowHeight={rowHeight}
      cellWidth={width / 7}
      slotCount={slotCount}
      events={weekEvents.get(item) ?? NO_EVENTS}
      todayStr={today}
      focusedYear={focusedMonth.year}
      focusedMonth0={focusedMonth.month0}
      showChipTime={showChipTime}
      onPressDay={onPressDay}
      onPressEvent={onPressEvent}
      onPressMore={onPressMore}
    />
  );

  return (
    <FlatList
      ref={listRef}
      testID="month-grid"
      style={styles.list}
      data={weeks}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={(_, index) => ({
        length: rowHeight,
        offset: rowHeight * index,
        index,
      })}
      initialScrollIndex={initialIndex}
      initialNumToRender={8}
      windowSize={7}
      // Fling momentum is untouched; the platform lands the rest position on
      // a row multiple. Web ignores this prop — the settle-snap in
      // handleScroll covers it there.
      snapToInterval={Platform.OS === 'web' ? undefined : rowHeight}
      onViewableItemsChanged={handleViewableItemsChanged}
      viewabilityConfig={VIEWABILITY_CONFIG}
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onContentSizeChange={handleContentSizeChange}
      onScrollToIndexFailed={({ index }) => {
        listRef.current?.scrollToOffset({
          offset: index * rowHeight,
          animated: false,
        });
      }}
      showsVerticalScrollIndicator={false}
    />
  );
});

function keyExtractor(week: string): string {
  return week;
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
});

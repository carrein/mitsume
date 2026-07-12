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
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { CalEvent } from '@/caldav/types';
import { attachWheelPaging } from '@/components/calendar/wheel-paging';
import {
  DAY_NUMBER_HEIGHT,
  SLOT_HEIGHT,
  WeekRow,
} from '@/components/calendar/week-row';
import {
  buildWeekRange,
  monthAnchorOf,
  monthStartNeighbors,
  monthStartWeekIndex,
  monthStartWeekIndices,
  pagerTargetIndex,
  weekIndexOfDay,
  type MonthAnchor,
  type MonthNeighbors,
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
  onPressDay: (day: string) => void;
  onPressEvent: (event: CalEvent) => void;
  onPressMore: (day: string) => void;
};

const NO_EVENTS: CalEvent[] = [];

/** Scroll-idle time after which the grid is considered settled on a month.
 *  All scrolling is programmatic now (pager), but the idle timer stays the
 *  one settle mechanism for every input path on both platforms. */
const SETTLE_MS = 150;

/** Finger must move this far vertically before the pan claims the gesture
 *  (taps and near-horizontal swipes fall through to day/event presses). */
const PAN_ACTIVATE_PX = 12;

/** Release velocity (px/s) that commits a page turn regardless of distance. */
const FLICK_VELOCITY = 500;

/** Rubber-band cap: a drag can overshoot the adjacent-month clamp (or the
 *  range ends) by at most half a row, with asymptotic resistance. */
const OVERSHOOT_CAP_ROWS = 0.5;

/** Page-turn settle animation; the bounce back from an uncommitted drag. */
const PAGE_COMMIT_MS = 360;
const PAGE_BOUNCE_MS = 240;

const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The month pager: a virtualized FlatList of fixed-height week rows spanning
 * today ± 5 years, with native scrolling DISABLED — a pan gesture (touch and
 * mouse, both platforms) and a wheel handler (web) own the offset instead, so
 * every input pages exactly one month per gesture: drags are hard-clamped to
 * the adjacent months' start rows (rubber-banded at the clamp), release
 * commits past 25% progress or a flick, and an eased rAF animation snaps the
 * target month's first week to the top. Programmatic scrolls feed the same
 * onScroll pipeline as user scrolling did, so month settling is unchanged.
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

  const monthIndices = useMemo(
    () => monthStartWeekIndices(rangeStart, weeks.length),
    [rangeStart, weeks.length]
  );

  // Geometry the gesture/wheel callbacks read at event time — through a ref
  // because RNGH gestures must stay referentially stable while a gesture runs
  // (a recreated gesture detaches the active handler mid-drag), so their
  // callbacks can't close over per-render values.
  const contentMax = Math.max(0, weeks.length * rowHeight - height);
  const geometry = useRef({ rowHeight, monthIndices, contentMax });
  useEffect(() => {
    geometry.current = { rowHeight, monthIndices, contentMax };
  }, [rowHeight, monthIndices, contentMax]);

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
    }, SETTLE_MS);
  };

  // All offset animation is rAF-driven instant steps rather than native
  // animated scrolls: one implementation and one curve on both platforms, an
  // in-flight signal for wheel-hop chaining (animFrame != null), and it feeds
  // the same onScroll pipeline either way. (Historically also required on
  // web: element.scroll({behavior:'smooth'}) silently no-ops in some
  // embedded/headless Chromium builds.)
  const animFrame = useRef<number | null>(null);
  // Where the in-flight animation is heading — a wheel hop landing mid-flight
  // chains from here (pendingTarget-style), not from the passing offset.
  const animTarget = useRef(0);
  const cancelScrollAnimation = useCallback(() => {
    if (animFrame.current != null) {
      cancelAnimationFrame(animFrame.current);
      animFrame.current = null;
    }
  }, []);

  const animateScrollTo = useCallback(
    (to: number, duration: number, ease: (t: number) => number) => {
      cancelScrollAnimation();
      animTarget.current = to;
      const from = lastOffset.current;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const offset = from + (to - from) * ease(t);
        lastOffset.current = offset;
        listRef.current?.scrollToOffset({ offset, animated: false });
        animFrame.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animFrame.current = requestAnimationFrame(step);
    },
    [cancelScrollAnimation]
  );

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      cancelScrollAnimation();
    },
    [cancelScrollAnimation]
  );

  // The pager pan. Drags track the finger 1:1 inside [prev month start, next
  // month start] and rubber-band beyond; release picks prev/current/next via
  // flick velocity or the 25% commit rule and animates there.
  const dragRef = useRef<{
    active: boolean;
    startOffset: number;
    window: MonthNeighbors;
  } | null>(null);

  const panGesture = useMemo(() => {
    const settleDrag = (velocityY: number) => {
      const drag = dragRef.current;
      if (!drag?.active) return;
      drag.active = false;
      const { rowHeight: row, contentMax: max } = geometry.current;
      const direction =
        velocityY <= -FLICK_VELOCITY ? 1 : velocityY >= FLICK_VELOCITY ? -1 : 0;
      const target = pagerTargetIndex(
        drag.window,
        lastOffset.current / row,
        direction
      );
      const bounce = target === drag.window.current;
      animateScrollTo(
        Math.min(Math.max(target * row, 0), max),
        bounce ? PAGE_BOUNCE_MS : PAGE_COMMIT_MS,
        bounce ? easeOutCubic : easeOutQuint
      );
    };

    return (
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetY([-PAN_ACTIVATE_PX, PAN_ACTIVATE_PX])
        .failOffsetX([-2 * PAN_ACTIVATE_PX, 2 * PAN_ACTIVATE_PX])
        .onStart(() => {
          cancelScrollAnimation();
          const { rowHeight: row, monthIndices: indices } = geometry.current;
          dragRef.current = {
            active: true,
            startOffset: lastOffset.current,
            window: monthStartNeighbors(indices, lastOffset.current / row),
          };
        })
        .onUpdate((e) => {
          const drag = dragRef.current;
          if (!drag?.active) return;
          const { rowHeight: row, contentMax } = geometry.current;
          const min = Math.max(drag.window.prev * row, 0);
          const max = Math.min(drag.window.next * row, contentMax);
          const cap = row * OVERSHOOT_CAP_ROWS;
          let offset = drag.startOffset - e.translationY;
          if (offset < min) {
            const over = min - offset;
            offset = min - (cap * over) / (over + cap);
          } else if (offset > max) {
            const over = offset - max;
            offset = max + (cap * over) / (over + cap);
          }
          lastOffset.current = offset;
          listRef.current?.scrollToOffset({ offset, animated: false });
        })
        .onEnd((e) => settleDrag(e.velocityY))
        // Cancelled gestures (navigation, another handler stealing) never
        // reach onEnd — settle with no flick so the grid can't rest off-month.
        .onFinalize(() => settleDrag(0))
    );
  }, [animateScrollTo, cancelScrollAnimation]);

  // Wheel paging (web): native wheel scrolling is already inert
  // (scrollEnabled=false ⇒ overflow hidden). wheel-gestures segments the raw
  // stream into gestures (momentum classified by coalescing-tolerant velocity
  // analysis — see wheel-paging.ts for why hand-rolled per-event heuristics
  // kept failing here) and the adapter emits at most one hop per gesture; a
  // re-flick during the momentum tail is a fresh gesture, so rapid flicks
  // page one month each, even while the settle animation is still in flight
  // (chaining from its destination).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (
      listRef.current as unknown as {
        getScrollableNode?: () => unknown;
      } | null
    )?.getScrollableNode?.() as HTMLElement | null | undefined;
    if (!node) return;
    return attachWheelPaging(node, (direction) => {
      const {
        rowHeight: row,
        monthIndices: indices,
        contentMax,
      } = geometry.current;
      // Mid-animation hops page relative to where the animation will land.
      const base =
        animFrame.current != null ? animTarget.current : lastOffset.current;
      const window = monthStartNeighbors(indices, base / row);
      const target = direction > 0 ? window.next : window.prev;
      const to = Math.min(Math.max(target * row, 0), contentMax);
      if (Math.abs(to - base) < 1) return; // at a range end
      animateScrollTo(to, PAGE_COMMIT_MS, easeOutQuint);
    });
  }, [animateScrollTo]);

  // Android hardening: initialScrollIndex can land at 0 in edge cases; one
  // idempotent post-mount jump to the intended offset costs nothing when it
  // already worked.
  const corrected = useRef(false);
  const handleContentSizeChange = () => {
    if (corrected.current) return;
    corrected.current = true;
    listRef.current?.scrollToOffset({
      offset: initialIndex * rowHeight,
      animated: false,
    });
  };

  // Pane resize (rotation / window resize): row height changed, so re-anchor
  // the focused month's first week to the top.
  const prevRowHeight = useRef(rowHeight);
  useEffect(() => {
    if (prevRowHeight.current === rowHeight) return;
    prevRowHeight.current = rowHeight;
    cancelScrollAnimation();
    const anchor = visibleRef.current;
    const index = clampIndex(
      monthStartWeekIndex(anchor.year, anchor.month0, rangeStart)
    );
    lastOffset.current = index * rowHeight;
    listRef.current?.scrollToOffset({
      offset: index * rowHeight,
      animated: false,
    });
  }, [rowHeight, rangeStart, clampIndex, cancelScrollAnimation]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToMonth(year, month0, animated) {
        const index = clampIndex(monthStartWeekIndex(year, month0, rangeStart));
        const offset = Math.min(index * rowHeight, geometry.current.contentMax);
        if (animated) {
          animateScrollTo(offset, PAGE_COMMIT_MS, easeOutQuint);
          return;
        }
        cancelScrollAnimation();
        lastOffset.current = offset;
        listRef.current?.scrollToOffset({ offset, animated: false });
      },
    }),
    [animateScrollTo, cancelScrollAnimation, clampIndex, rangeStart, rowHeight]
  );

  const renderItem = ({ item }: ListRenderItemInfo<string>) => (
    <WeekRow
      weekStart={item}
      rowHeight={rowHeight}
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
    <GestureDetector gesture={panGesture}>
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
        maxToRenderPerBatch={6}
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
        scrollEnabled={false}
        overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
      />
    </GestureDetector>
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

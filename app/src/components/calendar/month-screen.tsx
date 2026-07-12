import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { restoreEvent } from '@/caldav/events';
import type { CalEvent } from '@/caldav/types';
import { DayPopover } from '@/components/calendar/day-popover';
import {
  EventEditor,
  type EditorResult,
} from '@/components/calendar/event-editor';
import {
  MonthGrid,
  type MonthGridHandle,
} from '@/components/calendar/month-grid';
import { MonthHeader } from '@/components/calendar/month-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { davConfigured } from '@/config';
import {
  AccentColor,
  Colors,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';
import { useMonthEvents } from '@/hooks/use-month-events';
import type { MonthAnchor } from '@/utils/calendar-grid';
import { eventDays, parseDay, toDateString } from '@/utils/date';
import { refreshAgendaWidget } from '@/widget/app-refresh';

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create'; day: string }
  | { mode: 'edit'; event: CalEvent };

type Snack = { message: string; undo?: CalEvent } | null;

function monthOfDay(day: string | null, fallback: Date): MonthAnchor {
  const date = (day ? parseDay(day) : null) ?? fallback;
  return { year: date.getFullYear(), month0: date.getMonth() };
}

function sameMonth(a: MonthAnchor, b: MonthAnchor): boolean {
  return a.year === b.year && a.month0 === b.month0;
}

function addMonths(anchor: MonthAnchor, delta: number): MonthAnchor {
  const date = new Date(anchor.year, anchor.month0 + delta, 1);
  return { year: date.getFullYear(), month0: date.getMonth() };
}

export function MonthScreen() {
  const insets = useSafeAreaInsets();
  const today = toDateString(new Date());

  // Widget deep links: `?day=YYYY-MM-DD` lands the grid on that day's month;
  // `?new=` (a nonce so repeat taps re-fire) opens the new-event editor.
  const params = useLocalSearchParams<{ day?: string; new?: string }>();
  const dayParam =
    typeof params.day === 'string' && parseDay(params.day) ? params.day : null;
  const newParam = typeof params.new === 'string' ? params.new : null;

  const bottomInset = Platform.select({
    web: Spacing.four,
    default: insets.bottom + Spacing.three,
  });

  // Cold start lands on the deep-linked day's month via initialScrollIndex.
  const [initialMonth] = useState<MonthAnchor>(() =>
    monthOfDay(dayParam, new Date())
  );
  const [visibleMonth, setVisibleMonth] = useState<MonthAnchor>(initialMonth);
  const [settledMonth, setSettledMonth] = useState<MonthAnchor>(initialMonth);
  const [editor, setEditor] = useState<EditorState>(
    newParam ? { mode: 'create', day: today } : { mode: 'closed' }
  );
  const [snack, setSnack] = useState<Snack>(null);
  const [popoverDay, setPopoverDay] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const gridRef = useRef<MonthGridHandle>(null);
  // Chevron target while a scroll animation is in flight — rapid clicks
  // advance from the last requested month, not the passing visible one.
  const pendingTarget = useRef<MonthAnchor | null>(null);

  // The widget's `+` deep-links `?new=<nonce>`; open the new-event editor (dated
  // today). Cold start seeds it above; a fresh nonce (warm start) re-opens here.
  const [handledNewParam, setHandledNewParam] = useState(newParam);
  if (newParam && newParam !== handledNewParam) {
    setHandledNewParam(newParam);
    setEditor({ mode: 'create', day: today });
  }

  // A deep link that changes `?day=` while mounted (warm start) is reconciled
  // here — the React-recommended "adjust state during render" alternative to a
  // setState effect. The scroll itself runs in the effect below once the grid
  // is mounted (it only needs layout, not events — the grid is pure date math);
  // a ref marks the consumed value so the effect fires once per deep link.
  const [handledDayParam, setHandledDayParam] = useState(dayParam);
  const [pendingScrollDay, setPendingScrollDay] = useState<string | null>(null);
  if (dayParam && dayParam !== handledDayParam) {
    setHandledDayParam(dayParam);
    setPendingScrollDay(dayParam);
  }
  const scrolledForDay = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingScrollDay || !gridSize) return;
    if (scrolledForDay.current === pendingScrollDay) return;
    scrolledForDay.current = pendingScrollDay;
    const target = monthOfDay(pendingScrollDay, new Date());
    pendingTarget.current = null;
    gridRef.current?.scrollToMonth(target.year, target.month0, false);
  }, [pendingScrollDay, gridSize]);

  const settledDate = useMemo(
    () => new Date(settledMonth.year, settledMonth.month0, 1),
    [settledMonth]
  );
  const { events, loading, error, refresh } = useMonthEvents(settledDate);

  // Auto-dismiss the snackbar.
  useEffect(() => {
    if (!snack) return;
    const timer = setTimeout(() => setSnack(null), 6000);
    return () => clearTimeout(timer);
  }, [snack]);

  const onVisibleMonthChange = useCallback((anchor: MonthAnchor) => {
    setVisibleMonth((prev) => (sameMonth(prev, anchor) ? prev : anchor));
  }, []);

  const onSettledMonthChange = useCallback((anchor: MonthAnchor) => {
    pendingTarget.current = null;
    setSettledMonth((prev) => (sameMonth(prev, anchor) ? prev : anchor));
  }, []);

  const onPressDay = useCallback(
    (day: string) => setEditor({ mode: 'create', day }),
    []
  );

  const onPressEvent = useCallback((event: CalEvent) => {
    setPopoverDay(null);
    setEditor({ mode: 'edit', event });
  }, []);

  const onPressMore = useCallback((day: string) => setPopoverDay(day), []);

  function shiftMonth(delta: number) {
    const target = addMonths(pendingTarget.current ?? visibleMonth, delta);
    pendingTarget.current = target;
    gridRef.current?.scrollToMonth(target.year, target.month0, true);
  }

  function goToday() {
    pendingTarget.current = null;
    const target = monthOfDay(null, new Date());
    gridRef.current?.scrollToMonth(target.year, target.month0, false);
  }

  function onEditorDone(result: EditorResult) {
    setEditor({ mode: 'closed' });
    refresh();
    // The home-screen widget has no other way to learn about this mutation
    // (its background cycle is unreliable on aggressive ROMs); foreground
    // refresh here is the one dependable trigger.
    refreshAgendaWidget();
    if (result === 'created') setSnack({ message: 'Event added' });
    else if (result === 'updated') setSnack({ message: 'Saved' });
    else if (result === 'conflict') {
      setSnack({ message: 'Event changed elsewhere — list refreshed' });
    } else setSnack({ message: 'Event deleted', undo: result.deleted });
  }

  async function undoDelete(event: CalEvent) {
    setSnack(null);
    try {
      await restoreEvent(event);
      refresh();
      refreshAgendaWidget();
    } catch (err) {
      setSnack({
        message: err instanceof Error ? err.message : 'Could not restore event',
      });
    }
  }

  const popoverEvents = useMemo(() => {
    if (!popoverDay) return [];
    return events.filter((event) =>
      eventDays(event.start, event.end).includes(popoverDay)
    );
  }, [events, popoverDay]);

  const weekdayLabels = useMemo(
    () =>
      // 2024-01-01 is a Monday; weeks start Monday.
      Array.from({ length: 7 }, (_, i) =>
        new Date(2024, 0, 1 + i).toLocaleDateString(undefined, {
          weekday: 'short',
        })
      ),
    []
  );

  if (!davConfigured) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.setupWrapper}>
          <ThemedView type="backgroundElement" style={styles.setupCard}>
            <ThemedText type="subtitle">
              No calendar server configured
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              This build has no CalDAV server URL. Set{' '}
              <ThemedText type="code">EXPO_PUBLIC_DAV_URL</ThemedText> when
              building the app (see{' '}
              <ThemedText type="code">app/.env.example</ThemedText>) and rebuild
              — the URL is baked in at build time. Web builds default to{' '}
              <ThemedText type="code">/dav/</ThemedText> on their own origin.
            </ThemedText>
          </ThemedView>
        </View>
      </ThemedView>
    );
  }

  const monthLabel = new Date(
    visibleMonth.year,
    visibleMonth.month0,
    1
  ).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <MonthHeader
            label={monthLabel}
            loading={loading && events.length === 0}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
            onToday={goToday}
            onRefresh={refresh}
          />

          {error && (
            <ThemedView type="backgroundElement" style={styles.errorBanner}>
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
              <Pressable onPress={refresh}>
                <ThemedText type="smallBold" style={{ color: AccentColor }}>
                  Retry
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          <View style={styles.weekdays}>
            {weekdayLabels.map((label) => (
              <ThemedText
                key={label}
                type="small"
                themeColor="textSecondary"
                style={styles.weekday}
              >
                {label}
              </ThemedText>
            ))}
          </View>

          <View
            style={styles.gridWrap}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setGridSize((prev) =>
                prev && prev.width === width && prev.height === height
                  ? prev
                  : { width, height }
              );
            }}
          >
            {gridSize && (
              <MonthGrid
                ref={gridRef}
                width={gridSize.width}
                height={gridSize.height}
                events={events}
                today={today}
                initialMonth={initialMonth}
                focusedMonth={visibleMonth}
                onVisibleMonthChange={onVisibleMonthChange}
                onSettledMonthChange={onSettledMonthChange}
                onPressDay={onPressDay}
                onPressEvent={onPressEvent}
                onPressMore={onPressMore}
              />
            )}
          </View>
        </View>
      </SafeAreaView>

      {snack && (
        <View style={[styles.snackWrapper, { bottom: bottomInset }]}>
          <View style={styles.snack}>
            <ThemedText type="small" style={styles.snackText} numberOfLines={2}>
              {snack.message}
            </ThemedText>
            {snack.undo && (
              <Pressable onPress={() => undoDelete(snack.undo!)}>
                <ThemedText type="smallBold" style={{ color: AccentColor }}>
                  Undo
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {popoverDay && (
        <DayPopover
          day={popoverDay}
          events={popoverEvents}
          onClose={() => setPopoverDay(null)}
          onPressEvent={onPressEvent}
        />
      )}

      {editor.mode !== 'closed' && (
        <EventEditor
          key={editor.mode === 'edit' ? editor.event.id : `new-${editor.day}`}
          event={editor.mode === 'edit' ? editor.event : null}
          defaultDay={editor.mode === 'create' ? editor.day : today}
          onClose={() => setEditor({ mode: 'closed' })}
          onDone={onEditorDone}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    // paddingTop: Platform.select({ web: Spacing.four, default: Spacing.two }),
    // paddingBottom: Platform.select({ web: Spacing.two, default: 0 }),
  },
  setupWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  setupCard: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.one,
    maxWidth: 480,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.one,
    marginBottom: Spacing.two,
  },
  errorText: {
    flex: 1,
  },
  weekdays: {
    flexDirection: 'row',
    paddingBottom: Spacing.one,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: Colors.light.text,
  },
  gridWrap: {
    flex: 1,
  },
  snackWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    pointerEvents: 'box-none',
  },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    // Inverse surface: the snack keeps the dark palette in both schemes.
    backgroundColor: Colors.dark.backgroundSelected,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    maxWidth: 480,
  },
  snackText: {
    color: Colors.dark.text,
    flexShrink: 1,
  },
});

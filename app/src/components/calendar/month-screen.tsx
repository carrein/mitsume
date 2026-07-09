import { useLocalSearchParams } from 'expo-router';
import { CirclePlus, RefreshCw } from 'lucide-react-native';
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { restoreEvent } from '@/caldav/events';
import type { CalEvent } from '@/caldav/types';
import { refreshAgendaWidget } from '@/widget/app-refresh';
import {
  EventEditor,
  type EditorResult,
} from '@/components/calendar/event-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  AccentColor,
  FontFamily,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMonthEvents } from '@/hooks/use-month-events';
import { useTheme } from '@/hooks/use-theme';
import { davConfigured } from '@/config';
import { eventDays, parseDay, toDateString, toTimeString } from '@/utils/date';

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create'; day: string }
  | { mode: 'edit'; event: CalEvent };

type Snack = { message: string; undo?: CalEvent } | null;

/** One agenda entry: a day (dateString) and its events, sorted for display. */
type AgendaSection = { day: string; events: CalEvent[] };

function compareEvents(a: CalEvent, b: CalEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start.getTime() - b.start.getTime();
}

function agendaDayLabel(day: string, today: string): string {
  const label = (parseDay(day) ?? new Date()).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return day === today ? `${label} · Today` : label;
}

export function MonthScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const today = toDateString(new Date());

  // Widget deep links: `?day=YYYY-MM-DD` lands the calendar on that day; `?new=`
  // (a nonce so repeat taps re-fire) opens the new-event editor. Null otherwise.
  const params = useLocalSearchParams<{ day?: string; new?: string }>();
  const dayParam =
    typeof params.day === 'string' && parseDay(params.day) ? params.day : null;
  const newParam = typeof params.new === 'string' ? params.new : null;

  const bottomInset = Platform.select({
    web: Spacing.four,
    default: insets.bottom + Spacing.three,
  });

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const parsed = dayParam ? parseDay(dayParam) : null;
    return parsed
      ? new Date(parsed.getFullYear(), parsed.getMonth(), 1)
      : new Date();
  });
  const [selectedDay, setSelectedDay] = useState(dayParam ?? today);
  const [editor, setEditor] = useState<EditorState>(
    newParam ? { mode: 'create', day: today } : { mode: 'closed' }
  );
  const [snack, setSnack] = useState<Snack>(null);

  // The widget's `+` deep-links `?new=<nonce>`; open the new-event editor (dated
  // today). Cold start seeds it above; a fresh nonce (warm start) re-opens here.
  const [handledNewParam, setHandledNewParam] = useState(newParam);
  if (newParam && newParam !== handledNewParam) {
    setHandledNewParam(newParam);
    setEditor({ mode: 'create', day: today });
  }

  // A deep link that changes `?day=` while mounted (warm start) is reconciled
  // here — the React-recommended "adjust state during render" alternative to a
  // setState effect. Cold start already seeds selectedDay/visibleMonth above.
  const [handledDayParam, setHandledDayParam] = useState(dayParam);
  if (dayParam && dayParam !== handledDayParam) {
    const parsed = parseDay(dayParam);
    setHandledDayParam(dayParam);
    setSelectedDay(dayParam);
    if (parsed) {
      const first = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
      setVisibleMonth((prev) =>
        prev.getFullYear() === first.getFullYear() &&
        prev.getMonth() === first.getMonth()
          ? prev
          : first
      );
    }
  }

  const { events, loading, error, refresh } = useMonthEvents(visibleMonth);

  // Auto-dismiss the snackbar.
  useEffect(() => {
    if (!snack) return;
    const timer = setTimeout(() => setSnack(null), 6000);
    return () => clearTimeout(timer);
  }, [snack]);

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      {
        marked?: boolean;
        dotColor?: string;
        selected?: boolean;
        selectedColor?: string;
      }
    > = {};
    for (const event of events) {
      for (const day of eventDays(event.start, event.end)) {
        marks[day] ??= { marked: true, dotColor: AccentColor };
      }
    }
    marks[selectedDay] = {
      ...marks[selectedDay],
      selected: true,
      selectedColor: AccentColor,
    };
    return marks;
  }, [events, selectedDay]);

  // Agenda scope: the visible month only. The fetch window includes ±7d of
  // grid overflow, so filter by month prefix rather than showing everything.
  const monthPrefix = toDateString(visibleMonth).slice(0, 7);

  const sections = useMemo<AgendaSection[]>(() => {
    const byDay = new Map<string, CalEvent[]>();
    for (const event of events) {
      for (const day of eventDays(event.start, event.end)) {
        if (!day.startsWith(monthPrefix)) continue;
        const list = byDay.get(day);
        if (list) list.push(event);
        else byDay.set(day, [event]);
      }
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, dayEvents]) => ({
        day,
        events: dayEvents.sort(compareEvents),
      }));
  }, [events, monthPrefix]);

  const listRef = useRef<FlatList<AgendaSection>>(null);

  const scrollToDay = useCallback(
    (day: string, animated = true) => {
      if (sections.length === 0) return;
      // The tapped day may have no events — land on the nearest day after it.
      const index = sections.findIndex((section) => section.day >= day);
      if (index === -1) listRef.current?.scrollToEnd({ animated });
      else listRef.current?.scrollToIndex({ index, animated, viewPosition: 0 });
    },
    [sections]
  );

  // Deep-linked day: scroll to it once its month's events are loaded — covers
  // both a cold start (state seeded above) and a warm one (adjusted above).
  const autoScrolledMonth = useRef<string | null>(null);
  const scrolledForParam = useRef<string | null>(null);
  useEffect(() => {
    if (!dayParam || scrolledForParam.current === dayParam) return;
    if (!dayParam.startsWith(monthPrefix) || sections.length === 0) return;
    scrolledForParam.current = dayParam;
    autoScrolledMonth.current = monthPrefix; // claim the month so today-scroll skips
    scrollToDay(dayParam, false);
  }, [dayParam, monthPrefix, sections, scrollToDay]);

  // Otherwise, once per month, start the agenda at today (current month) or top.
  useEffect(() => {
    if (sections.length === 0) return;
    if (autoScrolledMonth.current === monthPrefix) return;
    autoScrolledMonth.current = monthPrefix;
    if (today.startsWith(monthPrefix)) scrollToDay(today, false);
    else listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [sections, monthPrefix, today, scrollToDay]);

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

  const monthLabel = visibleMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <Calendar
            key={scheme} // react-native-calendars caches theme; remount on scheme change
            testID="month-calendar" // e2e: day cells/arrows derive ids from this
            current={toDateString(visibleMonth)}
            firstDay={1}
            enableSwipeMonths
            onDayPress={(day: DateData) => {
              setSelectedDay(day.dateString);
              scrollToDay(day.dateString);
            }}
            onMonthChange={(month: DateData) =>
              setVisibleMonth(new Date(month.year, month.month - 1, 1))
            }
            markedDates={markedDates}
            theme={
              {
                calendarBackground: 'transparent',
                monthTextColor: theme.text,
                dayTextColor: theme.text,
                textDisabledColor: theme.textSecondary,
                textSectionTitleColor: theme.textSecondary,
                todayTextColor: AccentColor,
                arrowColor: AccentColor,
                selectedDayBackgroundColor: AccentColor,
                selectedDayTextColor: '#ffffff',
                textDayFontFamily: FontFamily,
                textMonthFontFamily: FontFamily,
                textDayHeaderFontFamily: FontFamily,
                // Square the selected/today day highlight (no rounded corners).
                'stylesheet.day.basic': {
                  selected: {
                    backgroundColor: AccentColor,
                    borderRadius: 0,
                  },
                  today: {
                    borderRadius: 0,
                  },
                },
              } as ComponentProps<typeof Calendar>['theme']
            }
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

          <View style={styles.dayHeader}>
            <ThemedText type="smallBold" testID="agenda-month-label">
              {monthLabel}
            </ThemedText>
            <Pressable onPress={refresh} hitSlop={8}>
              <RefreshCw size={16} color={theme.textSecondary} />
            </Pressable>
          </View>

          {loading && events.length === 0 ? (
            <ActivityIndicator color={AccentColor} style={styles.spinner} />
          ) : (
            <FlatList
              ref={listRef}
              testID="agenda-list"
              data={sections}
              keyExtractor={(section) => section.day}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: bottomInset + 72 }, // keep the FAB clear of the last row
              ]}
              onScrollToIndexFailed={({ index, averageItemLength }) => {
                // Target not rendered yet — jump near it, then settle exactly.
                listRef.current?.scrollToOffset({
                  offset: index * averageItemLength,
                  animated: false,
                });
                setTimeout(() => {
                  listRef.current?.scrollToIndex({ index, animated: true });
                }, 80);
              }}
              ListEmptyComponent={
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.empty}
                >
                  No events this month
                </ThemedText>
              }
              renderItem={({ item: section }) => (
                <View style={styles.daySection}>
                  <ThemedText
                    type="smallBold"
                    themeColor={
                      section.day === selectedDay ? undefined : 'textSecondary'
                    }
                    style={styles.dayLabel}
                  >
                    {agendaDayLabel(section.day, today)}
                  </ThemedText>
                  {section.events.map((event) => (
                    <Pressable
                      key={event.id}
                      onPress={() => setEditor({ mode: 'edit', event })}
                    >
                      {({ pressed }) => (
                        <ThemedView
                          type={
                            pressed ? 'backgroundSelected' : 'backgroundElement'
                          }
                          style={styles.eventRow}
                        >
                          <View style={styles.eventTime}>
                            {event.allDay ? (
                              <ThemedText
                                type="small"
                                themeColor="textSecondary"
                              >
                                All day
                              </ThemedText>
                            ) : (
                              <>
                                <ThemedText type="small">
                                  {toTimeString(event.start)}
                                </ThemedText>
                                <ThemedText
                                  type="small"
                                  themeColor="textSecondary"
                                >
                                  {toTimeString(event.end)}
                                </ThemedText>
                              </>
                            )}
                          </View>
                          <View style={styles.eventBody}>
                            <ThemedText numberOfLines={1}>
                              {event.summary || '(untitled)'}
                            </ThemedText>
                            {event.location ? (
                              <ThemedText
                                type="small"
                                themeColor="textSecondary"
                                numberOfLines={1}
                              >
                                {event.location}
                              </ThemedText>
                            ) : null}
                          </View>
                        </ThemedView>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            />
          )}
        </View>
      </SafeAreaView>

      <Pressable
        onPress={() => setEditor({ mode: 'create', day: selectedDay })}
        style={({ pressed }) => [
          styles.fab,
          { bottom: bottomInset },
          pressed && styles.fabPressed,
        ]}
        accessibilityLabel="Add event"
      >
        <CirclePlus size={28} color="#ffffff" />
      </Pressable>

      {snack && (
        <View
          style={[styles.snackWrapper, { bottom: bottomInset + 68 }]}
          pointerEvents="box-none"
        >
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

      {editor.mode !== 'closed' && (
        <EventEditor
          key={editor.mode === 'edit' ? editor.event.id : `new-${editor.day}`}
          event={editor.mode === 'edit' ? editor.event : null}
          defaultDay={editor.mode === 'create' ? editor.day : selectedDay}
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
    paddingHorizontal: Spacing.three,
    paddingTop: Platform.select({ web: Spacing.four, default: Spacing.two }),
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
    borderRadius: 0,
    maxWidth: 480,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 0,
    marginTop: Spacing.two,
  },
  errorText: {
    flex: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  spinner: {
    marginTop: Spacing.five,
  },
  listContent: {
    gap: Spacing.three,
  },
  daySection: {
    gap: Spacing.two,
  },
  dayLabel: {
    paddingHorizontal: Spacing.one,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
  eventRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 0,
  },
  eventTime: {
    width: 52,
  },
  eventBody: {
    flex: 1,
    gap: Spacing.half,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 0,
    backgroundColor: AccentColor,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
  },
  fabPressed: {
    opacity: 0.85,
  },
  snackWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    backgroundColor: '#2E3135',
    borderRadius: 0,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    maxWidth: 480,
  },
  snackText: {
    color: '#ffffff',
    flexShrink: 1,
  },
});

import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { restoreEvent } from '@/caldav/events';
import type { CalEvent } from '@/caldav/types';
import {
  EventEditor,
  type EditorResult,
} from '@/components/calendar/event-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  AccentColor,
  BottomTabInset,
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

export function MonthScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const today = toDateString(new Date());

  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(today);
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const [snack, setSnack] = useState<Snack>(null);

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

  const dayEvents = useMemo(
    () =>
      events
        .filter((event) =>
          eventDays(event.start, event.end).includes(selectedDay)
        )
        .sort((a, b) =>
          a.allDay !== b.allDay
            ? a.allDay
              ? -1
              : 1
            : a.start.getTime() - b.start.getTime()
        ),
    [events, selectedDay]
  );

  function onEditorDone(result: EditorResult) {
    setEditor({ mode: 'closed' });
    refresh();
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

  const selectedDayLabel =
    (parseDay(selectedDay) ?? new Date()).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }) + (selectedDay === today ? ' · Today' : '');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <Calendar
            key={scheme} // react-native-calendars caches theme; remount on scheme change
            current={toDateString(visibleMonth)}
            firstDay={1}
            enableSwipeMonths
            onDayPress={(day: DateData) => setSelectedDay(day.dateString)}
            onMonthChange={(month: DateData) =>
              setVisibleMonth(new Date(month.year, month.month - 1, 1))
            }
            markedDates={markedDates}
            theme={{
              calendarBackground: 'transparent',
              monthTextColor: theme.text,
              dayTextColor: theme.text,
              textDisabledColor: theme.textSecondary,
              textSectionTitleColor: theme.textSecondary,
              todayTextColor: AccentColor,
              arrowColor: AccentColor,
              selectedDayBackgroundColor: AccentColor,
              selectedDayTextColor: '#ffffff',
            }}
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
            <ThemedText type="smallBold">{selectedDayLabel}</ThemedText>
            <Pressable onPress={refresh} hitSlop={8}>
              <SymbolView
                name={{
                  ios: 'arrow.clockwise',
                  android: 'refresh',
                  web: 'refresh',
                }}
                size={16}
                tintColor={theme.textSecondary}
              />
            </Pressable>
          </View>

          {loading && events.length === 0 ? (
            <ActivityIndicator color={AccentColor} style={styles.spinner} />
          ) : (
            <FlatList
              data={dayEvents}
              keyExtractor={(event) => event.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.empty}
                >
                  No events
                </ThemedText>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setEditor({ mode: 'edit', event: item })}
                >
                  {({ pressed }) => (
                    <ThemedView
                      type={
                        pressed ? 'backgroundSelected' : 'backgroundElement'
                      }
                      style={styles.eventRow}
                    >
                      <View style={styles.eventTime}>
                        {item.allDay ? (
                          <ThemedText type="small" themeColor="textSecondary">
                            All day
                          </ThemedText>
                        ) : (
                          <>
                            <ThemedText type="small">
                              {toTimeString(item.start)}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {toTimeString(item.end)}
                            </ThemedText>
                          </>
                        )}
                      </View>
                      <View style={styles.eventBody}>
                        <ThemedText numberOfLines={1}>
                          {item.summary || '(untitled)'}
                        </ThemedText>
                        {item.location ? (
                          <ThemedText
                            type="small"
                            themeColor="textSecondary"
                            numberOfLines={1}
                          >
                            {item.location}
                          </ThemedText>
                        ) : null}
                      </View>
                    </ThemedView>
                  )}
                </Pressable>
              )}
            />
          )}
        </View>
      </SafeAreaView>

      <Pressable
        onPress={() => setEditor({ mode: 'create', day: selectedDay })}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityLabel="Add event"
      >
        <ThemedText style={styles.fabLabel}>＋</ThemedText>
      </Pressable>

      {snack && (
        <View style={styles.snackWrapper} pointerEvents="box-none">
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

const bottomInset = Platform.select({
  web: Spacing.four,
  default: BottomTabInset + Spacing.three,
});

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
    paddingTop: Platform.select({ web: Spacing.six, default: Spacing.two }),
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
    borderRadius: Spacing.three,
    maxWidth: 480,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
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
    gap: Spacing.two,
    paddingBottom: bottomInset + 72, // keep the FAB clear of the last row
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
  eventRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
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
    bottom: bottomInset,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AccentColor,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
  },
  fabPressed: {
    opacity: 0.85,
  },
  fabLabel: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 28,
  },
  snackWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: bottomInset + 68,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    backgroundColor: '#2E3135',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    maxWidth: 480,
  },
  snackText: {
    color: '#ffffff',
    flexShrink: 1,
  },
});

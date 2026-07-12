import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import {
  ConflictError,
  createEvent,
  deleteEvent,
  updateEvent,
} from '@/caldav/events';
import type { CalEvent, EventChanges } from '@/caldav/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  AccentColor,
  DangerColor,
  Fonts,
  OnAccentColor,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  nextFullHour,
  parseDay,
  parseDayTime,
  toDateString,
  toTimeString,
} from '@/utils/date';

export type EditorResult =
  | 'created'
  | 'updated'
  | { deleted: CalEvent }
  | 'conflict';

type Props = {
  /** Event being edited, or null to create a new one. */
  event: CalEvent | null;
  /** Default day (dateString) for a new event. */
  defaultDay: string;
  onClose: () => void;
  onDone: (result: EditorResult) => void;
};

/**
 * Create/edit modal. Dates and times are plain text fields (YYYY-MM-DD / HH:MM) —
 * deliberately dependency-free and identical on Android and web for the first cut.
 * Performs the CalDAV write itself and reports the outcome via onDone.
 */
export function EventEditor({ event, defaultDay, onClose, onDone }: Props) {
  const theme = useTheme();

  const [summary, setSummary] = useState(event?.summary ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [day, setDay] = useState(
    toDateString(event?.start ?? parseDay(defaultDay) ?? new Date())
  );
  const [startTime, setStartTime] = useState(() =>
    event && !event.allDay
      ? toTimeString(event.start)
      : toTimeString(nextFullHour(new Date()))
  );
  const [endTime, setEndTime] = useState(() => {
    if (event && !event.allDay) return toTimeString(event.end);
    const start = nextFullHour(new Date());
    start.setHours(start.getHours() + 1);
    return toTimeString(start);
  });
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputStyle = [
    styles.input,
    { color: theme.text, fontFamily: Fonts.sans },
  ];
  const placeholderColor = theme.textSecondary;

  function resolveTimes(): { start: Date; end: Date } | null {
    if (allDay) {
      const dayDate = parseDay(day);
      if (!dayDate) return null;
      return { start: dayDate, end: dayDate }; // single-day; DTEND handled in ics layer
    }
    const start = parseDayTime(day, startTime);
    const end = parseDayTime(day, endTime);
    if (!start || !end || end <= start) return null;
    return { start, end };
  }

  async function save() {
    const trimmed = summary.trim();
    if (!trimmed) {
      setProblem('Title is required');
      return;
    }
    const times = resolveTimes();
    if (!times) {
      setProblem(
        allDay
          ? 'Date must be YYYY-MM-DD'
          : 'Check date (YYYY-MM-DD) and times (HH:MM, end after start)'
      );
      return;
    }

    setBusy(true);
    setProblem(null);
    try {
      if (!event) {
        await createEvent({
          summary: trimmed,
          ...times,
          allDay,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
        });
        onDone('created');
        return;
      }

      // Diff-based changes: untouched fields stay byte-identical in the ICS
      // (keeps Apple TZID DTSTARTs intact on title-only edits).
      const changes: EventChanges = {};
      if (trimmed !== event.summary) changes.summary = trimmed;
      if (location.trim() !== (event.location ?? ''))
        changes.location = location.trim();
      if (description.trim() !== (event.description ?? ''))
        changes.description = description.trim();
      const timesChanged =
        allDay !== event.allDay ||
        toDateString(event.start) !== day ||
        (!allDay &&
          (toTimeString(event.start) !== startTime ||
            toTimeString(event.end) !== endTime));
      if (timesChanged) {
        changes.start = times.start;
        changes.end = times.end;
        changes.allDay = allDay;
      }

      if (Object.keys(changes).length > 0) await updateEvent(event, changes);
      onDone('updated');
    } catch (err) {
      if (err instanceof ConflictError) {
        onDone('conflict');
        return;
      }
      setBusy(false);
      setProblem(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function remove() {
    if (!event) return;
    setBusy(true);
    setProblem(null);
    try {
      await deleteEvent(event);
      onDone({ deleted: event });
    } catch (err) {
      if (err instanceof ConflictError) {
        onDone('conflict');
        return;
      }
      setBusy(false);
      setProblem(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedText type="subtitle" style={styles.title}>
              {event ? 'Edit event' : 'New event'}
            </ThemedText>

            <TextInput
              style={inputStyle}
              value={summary}
              onChangeText={setSummary}
              placeholder="Title"
              placeholderTextColor={placeholderColor}
              autoFocus={!event}
            />

            <View style={styles.row}>
              <ThemedText type="small">All-day</ThemedText>
              <Switch
                value={allDay}
                onValueChange={setAllDay}
                trackColor={{ true: AccentColor }}
                thumbColor={OnAccentColor}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  Date
                </ThemedText>
                <TextInput
                  style={inputStyle}
                  value={day}
                  onChangeText={setDay}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {!allDay && (
              <View style={styles.row}>
                <View style={styles.field}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Start
                  </ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="HH:MM"
                    placeholderTextColor={placeholderColor}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.field}>
                  <ThemedText type="small" themeColor="textSecondary">
                    End
                  </ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="HH:MM"
                    placeholderTextColor={placeholderColor}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            )}

            <TextInput
              style={inputStyle}
              value={location}
              onChangeText={setLocation}
              placeholder="Location"
              placeholderTextColor={placeholderColor}
            />
            <TextInput
              style={[...inputStyle, styles.notes]}
              value={description}
              onChangeText={setDescription}
              placeholder="Notes"
              placeholderTextColor={placeholderColor}
              multiline
            />

            {problem && (
              <ThemedText type="small" style={{ color: DangerColor }}>
                {problem}
              </ThemedText>
            )}

            <View style={styles.actions}>
              {event && (
                <Pressable
                  onPress={remove}
                  disabled={busy}
                  style={busy && styles.disabled}
                >
                  <ThemedText type="smallBold" style={{ color: DangerColor }}>
                    Delete
                  </ThemedText>
                </Pressable>
              )}
              <View style={styles.actionsRight}>
                <Pressable
                  onPress={onClose}
                  disabled={busy}
                  style={busy && styles.disabled}
                >
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={save}
                  disabled={busy}
                  style={[styles.saveButton, busy && styles.disabled]}
                >
                  <ThemedText type="smallBold" style={styles.saveLabel}>
                    {busy ? 'Saving…' : 'Save'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  card: {
    borderRadius: Spacing.one,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
  },
  form: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
  },
  input: {
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  notes: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  field: {
    flex: 1,
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    marginLeft: 'auto',
  },
  saveButton: {
    backgroundColor: AccentColor,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  saveLabel: {
    color: OnAccentColor,
  },
  disabled: {
    opacity: 0.5,
  },
});

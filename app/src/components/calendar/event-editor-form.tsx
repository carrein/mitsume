import { useEffect, useState, type ComponentType } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import {
  notificationsBlocked,
  requestPermissionIfNeeded,
} from '@/alarms/scheduler';
import {
  type CalendarChoice,
  ConflictError,
  createEvent,
  defaultCalendarUrl,
  deleteEvent,
  listCalendars,
  updateEvent,
} from '@/caldav/events';
import type {
  AlarmInput,
  CalEvent,
  EventChanges,
  RecurrenceInput,
} from '@/caldav/types';
import { AlarmField, type AlarmState } from '@/components/calendar/alarm-field';
import { CalendarField } from '@/components/calendar/calendar-field';
import {
  alarmEqual,
  initialFormState,
  recurEqual,
} from '@/components/calendar/editor-state';
import { LocationField } from '@/components/calendar/location-field';
import {
  RecurrenceField,
  type RecurrenceState,
} from '@/components/calendar/recurrence-field';
import { DateField } from '@/components/fields/date-field';
import { TimeField } from '@/components/fields/time-field';
import { ThemedText } from '@/components/themed-text';
import {
  AccentColor,
  BrandColor,
  DangerColor,
  Fonts,
  OnAccentColor,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addDays,
  dayLabel,
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
  event: CalEvent | null;
  defaultDay: string;
  onClose: () => void;
  onDone: (result: EditorResult) => void;
  /** Sheet shell passes BottomSheetTextInput for keyboard-aware inputs. */
  TextInputComponent?: ComponentType<TextInputProps>;
};

/**
 * The editor form, shell-agnostic: all fields, validation and the CalDAV
 * write (diff-based on edit — untouched ICS properties stay byte-identical).
 * Presentation (centered dialog vs bottom sheet) is the shells' job.
 */
export function EventEditorForm({
  event,
  defaultDay,
  onClose,
  onDone,
  TextInputComponent = TextInput,
}: Props) {
  const theme = useTheme();
  const [initial] = useState(() => initialFormState(event, defaultDay));

  const [summary, setSummary] = useState(initial.summary);
  const [allDay, setAllDay] = useState(initial.allDay);
  const [startDay, setStartDay] = useState(initial.startDay);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endDay, setEndDay] = useState(initial.endDay);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [location, setLocation] = useState(initial.location);
  const [description, setDescription] = useState(initial.description);
  const [recurrence, setRecurrence] = useState<RecurrenceState>(
    initial.recurrence
  );
  const [alarm, setAlarm] = useState<AlarmState>(initial.alarm);
  const [lastValidDay, setLastValidDay] = useState(initial.startDay);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [alarmHint, setAlarmHint] = useState<string | null>(null);
  // Create-only: the calendars to choose from and the selected write target.
  const [calendars, setCalendars] = useState<CalendarChoice[]>([]);
  const [calendarUrl, setCalendarUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Load the calendar list for the create picker, defaulting the selection to
    // the primary calendar. On failure the picker just doesn't show and the
    // create falls back to the default calendar (createEvent handles undefined).
    if (event) return;
    let alive = true;
    Promise.all([listCalendars(), defaultCalendarUrl()])
      .then(([list, url]) => {
        if (!alive) return;
        setCalendars(list);
        setCalendarUrl(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [event]);

  function refreshAlarmHint() {
    // Best-effort — the alarm still saves to the event either way.
    notificationsBlocked()
      .then((blocked) =>
        setAlarmHint(
          blocked
            ? "Notifications are off — reminders won't ring on this device."
            : null
        )
      )
      .catch(() => {});
  }

  const prefilledAlarm = initial.alarm.kind === 'set';
  useEffect(() => {
    if (prefilledAlarm) refreshAlarmHint();
  }, [prefilledAlarm]);

  const inputStyle = [
    styles.input,
    { color: theme.text, fontFamily: Fonts.sans },
  ];
  const placeholderColor = theme.textSecondary;

  /** Start moved — keep the event's duration by shifting the end with it. */
  function moveStart(nextDay: string, nextTime: string) {
    if (parseDay(nextDay)) setLastValidDay(nextDay);
    if (allDay) {
      const oldStart = parseDay(startDay);
      const oldEnd = parseDay(endDay);
      if (oldStart && oldEnd && parseDay(nextDay)) {
        const days = Math.round(
          (oldEnd.getTime() - oldStart.getTime()) / 86_400_000
        );
        setEndDay(addDays(nextDay, Math.max(0, days)));
      }
      setStartDay(nextDay);
      return;
    }
    const oldStart = parseDayTime(startDay, startTime);
    const oldEnd = parseDayTime(endDay, endTime);
    const newStart = parseDayTime(nextDay, nextTime);
    if (oldStart && oldEnd && newStart) {
      const newEnd = new Date(
        newStart.getTime() + (oldEnd.getTime() - oldStart.getTime())
      );
      setEndDay(toDateString(newEnd));
      setEndTime(toTimeString(newEnd));
    }
    setStartDay(nextDay);
    setStartTime(nextTime);
  }

  function resolveTimes(): { start: Date; end: Date } | null {
    if (allDay) {
      const start = parseDay(startDay);
      const end = parseDay(endDay);
      if (!start || !end || end < start) return null;
      return { start, end }; // inclusive end; the ICS layer writes DTEND +1d
    }
    const start = parseDayTime(startDay, startTime);
    const end = parseDayTime(endDay, endTime);
    if (!start || !end || end <= start) return null;
    return { start, end };
  }

  /** RecurrenceInput for the write, null for none, or a validation problem. */
  function resolveRecurrence(): RecurrenceInput | null | { error: string } {
    if (recurrence.kind !== 'preset') return null;
    const input: RecurrenceInput = { preset: recurrence.preset };
    if (recurrence.end.type === 'until') {
      const until = parseDay(recurrence.end.day);
      if (!until) return { error: 'Pick a repeat end date' };
      if (recurrence.end.day < startDay)
        return { error: 'Repeat end is before the start' };
      input.until = until;
    } else if (recurrence.end.type === 'count') {
      if (!Number.isInteger(recurrence.end.n) || recurrence.end.n < 1)
        return { error: 'Repeat count must be at least 1' };
      input.count = recurrence.end.n;
    }
    return input;
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
        allDay ? 'End date is before the start' : 'End must be after the start'
      );
      return;
    }
    const rec = resolveRecurrence();
    if (rec && 'error' in rec) {
      setProblem(rec.error);
      return;
    }
    const alarmInput: AlarmInput | null =
      alarm.kind === 'set' ? { offsetMinutes: alarm.offsetMinutes } : null;

    setBusy(true);
    setProblem(null);
    try {
      if (!event) {
        await createEvent(
          {
            summary: trimmed,
            ...times,
            allDay,
            location: location.trim() || undefined,
            description: description.trim() || undefined,
            ...(rec ? { recurrence: rec } : {}),
            ...(alarmInput ? { alarm: alarmInput } : {}),
          },
          calendarUrl
        );
        onDone('created');
        return;
      }

      // Diff-based changes: untouched fields stay byte-identical in the ICS
      // (keeps Apple TZID DTSTARTs — and foreign RRULEs/VALARMs — intact).
      const changes: EventChanges = {};
      if (trimmed !== event.summary) changes.summary = trimmed;
      if (location.trim() !== (event.location ?? ''))
        changes.location = location.trim();
      if (description.trim() !== (event.description ?? ''))
        changes.description = description.trim();
      const timesChanged =
        allDay !== initial.allDay ||
        startDay !== initial.startDay ||
        endDay !== initial.endDay ||
        (!allDay &&
          (startTime !== initial.startTime || endTime !== initial.endTime));
      if (timesChanged) {
        changes.start = times.start;
        changes.end = times.end;
        changes.allDay = allDay;
      }
      if (
        initial.recurrence.kind !== 'custom' &&
        !recurEqual(recurrence, initial.recurrence)
      ) {
        changes.recurrence = rec;
      }
      if (
        initial.alarm.kind !== 'foreign' &&
        !alarmEqual(alarm, initial.alarm)
      ) {
        changes.alarm = alarmInput;
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

  const headerDay = parseDay(startDay) ? startDay : lastValidDay;

  return (
    <View style={styles.form} testID="event-editor">
      <ThemedText type="subtitle" style={styles.title} testID="editor-title">
        {dayLabel(headerDay)}
      </ThemedText>

      <TextInputComponent
        style={inputStyle}
        value={summary}
        onChangeText={setSummary}
        placeholder="Title"
        placeholderTextColor={placeholderColor}
        autoFocus={!event}
        testID="editor-summary"
      />

      {!event && calendars.length > 1 && calendarUrl && (
        <CalendarField
          calendars={calendars}
          value={calendarUrl}
          onChange={setCalendarUrl}
          testID="editor-calendar"
        />
      )}

      <View style={styles.row}>
        <ThemedText type="small">All-day</ThemedText>
        <Switch
          value={allDay}
          onValueChange={(next) => {
            setAllDay(next);
            // The alarm preset sets differ; an incompatible pick is cleared.
            if (alarm.kind === 'set') setAlarm({ kind: 'none' });
            if (parseDay(startDay) && endDay < startDay) setEndDay(startDay);
          }}
          trackColor={{ true: AccentColor }}
          thumbColor={OnAccentColor}
          testID="editor-all-day"
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Starts
        </ThemedText>
        <View style={styles.row}>
          <View style={styles.dateCell}>
            <DateField
              value={startDay}
              onChange={(d) => moveStart(d, startTime)}
              testID="editor-start-date"
            />
          </View>
          {!allDay && (
            <View style={styles.timeCell}>
              <TimeField
                value={startTime}
                onChange={(t) => moveStart(startDay, t)}
                testID="editor-start-time"
              />
            </View>
          )}
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Ends
        </ThemedText>
        <View style={styles.row}>
          <View style={styles.dateCell}>
            <DateField
              value={endDay}
              min={startDay}
              onChange={setEndDay}
              testID="editor-end-date"
            />
          </View>
          {!allDay && (
            <View style={styles.timeCell}>
              <TimeField
                value={endTime}
                onChange={setEndTime}
                testID="editor-end-time"
              />
            </View>
          )}
        </View>
      </View>

      <RecurrenceField
        value={recurrence}
        onChange={setRecurrence}
        startDay={headerDay}
        TextInputComponent={TextInputComponent}
        testID="editor-repeat"
      />

      <AlarmField
        value={alarm}
        onChange={(next) => {
          setAlarm(next);
          if (next.kind === 'set') {
            // First alarm = the user gesture we ask POST_NOTIFICATIONS on.
            requestPermissionIfNeeded()
              .catch(() => {})
              .finally(refreshAlarmHint);
          }
        }}
        allDay={allDay}
        hint={alarmHint}
        testID="editor-alert"
      />

      <LocationField
        value={location}
        onChange={setLocation}
        style={inputStyle}
        placeholderTextColor={placeholderColor}
        TextInputComponent={TextInputComponent}
        testID="editor-location"
      />
      <TextInputComponent
        style={[...inputStyle, styles.notes]}
        value={description}
        onChangeText={setDescription}
        placeholder="Notes"
        placeholderTextColor={placeholderColor}
        multiline
        testID="editor-notes"
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
            testID="editor-delete"
          >
            <ThemedText type="smallBold" style={{ color: DangerColor }}>
              {event.recurring ? 'Delete series' : 'Delete'}
            </ThemedText>
          </Pressable>
        )}
        <View style={styles.actionsRight}>
          <Pressable
            onPress={onClose}
            disabled={busy}
            style={busy && styles.disabled}
            testID="editor-cancel"
          >
            <ThemedText type="smallBold" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={busy}
            style={[styles.saveButton, busy && styles.disabled]}
            testID="editor-save"
          >
            <ThemedText type="smallBold" style={styles.saveLabel}>
              {busy ? 'Saving…' : 'Save'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    color: BrandColor,
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
    gap: Spacing.one,
  },
  dateCell: {
    flex: 3,
  },
  timeCell: {
    flex: 2,
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

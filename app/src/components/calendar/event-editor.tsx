import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import type { CalEvent } from '@/caldav/types';
import {
  EventEditorForm,
  type EditorResult,
} from '@/components/calendar/event-editor-form';
import { EventEditorSheet } from '@/components/calendar/event-editor-sheet';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useIsWide } from '@/hooks/use-is-wide';

export type { EditorResult } from '@/components/calendar/event-editor-form';

type Props = {
  /** Event being edited, or null to create a new one. */
  event: CalEvent | null;
  /** Default day (dateString) for a new event. */
  defaultDay: string;
  onClose: () => void;
  onDone: (result: EditorResult) => void;
};

/**
 * Create/edit editor: one shared form (event-editor-form.tsx), two shells —
 * a centered dialog on wide layouts, a bottom sheet on narrow ones (the
 * Android app and phone-width web). The form performs the CalDAV write
 * itself and reports the outcome via onDone.
 */
export function EventEditor({ event, defaultDay, onClose, onDone }: Props) {
  const isWide = useIsWide();

  if (!isWide) {
    return (
      <EventEditorSheet
        event={event}
        defaultDay={defaultDay}
        onClose={onClose}
        onDone={onDone}
      />
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <EventEditorForm
              event={event}
              defaultDay={defaultDay}
              onClose={onClose}
              onDone={onDone}
            />
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
});

import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import {
  BackHandler,
  Platform,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from 'react-native';

import type { CalEvent } from '@/caldav/types';
import {
  EventEditorForm,
  type EditorResult,
} from '@/components/calendar/event-editor-form';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  event: CalEvent | null;
  defaultDay: string;
  onClose: () => void;
  onDone: (result: EditorResult) => void;
};

// BottomSheetTextInput's keyboard hooks call native TextInput.State APIs that
// react-native-web doesn't implement (crashes on blur) — and the browser
// manages its own keyboard anyway, so the plain input is correct on web.
const SheetTextInput = Platform.OS === 'web' ? TextInput : BottomSheetTextInput;

function Backdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
    />
  );
}

/**
 * Narrow-layout shell: the editor form in a bottom sheet (drag-to-dismiss,
 * keyboard-aware). Mounted only while open — presents itself on mount and
 * reports every dismissal path through onClose.
 */
export function EventEditorSheet({
  event,
  defaultDay,
  onClose,
  onDone,
}: Props) {
  const theme = useTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const { height } = useWindowDimensions();

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  // The library leaves the Android back button to us (predictive back is off
  // in app.json, so BackHandler is reliable).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      sheetRef.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, []);

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={onClose}
      enableDynamicSizing
      maxDynamicContentSize={height * 0.9}
      enablePanDownToClose
      backdropComponent={Backdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{
        backgroundColor: theme.backgroundElement,
        borderRadius: Spacing.one,
      }}
      handleIndicatorStyle={{ backgroundColor: theme.textSecondary }}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <EventEditorForm
          event={event}
          defaultDay={defaultDay}
          onClose={() => sheetRef.current?.dismiss()}
          onDone={onDone}
          TextInputComponent={SheetTextInput}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    // Extra tail room: bottom-most inputs can land behind the keyboard on
    // Android (gorhom #1934) — padding keeps them scrollable into view.
    paddingBottom: Spacing.five,
  },
});

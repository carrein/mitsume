import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthScreen } from '@/components/calendar/month-screen';
import { ChatPlaceholder } from '@/components/home/chat-placeholder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useIsWide } from '@/hooks/use-is-wide';
import { useTheme } from '@/hooks/use-theme';

type Pane = 'notes' | 'calendar';

export function HomeScreen() {
  const isWide = useIsWide();
  const theme = useTheme();
  const [pane, setPane] = useState<Pane>('calendar');

  if (isWide) {
    return (
      <ThemedView style={styles.split}>
        <View style={styles.notesPane}>
          <ChatPlaceholder />
        </View>
        <View
          style={[
            styles.divider,
            { backgroundColor: theme.backgroundSelected },
          ]}
        />
        <View style={styles.calendarPane}>
          <MonthScreen />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']}>
        <View style={styles.toggleRow}>
          <PaneButton
            label="Notes"
            active={pane === 'notes'}
            onPress={() => setPane('notes')}
          />
          <PaneButton
            label="Calendar"
            active={pane === 'calendar'}
            onPress={() => setPane('calendar')}
          />
        </View>
      </SafeAreaView>
      {pane === 'notes' ? <ChatPlaceholder /> : <MonthScreen />}
    </ThemedView>
  );
}

function PaneButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedView
        type={active ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.paneButton}
      >
        <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  split: {
    flex: 1,
    flexDirection: 'row',
  },
  notesPane: {
    flex: 2,
  },
  calendarPane: {
    flex: 1,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
  },
  container: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  paneButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.one,
  },
});

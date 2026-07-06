import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** Stand-in for the chat/note-taking pane until it's built. */
export function ChatPlaceholder() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">mitsume</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Notes — coming soon
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
});

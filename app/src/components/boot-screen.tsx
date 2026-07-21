import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { AccentColor } from '@/constants/theme';

/** Full-screen spinner shown while the app shell boots (hydration + fonts). */
export function BootScreen() {
  return (
    <ThemedView style={styles.root}>
      <ActivityIndicator size="large" color={AccentColor} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

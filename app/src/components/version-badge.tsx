import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/**
 * Build identifier pinned to the bottom-right of every screen (web + native).
 * `dev` marks debug builds so a phone with both variants installed is
 * unambiguous about which one is on screen.
 */
export function VersionBadge() {
  const version = Constants.expoConfig?.version ?? '?';
  return (
    <View style={styles.wrapper} pointerEvents="none">
      <ThemedText themeColor="textSecondary" style={styles.label}>
        v{version}
        {__DEV__ ? ' dev' : ''}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 2,
    right: 6,
    opacity: 0.55,
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
  },
});

import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/**
 * Discreet zoom readout in the canvas corner: − / current % / +.
 * Tapping the percentage resets to 100%.
 */
export function ZoomControl({
  percent,
  onStep,
  onReset,
}: {
  percent: number;
  /** direction: +1 zoom in, −1 zoom out (parent zooms at viewport center). */
  onStep: (direction: 1 | -1) => void;
  onReset: () => void;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <ZoomButton label="−" onPress={() => onStep(-1)} />
      <Pressable
        onPress={onReset}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.percent}
        >
          {percent}%
        </ThemedText>
      </Pressable>
      <ZoomButton label="+" onPress={() => onStep(1)} />
    </ThemedView>
  );
}

function ZoomButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedText type="small" themeColor="textSecondary" style={styles.button}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  button: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  percent: {
    minWidth: 48,
    textAlign: 'center',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});

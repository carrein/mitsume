import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AccentColor, OnAccentColor, Spacing } from '@/constants/theme';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  testID?: string;
};

/**
 * Wrapping row of selectable pills — the editor's dependency-free stand-in
 * for a dropdown (repeat preset, repeat end, alert offset).
 */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  testID,
}: Props<T>) {
  return (
    <View style={styles.row} testID={testID}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <ThemedText
              type="small"
              style={selected ? styles.labelSelected : undefined}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  chipSelected: {
    backgroundColor: AccentColor,
  },
  labelSelected: {
    color: OnAccentColor,
  },
});

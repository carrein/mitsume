import { useState, type ComponentType } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLocationSearch } from '@/hooks/use-location-search';

type Props = {
  value: string;
  onChange: (next: string) => void;
  style?: TextInputProps['style'];
  placeholderTextColor?: TextInputProps['placeholderTextColor'];
  TextInputComponent?: ComponentType<TextInputProps>;
  testID?: string;
};

/**
 * Location input with Photon search-as-you-type. Suggestions render inline
 * under the field (works in both shells); picking one fills the text. When
 * Photon is unreachable this is exactly a plain text field.
 */
export function LocationField({
  value,
  onChange,
  style,
  placeholderTextColor,
  TextInputComponent = TextInput,
  testID,
}: Props) {
  const [focused, setFocused] = useState(false);
  // The prefilled value counts as picked — no queries until the user types.
  const [picked, setPicked] = useState<string | null>(value || null);
  const suggestions = useLocationSearch(value, focused && value !== picked);

  return (
    <View style={styles.column}>
      <TextInputComponent
        style={style}
        value={value}
        onChangeText={(next) => {
          setPicked(null);
          onChange(next);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Location"
        placeholderTextColor={placeholderTextColor}
        testID={testID}
      />
      {suggestions.length > 0 && (
        <View
          style={styles.list}
          testID={testID ? `${testID}-suggestions` : undefined}
        >
          {suggestions.map((label) => (
            <Pressable
              key={label}
              style={styles.item}
              // onPressIn beats the input's blur — a tap can't lose the race
              // against the suggestion list unmounting.
              onPressIn={() => {
                setPicked(label);
                onChange(label);
              }}
            >
              <ThemedText type="small">{label}</ThemedText>
            </Pressable>
          ))}
          <ThemedText type="code" themeColor="textSecondary">
            Search by Photon · data © OpenStreetMap contributors
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  item: {
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
    backgroundColor: 'rgba(128,128,128,0.10)',
  },
});

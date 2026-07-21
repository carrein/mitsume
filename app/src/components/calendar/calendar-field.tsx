import { StyleSheet, View } from 'react-native';

import type { CalendarChoice } from '@/caldav/events';
import { ChipRow } from '@/components/fields/chip-row';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props = {
  calendars: CalendarChoice[];
  /** Selected calendar URL (the create write target). */
  value: string;
  onChange: (url: string) => void;
  testID?: string;
};

/**
 * Create-only picker: which calendar a new event is written into. The form
 * mounts it only when the account has more than one calendar — a single
 * calendar makes the choice moot.
 */
export function CalendarField({ calendars, value, onChange, testID }: Props) {
  const options = calendars.map((c) => ({ value: c.url, label: c.name }));
  return (
    <View style={styles.column} testID={testID}>
      <ThemedText type="small" themeColor="textSecondary">
        Calendar
      </ThemedText>
      <ChipRow
        options={options}
        value={value}
        onChange={onChange}
        testID={testID ? `${testID}-pick` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: Spacing.one + Spacing.half,
  },
});

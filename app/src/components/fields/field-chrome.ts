// Shared contract + look for the date/time fields. The .tsx/.web.tsx pairs
// must stay visually in sync with the editor's TextInputs — chrome constants
// live here so parity is structural, not copy-paste.
import { Spacing } from '@/constants/theme';

export type DateFieldProps = {
  /** 'YYYY-MM-DD' */
  value: string;
  onChange: (next: string) => void;
  /** Inclusive bounds, 'YYYY-MM-DD'. */
  min?: string;
  max?: string;
  testID?: string;
};

export type TimeFieldProps = {
  /** 'HH:MM' (24h) */
  value: string;
  onChange: (next: string) => void;
  testID?: string;
};

/** Mirrors the editor's input chrome (event-editor styles.input). */
export const FieldChrome = {
  borderRadius: Spacing.one,
  paddingHorizontal: Spacing.three,
  paddingVertical: Spacing.two,
  fontSize: 16,
  backgroundColor: 'rgba(128,128,128,0.15)',
} as const;

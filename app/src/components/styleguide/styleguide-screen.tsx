import { type ReactNode, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WidgetPreview } from 'react-native-android-widget';

import { AddIcon, RefreshIcon, SunIcon } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import {
  AccentColor,
  BrandColor,
  Colors,
  DangerColor,
  FontFamily,
  FontFamilyBold,
  MaxContentWidth,
  OnAccentColor,
  Spacing,
  type ThemeColor,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { renderAgenda } from '@/widget/agenda';
import type { WidgetCache } from '@/widget/types';

type Scheme = 'light' | 'dark';
type Palette = Record<ThemeColor, string>;

const PaletteTokens = Object.keys(Colors.light) as ThemeColor[];

const BrandConstants = [
  { name: 'AccentColor', value: AccentColor },
  { name: 'BrandColor', value: BrandColor },
  { name: 'DangerColor', value: DangerColor },
  { name: 'OnAccentColor', value: OnAccentColor },
] as const;

const TextTypes = [
  'title',
  'subtitle',
  'default',
  'small',
  'smallBold',
  'code',
] as const;

const SurfaceTypes = [
  'background',
  'backgroundElement',
  'backgroundSelected',
] as const;

/**
 * Dev-only visual inventory of the design system, rendered from the live
 * values in constants/theme.ts so it can never drift from the app. The sun
 * button toggles this screen between schemes without touching the system
 * theme, so every color is applied from the local palette rather than
 * through useTheme().
 */
export function StyleguideScreen() {
  const system = useColorScheme();
  const [scheme, setScheme] = useState<Scheme>(
    system === 'dark' ? 'dark' : 'light'
  );
  const palette: Palette = Colors[scheme];

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <ThemedText type="title" style={{ color: palette.text }}>
            Styleguide
          </ThemedText>
          <Pressable
            accessibilityLabel="Toggle color scheme"
            onPress={() => setScheme(scheme === 'light' ? 'dark' : 'light')}
            style={[styles.toggle, { borderColor: palette.backgroundSelected }]}
          >
            <SunIcon size={20} color={palette.text} />
            <ThemedText type="code" style={{ color: palette.textSecondary }}>
              {scheme}
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText type="small" style={{ color: palette.textSecondary }}>
          Live render of constants/theme.ts — tap the sun to toggle the scheme;
          tokens below show their value in the current scheme.
        </ThemedText>

        <Section title="Colors" palette={palette}>
          <ThemedText type="smallBold" style={{ color: palette.text }}>
            Theme tokens ({scheme})
          </ThemedText>
          {PaletteTokens.map((token) => (
            <View key={token} style={styles.row}>
              <Swatch color={palette[token]} palette={palette} />
              <ThemedText type="code" style={{ color: palette.text }}>
                {token}
              </ThemedText>
              <ThemedText
                type="code"
                style={[styles.hex, { color: palette.textSecondary }]}
              >
                {palette[token]}
              </ThemedText>
            </View>
          ))}
          <ThemedText
            type="smallBold"
            style={[styles.subheading, { color: palette.text }]}
          >
            Constants (scheme-invariant)
          </ThemedText>
          {BrandConstants.map(({ name, value }) => (
            <View key={name} style={styles.row}>
              <Swatch color={value} palette={palette} />
              <ThemedText type="code" style={{ color: palette.text }}>
                {name}
              </ThemedText>
              <ThemedText
                type="code"
                style={[styles.hex, { color: palette.textSecondary }]}
              >
                {value}
              </ThemedText>
            </View>
          ))}
        </Section>

        <Section title="Typography" palette={palette}>
          {TextTypes.map((type) => (
            <ThemedText key={type} type={type} style={{ color: palette.text }}>
              {type} — Sphinx of black quartz 0123
            </ThemedText>
          ))}
          <ThemedText style={{ color: palette.textSecondary }}>
            textSecondary — supporting copy
          </ThemedText>
        </Section>

        <Section title="Surfaces" palette={palette}>
          {SurfaceTypes.map((type) => (
            <View
              key={type}
              style={[styles.surfaceCard, { backgroundColor: palette[type] }]}
            >
              <ThemedText type="code" style={{ color: palette.text }}>
                {type}
              </ThemedText>
            </View>
          ))}
        </Section>

        <Section title="Components" palette={palette}>
          <View style={styles.row}>
            <AddIcon color={palette.text} />
            <RefreshIcon color={palette.textSecondary} />
            <ThemedText
              type="code"
              style={[styles.hex, { color: palette.textSecondary }]}
            >
              icons: text / textSecondary
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.fab}>
              <AddIcon size={28} color={OnAccentColor} />
            </View>
            <View style={styles.saveButton}>
              <ThemedText type="smallBold" style={{ color: OnAccentColor }}>
                Save
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={{ color: DangerColor }}>
              Delete
            </ThemedText>
          </View>
          <View style={styles.snack}>
            <ThemedText type="small" style={{ color: Colors.dark.text }}>
              Event deleted
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: AccentColor }}>
              Undo
            </ThemedText>
          </View>
        </Section>

        <Section title="Widget" palette={palette}>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            {Platform.OS === 'android'
              ? 'The real agenda widget (renderAgenda + sample events), drawn by the native RemoteViews renderer.'
              : 'Web replica of the agenda widget (sizes from widget/agenda.tsx, sample events). The true native render is Android-only — open this screen in the dev build.'}
          </ThemedText>
          <View
            style={[
              styles.launcher,
              { backgroundColor: palette.backgroundElement },
            ]}
          >
            {Platform.OS === 'android' ? (
              <WidgetPreview
                renderWidget={() => {
                  const rep = renderAgenda(SampleCache);
                  if (!('light' in rep)) return rep;
                  return rep[scheme] ?? rep.light;
                }}
                width={320}
                height={260}
              />
            ) : (
              <WidgetReplica palette={palette} />
            )}
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  palette,
  children,
}: {
  title: string;
  palette: Palette;
  children: ReactNode;
}) {
  return (
    <>
      <ThemedText
        type="subtitle"
        style={[styles.heading, { color: palette.text }]}
      >
        {title}
      </ThemedText>
      {children}
    </>
  );
}

function Swatch({ color, palette }: { color: string; palette: Palette }) {
  return (
    <View
      style={[
        styles.swatch,
        { backgroundColor: color, borderColor: palette.backgroundSelected },
      ]}
    />
  );
}

/** Today-relative sample events for the widget preview: an all-day, a timed
 * event with a location, and a 2-day span (exercises the (n/N) marker). */
function makeSampleCache(): WidgetCache {
  const now = new Date();
  const at = (dayOffset: number, h = 0, m = 0) =>
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + dayOffset,
      h,
      m
    ).toISOString();
  return {
    fetchedAt: at(0, 9, 41),
    events: [
      { summary: 'Laundry day', start: at(0), end: at(1), allDay: true },
      {
        summary: 'Dentist',
        start: at(0, 14, 0),
        end: at(0, 15, 0),
        allDay: false,
        location: 'Clinic, Level 3',
      },
      { summary: 'Beach trip', start: at(1), end: at(3), allDay: true },
    ],
  };
}

const SampleCache = makeSampleCache();

/** Non-interactive mirror of the widget tree in plain Views: FlexWidget →
 * View, TextWidget → Text, with the sizes/paddings copied from agenda.tsx. */
function WidgetReplica({ palette }: { palette: Palette }) {
  return (
    <View style={[styles.widget, { backgroundColor: palette.background }]}>
      <View style={styles.widgetHeader}>
        <View>
          <Text style={styles.widgetDate}>Fri ▪ 10 Jul</Text>
          <Text style={styles.widgetUpdated}>Last Updated: 09:41</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.widgetIconButton}>
            <AddIcon size={28} color={OnAccentColor} />
          </View>
          <View style={[styles.widgetIconButton, { marginLeft: 6 }]}>
            <RefreshIcon size={28} color={OnAccentColor} />
          </View>
        </View>
      </View>
      <View style={styles.widgetBody}>
        <WidgetDayHeader label="Today" palette={palette} />
        <View style={styles.widgetEvents}>
          <View style={styles.row}>
            <SunIcon size={14} color={AccentColor} />
            <Text style={[styles.widgetRowText, { color: palette.text }]}>
              Laundry day
            </Text>
          </View>
          <View>
            <Text style={[styles.widgetRowText, { color: palette.text }]}>
              14:00 ▪ Dentist
            </Text>
            <Text style={[styles.widgetLocation, { color: palette.text }]}>
              Clinic, Level 3
            </Text>
          </View>
        </View>
        <WidgetDayHeader label="Tomorrow" palette={palette} />
        <View style={styles.widgetEvents}>
          <View style={styles.row}>
            <SunIcon size={14} color={AccentColor} />
            <Text style={[styles.widgetRowText, { color: palette.text }]}>
              Beach trip
            </Text>
            <Text
              style={[styles.widgetMarker, { color: palette.textSecondary }]}
            >
              (1/2)
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function WidgetDayHeader({
  label,
  palette,
}: {
  label: string;
  palette: Palette;
}) {
  return (
    <View
      style={[
        styles.widgetDayHeader,
        { borderBottomColor: palette.backgroundSelected },
      ]}
    >
      <Text style={styles.widgetDayLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  heading: {
    marginTop: Spacing.four,
  },
  subheading: {
    marginTop: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hex: {
    marginLeft: 'auto',
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: Spacing.one,
    borderWidth: 1,
  },
  surfaceCard: {
    padding: Spacing.three,
    borderRadius: Spacing.one,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: Spacing.one,
    backgroundColor: AccentColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: AccentColor,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    backgroundColor: Colors.dark.backgroundSelected,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    alignSelf: 'flex-start',
  },
  launcher: {
    padding: Spacing.four,
    borderRadius: Spacing.one,
    alignSelf: 'flex-start',
  },
  widget: {
    width: 340,
    borderRadius: 4,
    overflow: 'hidden',
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: AccentColor,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  widgetDate: {
    fontSize: 20,
    fontFamily: FontFamilyBold,
    color: OnAccentColor,
  },
  widgetUpdated: {
    fontSize: 12,
    fontFamily: FontFamily,
    color: OnAccentColor,
  },
  widgetIconButton: {
    padding: 6,
  },
  widgetBody: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  widgetDayHeader: {
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  widgetDayLabel: {
    fontSize: 12,
    fontFamily: FontFamilyBold,
    color: AccentColor,
  },
  widgetEvents: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 4,
  },
  widgetRowText: {
    fontSize: 13,
    fontFamily: FontFamily,
  },
  widgetLocation: {
    fontSize: 11,
    fontFamily: FontFamily,
  },
  widgetMarker: {
    fontSize: 12,
    fontFamily: FontFamily,
  },
});

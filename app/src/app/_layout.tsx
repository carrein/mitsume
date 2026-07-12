import '@/polyfills';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { VersionBadge } from '@/components/version-badge';
import { useSilentReload } from '@/hooks/use-silent-reload';
import { refreshAgendaWidget } from '@/widget/app-refresh';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Web loads Monaspace Krypton at runtime (@font-face injection); native embeds
  // it via the expo-font config plugin (and the widget reads assets/fonts).
  useFonts({
    MonaspaceKrypton: require('../../assets/fonts/MonaspaceKrypton.otf'),
    MonaspaceKrypton_bold: require('../../assets/fonts/MonaspaceKrypton_bold.otf'),
  });
  useSilentReload();
  useEffect(() => {
    // DEFERRED on purpose — do not fire this during boot. The widget render
    // allocates large transient bitmaps (full widget + every row, ×2 for
    // light/dark); overlapped with app-startup allocations it blew the 256 MB
    // heap cap and OOM-crashed the app right after launch (observed on
    // OnePlus/560dpi, v0.2.2; full story in
    // .claude/plans/android-agenda-widget-plan.md §Field debugging).
    const timer = setTimeout(refreshAgendaWidget, 5000);
    return () => clearTimeout(timer);
  }, []);
  return (
    // Required by react-native-gesture-handler (canvas pan/pinch) on every
    // platform, web included — gestures aren't recognized outside this view.
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Slot />
        <VersionBadge />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

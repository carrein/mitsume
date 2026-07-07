import '@/polyfills';

import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { refreshAgendaWidget } from '@/widget/app-refresh';

export default function RootLayout() {
  const colorScheme = useColorScheme();
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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Slot />
    </ThemeProvider>
  );
}

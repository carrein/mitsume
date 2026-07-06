import '@/polyfills';

import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { refreshAgendaWidget } from '@/widget/app-refresh';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useEffect(() => {
    refreshAgendaWidget();
  }, []);
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Slot />
    </ThemeProvider>
  );
}

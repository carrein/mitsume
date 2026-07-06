// Custom entry: expo-router plus the Android widget task handler, which runs
// headlessly and never passes through _layout.tsx — so polyfills load here.
import '@/polyfills';
import 'expo-router/entry';
import '@/widget/register';

import { Redirect } from 'expo-router';

import { StyleguideScreen } from '@/components/styleguide/styleguide-screen';

/** Dev-only design-system inventory; hidden from release builds. */
export default function StyleguideRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <StyleguideScreen />;
}

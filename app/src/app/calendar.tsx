import { Redirect } from 'expo-router';

/** Old tab route — the calendar now lives on the home screen. */
export default function CalendarRoute() {
  return <Redirect href="/" />;
}

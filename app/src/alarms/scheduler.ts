// Android notification backend for event alarms (expo-notifications).
// Geometry/behavior twin: scheduler.web.ts (tab-open timer + Notification API).
// Exact delivery comes from USE_EXACT_ALARM / SCHEDULE_EXACT_ALARM in app.json
// (install-time grants — the library then takes its setExactAndAllowWhileIdle
// branch); reboot replay is handled by the library's BOOT_COMPLETED receiver.
import * as Notifications from 'expo-notifications';

import { ALARM_ID_PREFIX, type DesiredAlarm } from './occurrences';

const CHANNEL_ID = 'event-alarms';

let setupDone = false;

/** Channel + foreground-display handler. Idempotent; call before scheduling. */
export async function ensureSetup(): Promise<void> {
  if (setupDone) return;
  setupDone = true;
  // Without a handler, alarms firing while the app is foregrounded show
  // nothing at all.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Event alarms',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Ask for POST_NOTIFICATIONS (Android 13+) — call from a user gesture. */
export async function requestPermissionIfNeeded(): Promise<void> {
  const status = await Notifications.getPermissionsAsync();
  if (!status.granted && status.canAskAgain)
    await Notifications.requestPermissionsAsync();
}

/** True when alarms can never ring here (permission permanently denied). */
export async function notificationsBlocked(): Promise<boolean> {
  const status = await Notifications.getPermissionsAsync();
  return !status.granted && !status.canAskAgain;
}

export async function listScheduledAlarmIds(): Promise<string[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all
    .map((request) => request.identifier)
    .filter((id) => id.startsWith(ALARM_ID_PREFIX));
}

export async function scheduleAlarm(alarm: DesiredAlarm): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: alarm.id, // same id replaces — reconcile stays idempotent
      content: {
        title: alarm.title,
        body: alarm.body,
        data: { day: alarm.day },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: alarm.fireDate,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    // Android caps concurrent alarms (~500/app); a miss self-heals on the
    // next reconcile once the horizon rolls.
  }
}

export async function cancelAlarm(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

/**
 * Notification-tap deep-link: yields the occurrence's day ('YYYY-MM-DD').
 * Covers warm taps and the cold-start tap. Returns an unsubscribe.
 */
export function onAlarmTap(cb: (day: string) => void): () => void {
  const deliver = (
    response: Notifications.NotificationResponse | null
  ): void => {
    const day = response?.notification.request.content.data?.day;
    if (typeof day === 'string') cb(day);
  };
  const sub = Notifications.addNotificationResponseReceivedListener(deliver);
  Notifications.getLastNotificationResponseAsync().then(deliver, () => {});
  return () => sub.remove();
}

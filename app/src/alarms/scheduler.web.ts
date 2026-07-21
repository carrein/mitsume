// Web notification backend for event alarms — deliberately best-effort: a
// ~30s timer fires `new Notification()` while a tab is open (expo-notifications
// has no web support in SDK 56; Notification Triggers never shipped; Web Push
// would route through a third-party push service). Android is the real
// delivery path. Geometry/behavior twin: scheduler.ts.
import { ALARM_ID_PREFIX, type DesiredAlarm } from './occurrences';

const CHECK_MS = 30_000;

const scheduled = new Map<string, DesiredAlarm>();
let timer: ReturnType<typeof setInterval> | null = null;
let tapCb: ((day: string) => void) | null = null;

function supported(): boolean {
  return typeof Notification !== 'undefined';
}

function checkDue(): void {
  const now = Date.now();
  for (const alarm of [...scheduled.values()]) {
    if (alarm.fireDate.getTime() > now) continue;
    scheduled.delete(alarm.id);
    if (!supported() || Notification.permission !== 'granted') continue;
    try {
      const n = new Notification(alarm.title, {
        body: alarm.body,
        tag: alarm.id,
      });
      n.onclick = () => {
        window.focus();
        tapCb?.(alarm.day);
      };
    } catch {
      // Some mobile browsers only allow ServiceWorker notifications — treat
      // as unsupported and stay silent.
    }
  }
}

export async function ensureSetup(): Promise<void> {
  if (!supported() || timer) return;
  timer = setInterval(checkDue, CHECK_MS);
}

/** Ask for permission — must be called from a user gesture (browser rule). */
export async function requestPermissionIfNeeded(): Promise<void> {
  if (!supported() || Notification.permission !== 'default') return;
  try {
    await Notification.requestPermission();
  } catch {
    // Older callback-style browsers — best-effort.
  }
}

export async function notificationsBlocked(): Promise<boolean> {
  return !supported() || Notification.permission === 'denied';
}

export async function listScheduledAlarmIds(): Promise<string[]> {
  return [...scheduled.keys()].filter((id) => id.startsWith(ALARM_ID_PREFIX));
}

export async function scheduleAlarm(alarm: DesiredAlarm): Promise<void> {
  scheduled.set(alarm.id, alarm);
}

export async function cancelAlarm(id: string): Promise<void> {
  scheduled.delete(id);
}

export function onAlarmTap(cb: (day: string) => void): () => void {
  tapCb = cb;
  return () => {
    if (tapCb === cb) tapCb = null;
  };
}

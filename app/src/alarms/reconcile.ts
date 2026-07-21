// Pure reconcile plan: desired alarms vs whatever the platform says is
// scheduled. Cancels stale ids; RE-schedules every desired alarm (same id =
// replace) rather than trusting the scheduled list — after a ColorOS
// force-stop the store still lists alarms whose underlying AlarmManager
// registrations were wiped, so "already scheduled" cannot be believed.
import { ALARM_ID_PREFIX, type DesiredAlarm } from './occurrences';

export type ReconcilePlan = {
  toCancel: string[];
  toSchedule: DesiredAlarm[];
};

export function planReconcile(
  desired: readonly DesiredAlarm[],
  scheduledIds: readonly string[]
): ReconcilePlan {
  const desiredIds = new Set(desired.map((a) => a.id));
  return {
    toCancel: scheduledIds.filter(
      (id) => id.startsWith(ALARM_ID_PREFIX) && !desiredIds.has(id)
    ),
    toSchedule: [...desired],
  };
}

/**
 * Carrying a decision to the operating system, and nothing else.
 *
 * What should be pending is worked out in `domain/reminders`, where it can be tested. This
 * file is the part that cannot be: a thin adapter over the plugin, kept deliberately dull so
 * that the interesting half is the half a test can reach.
 *
 * Native only. A browser can show a notification while it is open, which is exactly when
 * nobody needs one, and scheduling ahead reliably needs a push service — a server, which this
 * app does not have and is not getting. So on the web every call here is a no-op that reports
 * itself as unavailable, and the settings screen says so rather than offering a switch that
 * does nothing.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Reminder } from '../domain/reminders';

/**
 * Notification ids are plain integers shared across everything the app schedules, so the
 * ranges are carved up here rather than left to whoever schedules next.
 *
 * Session reminders are rebuilt wholesale on every sync, which means cancelling the previous
 * batch without touching anything else — the reason they need a range of their own rather
 * than a handful of remembered ids.
 */
export const REST_TIMER_ID = 1;
export const SESSION_REMINDER_BASE = 1000;

export function notificationsAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Asks, and reports what was said.
 *
 * Called when somebody turns a switch on rather than at launch. An app gets one credible
 * chance at this prompt, and spending it before the person has asked for anything is how the
 * answer becomes a permanent no.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsAvailable()) return false;
  try {
    const status = await LocalNotifications.requestPermissions();
    return status.display === 'granted';
  } catch {
    return false;
  }
}

export async function notificationPermission(): Promise<boolean> {
  if (!notificationsAvailable()) return false;
  try {
    return (await LocalNotifications.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

/**
 * Replaces the whole session-reminder batch with this one.
 *
 * Cancelling by range rather than by remembered ids, because the thing being replaced was
 * scheduled by a previous run of the app and possibly a previous version of it. The pending
 * list the system holds is the only reliable record of what is armed.
 */
export async function armSessionReminders(reminders: Reminder[]): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id >= SESSION_REMINDER_BASE);
    if (ours.length > 0) await LocalNotifications.cancel({ notifications: ours });

    if (reminders.length === 0) return;
    await LocalNotifications.schedule({
      notifications: reminders.map((reminder) => ({
        id: reminder.id,
        title: reminder.title,
        body: reminder.body,
        schedule: { at: reminder.at, allowWhileIdle: true },
      })),
    });
  } catch {
    // Permission revoked in Settings, or the plugin is not there. Nothing to recover: the app
    // works without reminders, and a dialog about it is a worse interruption than the one
    // that failed to arrive.
  }
}

/**
 * Arms the one cue somebody is actually waiting for.
 *
 * Scheduled when the rest starts rather than when the screen goes off. Catching the moment
 * the app is backgrounded is more precise and loses the race on a phone that suspends the
 * page before the call completes — and a cue that arrives twice is a nuisance where a cue
 * that never arrives is the bug this is here to fix.
 */
export async function armRestCue(at: Date, title: string, body: string): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_TIMER_ID }] });
    if (at.getTime() <= Date.now()) return;
    await LocalNotifications.schedule({
      notifications: [
        { id: REST_TIMER_ID, title, body, schedule: { at, allowWhileIdle: true } },
      ],
    });
  } catch {
    // The countdown on screen is still correct, which is the same failure the beep already has.
  }
}

export async function cancelRestCue(): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_TIMER_ID }] });
  } catch {
    // Nothing was armed, or nothing can be. Either way there is nothing to say.
  }
}

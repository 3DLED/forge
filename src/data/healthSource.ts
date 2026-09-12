/**
 * The bridge to Apple Health, kept as thin as the notification one and for the same reason:
 * none of it can be exercised without a phone, a watch and a granted permission, so the less
 * that lives here the more of the feature is testable. Deciding which workout belongs to which
 * session is in `domain/health`.
 *
 * Read only, and that is the plugin's limit rather than a choice. `capacitor-health` exposes
 * queries and no way to save, so Forge can learn what the watch recorded and cannot write its
 * own sessions back. Pushing a kettlebell session into the Health rings would need a custom
 * native plugin.
 *
 * Heart rate arrives attached to a workout the watch recorded, not as a stream anyone can ask
 * for over an arbitrary window. That shapes the whole feature: a session gets a heart rate
 * because the watch was also recording, and no amount of asking produces one otherwise.
 */

import { Capacitor } from '@capacitor/core';
import { Health, type HealthPermission } from 'capacitor-health';
import type { HealthWorkout } from '../domain/health';

/** Read the watch's workouts and the beats inside them. Nothing is ever written. */
const PERMISSIONS: HealthPermission[] = ['READ_WORKOUTS', 'READ_HEART_RATE'];

export function healthSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Whether there is a Health store to talk to at all.
 *
 * Separate from "supported" because an iPad runs the app perfectly and has no HealthKit, and
 * telling somebody to grant a permission that cannot exist is worse than saying nothing.
 */
export async function healthAvailable(): Promise<boolean> {
  if (!healthSupported()) return false;
  try {
    return (await Health.isHealthAvailable()).available;
  } catch {
    return false;
  }
}

/**
 * Asks for read access.
 *
 * iOS answers this without telling us what was chosen — by design, since revealing that
 * somebody declined to share a health type is itself a disclosure. So a true here means the
 * question was asked and not that anything was granted, and the only honest test of access is
 * whether a query comes back with data.
 */
export async function requestHealthAccess(): Promise<boolean> {
  if (!healthSupported()) return false;
  try {
    await Health.requestHealthPermissions({ permissions: PERMISSIONS });
    return true;
  } catch {
    return false;
  }
}

/**
 * Workouts the watch recorded in a window, narrowed to what this app uses.
 *
 * Returns an empty list rather than throwing when access was declined, because from here that
 * is indistinguishable from a fortnight with no workouts in it, and the app behaves the same
 * way for both: it shows no heart rate and says nothing.
 */
export async function healthWorkoutsBetween(from: Date, to: Date): Promise<HealthWorkout[]> {
  if (!healthSupported()) return [];
  try {
    const response = await Health.queryWorkouts({
      startDate: from.toISOString(),
      endDate: to.toISOString(),
      includeHeartRate: true,
      includeRoute: false,
      includeSteps: false,
    });

    return response.workouts.map((workout) => ({
      startedAt: Date.parse(workout.startDate),
      endedAt: Date.parse(workout.endDate),
      heartRate: (workout.heartRate ?? []).map((sample) => sample.bpm),
    }));
  } catch {
    return [];
  }
}

/**
 * Filling in heart rates for sessions that do not have one yet.
 *
 * A backfill rather than a step in finishing a session, because at the moment you tap Finish
 * the watch has often not synced: the workout reaches Health a minute later, or when the watch
 * next comes near the phone, or after a charge. Asking at the one instant it is least likely
 * to be there would produce a feature that works occasionally and looks broken.
 *
 * So it runs over a trailing window and fills what it can. Sessions already carrying a figure
 * are skipped, which keeps it cheap and makes a repeat run harmless.
 */

import { db } from '../db/db';
import { sessionsBetween } from './sessions';
import { healthWorkoutsBetween, healthSupported } from './healthSource';
import { heartRateOf, heartRatePerMinute, matchWorkout } from '../domain/health';
import { encodeSeries } from '../domain/series';
import type { StoredLoggedSession } from '../db/db';
import { addDays, todayKey } from '../domain/dates';

/**
 * How far back to look.
 *
 * Long enough to cover a watch that spent the weekend off the wrist, short enough that the
 * query stays small and cannot turn into a scan of a year of training on every app open.
 */
export const BACKFILL_DAYS = 14;

export interface HealthSyncResult {
  /** Sessions that gained a heart rate they did not have. */
  filled: number;
  /** Sessions still without one — no watch that day, or nothing lined up. */
  unmatched: number;
}

/**
 * Reads the window once and writes whatever it can attach.
 *
 * One query for the whole window rather than one per session: a fortnight is a handful of
 * workouts, and asking HealthKit fourteen separate questions to answer one is how a background
 * task becomes something the user notices.
 */
export async function syncHeartRates(): Promise<HealthSyncResult> {
  if (!healthSupported()) return { filled: 0, unmatched: 0 };

  const from = addDays(todayKey(), -BACKFILL_DAYS);
  // Anything missing either figure. Sessions matched before the minute-by-minute series existed
  // have an average and no curve, and should gain the curve without losing the average.
  const sessions = (await sessionsBetween(from, todayKey())).filter(
    (session) => session.endedAt && (session.avgHrBpm == null || session.hrPerMinute == null),
  );
  if (sessions.length === 0) return { filled: 0, unmatched: 0 };

  // A day either side, since a session near midnight runs past the window it is filed under.
  const workouts = await healthWorkoutsBetween(
    new Date(`${addDays(from, -1)}T00:00:00`),
    new Date(`${addDays(todayKey(), 1)}T00:00:00`),
  );
  const withoutAverage = sessions.filter((session) => session.avgHrBpm == null).length;
  if (workouts.length === 0) return { filled: 0, unmatched: withoutAverage };

  let filled = 0;
  let averaged = 0;
  for (const session of sessions) {
    const matched = matchWorkout(session, workouts);
    const rate = matched ? heartRateOf(matched) : null;
    if (!matched || !rate) continue;

    // Only what is missing. A figure already on the session was matched earlier and stays put.
    const changes: Partial<StoredLoggedSession> = {};
    if (session.avgHrBpm == null) {
      changes.avgHrBpm = rate.avgBpm;
      changes.maxHrBpm = rate.maxBpm;
      averaged += 1;
    }
    const perMinute = session.hrPerMinute == null ? heartRatePerMinute(session, matched) : null;
    if (perMinute) changes.hrPerMinute = encodeSeries(perMinute);

    if (Object.keys(changes).length === 0) continue;
    await db.loggedSessions.update(session.id, { ...changes, updatedAt: new Date().toISOString() });
    filled += 1;
  }

  return { filled, unmatched: withoutAverage - averaged };
}

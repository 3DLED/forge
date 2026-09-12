/**
 * Matching what the watch recorded to what you logged.
 *
 * Heart rate is the one number in this app that Forge cannot measure. It comes from a watch,
 * reaches Apple Health as part of a workout the watch recorded, and has to be tied back to the
 * session you logged here — two records of the same hour, written by two devices that never
 * spoke to each other.
 *
 * Which makes matching the whole problem, and the reason it lives here rather than beside the
 * plugin call. Getting it wrong is not a crash: it is a long run quietly wearing the heart
 * rate of the walk to the car, which would look entirely plausible on a chart and be wrong for
 * months.
 */

import type { LoggedSession } from './types';

/** What the health bridge hands back. A narrowed view of the plugin's own workout shape. */
export interface HealthWorkout {
  startedAt: number;
  endedAt: number;
  /** Beats per minute, sampled through the workout. Empty when the watch recorded none. */
  heartRate: number[];
}

export interface HeartRate {
  avgBpm: number;
  maxBpm: number;
}

/**
 * How much of the shorter record has to sit inside the longer one to call them the same effort.
 *
 * Generous on purpose. You start the watch in the doorway and the app when you have found the
 * first bell, or the other way round, and the two records routinely disagree by several
 * minutes at both ends. Demanding a tight overlap would reject the ordinary case.
 *
 * Not so generous that a thirty-minute lift swallows the hour-long ride home: the fraction is
 * measured against the *shorter* of the two, so a brief workout sitting inside a long one
 * still has to be mostly covered by it.
 */
export const MIN_OVERLAP = 0.5;

function overlapMs(a: { startedAt: number; endedAt: number }, b: HealthWorkout): number {
  return Math.max(0, Math.min(a.endedAt, b.endedAt) - Math.max(a.startedAt, b.startedAt));
}

/** When the session ran, or null when it was never properly started and finished. */
export function sessionWindow(
  session: LoggedSession,
): { startedAt: number; endedAt: number } | null {
  if (!session.startedAt || !session.endedAt) return null;
  const startedAt = Date.parse(session.startedAt);
  const endedAt = Date.parse(session.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) {
    return null;
  }
  return { startedAt, endedAt };
}

/**
 * The health workout that is the same effort as this session, if any.
 *
 * Best overlap wins rather than first, because two-a-days exist and a morning run followed by
 * an evening lift would otherwise hand the lift the run's heart rate on nothing better than
 * list order.
 */
export function matchWorkout(
  session: LoggedSession,
  workouts: HealthWorkout[],
): HealthWorkout | null {
  const window = sessionWindow(session);
  if (!window) return null;

  let best: HealthWorkout | null = null;
  let bestOverlap = 0;

  for (const workout of workouts) {
    const shared = overlapMs(window, workout);
    if (shared <= 0) continue;

    const shorter = Math.min(
      window.endedAt - window.startedAt,
      Math.max(1, workout.endedAt - workout.startedAt),
    );
    if (shared / shorter < MIN_OVERLAP) continue;

    if (shared > bestOverlap) {
      bestOverlap = shared;
      best = workout;
    }
  }

  return best;
}

/**
 * Average and peak, from the samples the watch took.
 *
 * A plain mean over the samples, which is what the watch itself reports and close enough to a
 * time-weighted average for a steady sampling rate. Rounded, because a heart rate with a
 * decimal point claims a precision no chest strap has.
 *
 * Nonsense is dropped rather than averaged in: a zero is a lost signal, not a resting moment,
 * and letting those through drags every figure toward a number nobody ran at.
 */
export function heartRateOf(workout: HealthWorkout): HeartRate | null {
  const beats = workout.heartRate.filter((bpm) => Number.isFinite(bpm) && bpm > 0);
  if (beats.length === 0) return null;
  return {
    avgBpm: Math.round(beats.reduce((sum, bpm) => sum + bpm, 0) / beats.length),
    maxBpm: Math.round(Math.max(...beats)),
  };
}

/** The heart rate for one session, or null when nothing recorded on the watch lines up. */
export function heartRateForSession(
  session: LoggedSession,
  workouts: HealthWorkout[],
): HeartRate | null {
  const matched = matchWorkout(session, workouts);
  return matched ? heartRateOf(matched) : null;
}

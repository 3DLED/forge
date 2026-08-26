/**
 * The math that turns logged sets into something you can judge a training block by.
 *
 * The organising idea is **session RPE x duration**. A 60-minute lift at RPE 7 and a
 * 60-minute run at RPE 7 both cost 420 units. It is crude, it is well validated, and it is
 * the only load metric that lets a hybrid athlete add running and lifting into one number
 * instead of staring at two charts that never meet.
 */

import type { Exercise, LoggedSession, LoggedSet } from './types';

// --- per-set --------------------------------------------------------------

/**
 * Estimated one-rep max, Epley. Above about 12 reps this stops meaning much, so it is
 * capped rather than silently reported as a PR off a set of 30.
 */
export function estimate1RM(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return null;
  return weightKg * (1 + reps / 30);
}

/** Load moved by one set, in kg-reps. Unilateral work counts both sides. */
export function setVolumeKg(set: LoggedSet, exercise?: Exercise): number {
  const weight = set.values.weightKg ?? 0;
  const reps = set.values.reps ?? 0;
  const sides = exercise?.unilateral && !set.side ? 2 : 1;
  return weight * reps * sides;
}

export function setDistanceM(set: LoggedSet): number {
  return set.values.distanceM ?? 0;
}

// --- per-session ----------------------------------------------------------

/**
 * Session load. Uses the recorded session RPE and duration when present; otherwise falls
 * back to the average set RPE and a rough minute estimate, so a session logged in a hurry
 * still contributes something rather than reading as a zero-effort day.
 */
export function sessionLoad(session: LoggedSession): number {
  const minutes = session.durationMin ?? estimateDurationMin(session);
  const rpe = session.sessionRpe ?? averageSetRpe(session) ?? 0;
  return Math.round(minutes * rpe);
}

export function averageSetRpe(session: LoggedSession): number | null {
  const values = session.sets.map((s) => s.values.rpe).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Wall-clock minutes if the session was timed; otherwise inferred from its contents. */
export function estimateDurationMin(session: LoggedSession): number {
  if (session.startedAt && session.endedAt) {
    const ms = Date.parse(session.endedAt) - Date.parse(session.startedAt);
    if (ms > 0) return Math.round(ms / 60_000);
  }
  const workSec = session.sets.reduce((total, set) => total + (set.values.timeSec ?? 0), 0);
  if (workSec > 0) return Math.round(workSec / 60);
  // Roughly three minutes per set including rest — enough to keep load comparable.
  return session.sets.filter((s) => s.completed).length * 3;
}

export function sessionVolumeKg(session: LoggedSession, bySlug: Map<string, Exercise>): number {
  return session.sets.reduce(
    (total, set) => total + (set.completed ? setVolumeKg(set, bySlug.get(set.exerciseSlug)) : 0),
    0,
  );
}

export function sessionDistanceM(session: LoggedSession): number {
  return session.sets.reduce((total, set) => total + (set.completed ? setDistanceM(set) : 0), 0);
}

export function sessionWorkSec(session: LoggedSession): number {
  return session.sets.reduce((total, set) => total + (set.completed ? set.values.timeSec ?? 0 : 0), 0);
}

// --- across sessions ------------------------------------------------------

/** Trailing weeks that must contain real training before the ratio means anything. */
const MIN_WEEKS_FOR_RATIO = 3;

/**
 * Acute:chronic workload ratio — this week's load against the trailing four-week average.
 * Above ~1.5 is the classic "you are ramping faster than you are adapting" warning, and it
 * is the number most likely to keep someone out of a boot.
 *
 * Returns null until there is enough history to divide by. Against three empty weeks the
 * arithmetic yields 4.0 and screams danger at someone whose crime was starting to train —
 * a warning that fires for every new user is a warning nobody reads by week five.
 */
export function acuteChronicRatio(weeklyLoads: number[]): number | null {
  const chronicWeeks = weeklyLoads.slice(-4);
  if (chronicWeeks.filter((load) => load > 0).length < MIN_WEEKS_FOR_RATIO) return null;

  const chronic = chronicWeeks.reduce((a, b) => a + b, 0) / chronicWeeks.length;
  if (chronic <= 0) return null;
  return weeklyLoads[weeklyLoads.length - 1] / chronic;
}

export interface PersonalRecord {
  exerciseSlug: string;
  /** Best estimated 1RM, for loaded work. */
  best1RMKg?: number;
  /** Most reps in a single set, for bodyweight work. */
  bestReps?: number;
  /** Longest hold, for planks and hangs. */
  bestTimeSec?: number;
  /** Furthest single effort. */
  bestDistanceM?: number;
  /** Fastest pace over at least a kilometre, in seconds per km. */
  bestPaceSecPerKm?: number;
  date: string;
}

/** Best-ever marks per movement, scanned from logged sets. */
export function personalRecords(sessions: LoggedSession[]): Map<string, PersonalRecord> {
  const records = new Map<string, PersonalRecord>();

  for (const session of sessions) {
    for (const set of session.sets) {
      if (!set.completed) continue;

      const record = records.get(set.exerciseSlug) ?? {
        exerciseSlug: set.exerciseSlug,
        date: session.date,
      };
      let improved = false;

      const { weightKg, reps, timeSec, distanceM } = set.values;

      if (weightKg && reps) {
        const oneRm = estimate1RM(weightKg, reps);
        if (oneRm && oneRm > (record.best1RMKg ?? 0)) {
          record.best1RMKg = oneRm;
          improved = true;
        }
      }
      if (reps && !weightKg && reps > (record.bestReps ?? 0)) {
        record.bestReps = reps;
        improved = true;
      }
      if (timeSec && !distanceM && timeSec > (record.bestTimeSec ?? 0)) {
        record.bestTimeSec = timeSec;
        improved = true;
      }
      if (distanceM && distanceM > (record.bestDistanceM ?? 0)) {
        record.bestDistanceM = distanceM;
        improved = true;
      }
      if (distanceM && timeSec && distanceM >= 1000) {
        const pace = timeSec / (distanceM / 1000);
        if (pace < (record.bestPaceSecPerKm ?? Infinity)) {
          record.bestPaceSecPerKm = pace;
          improved = true;
        }
      }

      if (improved) record.date = session.date;
      records.set(set.exerciseSlug, record);
    }
  }

  return records;
}

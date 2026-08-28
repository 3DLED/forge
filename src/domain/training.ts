/**
 * The math that turns logged sets into something you can judge a training block by.
 *
 * The organising idea is **session RPE x duration**. A 60-minute lift at RPE 7 and a
 * 60-minute run at RPE 7 both cost 420 units. It is crude, it is well validated, and it is
 * the only load metric that lets a hybrid athlete add running and lifting into one number
 * instead of staring at two charts that never meet.
 */

import type { BodyweightLookup } from './bodyweight';
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

/**
 * Load moved by one set, in kg-reps. Unilateral work counts both sides.
 *
 * Bodyweight counts. Half the library records no external weight at all, so without this a
 * hundred push-ups scored as no work done — and for anyone training on bodyweight and
 * kettlebells that is most of the chart missing. Added load stacks on top rather than
 * replacing: a weighted pull-up is you plus the plate.
 *
 * The estimate is rough, and it is not comparable across movements — a set of air squats
 * outscores a set of goblet squats, because your own mass is genuinely more than a 24 kg bell.
 * That is fine for what this feeds: a trend for one movement, and a week-over-week total.
 * It is not a claim that the two are equivalent work.
 */
export function setVolumeKg(set: LoggedSet, exercise?: Exercise, bodyweightKg?: number): number {
  const external = set.values.weightKg ?? 0;
  const own = (exercise?.bodyweightFactor ?? 0) * (bodyweightKg ?? 0);
  const reps = set.values.reps ?? 0;
  const sides = exercise?.unilateral && !set.side ? 2 : 1;
  return (external + own) * reps * sides;
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

/** Seconds recorded by the session stopwatch, including any run currently in progress. */
export function stopwatchSec(session: LoggedSession): number {
  return (
    (session.elapsedSec ?? 0) +
    (session.runningSince ? Math.max(0, (Date.now() - Date.parse(session.runningSince)) / 1000) : 0)
  );
}

/** Seconds spent inside timed blocks. */
export function blocksSec(session: LoggedSession): number {
  return (session.blocks ?? []).reduce((total, block) => total + (block.timeSec ?? 0), 0);
}

/** Rounds completed across every timed block in the session. */
export function sessionRounds(session: LoggedSession): number {
  return (session.blocks ?? []).reduce((total, block) => total + (block.rounds ?? 0), 0);
}

/** Wall-clock minutes if the session was timed; otherwise inferred from its contents. */
export function estimateDurationMin(session: LoggedSession): number {
  // The stopwatch and the block clocks both measure real working time, unlike start/end
  // timestamps which only bound how long the screen was open. Take whichever saw more: the
  // stopwatch covers a block it was running through, and a block covers itself when the
  // session clock was never started.
  const timed = Math.max(stopwatchSec(session), blocksSec(session));
  if (timed > 30) return Math.round(timed / 60);

  if (session.startedAt && session.endedAt) {
    const ms = Date.parse(session.endedAt) - Date.parse(session.startedAt);
    if (ms > 0) return Math.round(ms / 60_000);
  }
  const workSec = session.sets.reduce((total, set) => total + (set.values.timeSec ?? 0), 0);
  if (workSec > 0) return Math.round(workSec / 60);
  // Roughly three minutes per set including rest — enough to keep load comparable.
  return session.sets.filter((s) => s.completed).length * 3;
}

export function sessionVolumeKg(
  session: LoggedSession,
  bySlug: Map<string, Exercise>,
  /** Bodyweight as of this session's date — see `domain/bodyweight.ts`. */
  bodyweightKg?: number,
): number {
  return session.sets.reduce(
    (total, set) =>
      total + (set.completed ? setVolumeKg(set, bySlug.get(set.exerciseSlug), bodyweightKg) : 0),
    0,
  );
}

export function sessionDistanceM(session: LoggedSession): number {
  return session.sets.reduce((total, set) => total + (set.completed ? setDistanceM(set) : 0), 0);
}

export function sessionWorkSec(session: LoggedSession): number {
  const setSec = session.sets.reduce(
    (total, set) => total + (set.completed ? (set.values.timeSec ?? 0) : 0),
    0,
  );
  return setSec + blocksSec(session);
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
  /**
   * That 1RM as a multiple of what you weighed when you hit it.
   *
   * The number people actually compare. A 140 kg deadlift says little on its own; twice
   * bodyweight says a lot, and it stays honest across a bulk or a cut in a way the raw
   * figure does not.
   */
  best1RMxBw?: number;
  /** Most reps in a single set, for bodyweight work. */
  bestReps?: number;
  /** Longest hold, for planks and hangs. */
  bestTimeSec?: number;
  /** Furthest single effort. */
  bestDistanceM?: number;
  /** Fastest pace over at least a kilometre, in seconds per km. */
  bestPaceSecPerKm?: number;
  /** Most rounds in a timed block. */
  bestRounds?: number;
  /**
   * The cap the round count was set against. Rounds are only comparable within the same
   * window — 9 rounds in 20 minutes is not a better score than 7 in 12 — so the number is
   * never shown without it.
   */
  bestRoundsTimeSec?: number;
  date: string;
}

/** Best-ever marks per movement, scanned from logged sets. */
export function personalRecords(
  sessions: LoggedSession[],
  /** Bodyweight on any given day, for relative-strength bests. Optional. */
  bodyweight?: BodyweightLookup,
): Map<string, PersonalRecord> {
  const records = new Map<string, PersonalRecord>();

  for (const session of sessions) {
    for (const set of session.sets) {
      if (!set.completed) continue;

      const record = records.get(set.exerciseSlug) ?? {
        exerciseSlug: set.exerciseSlug,
        date: session.date,
      };
      let improved = false;

      const { weightKg, reps, timeSec, distanceM, rounds } = set.values;

      if (rounds && rounds > (record.bestRounds ?? 0)) {
        record.bestRounds = rounds;
        record.bestRoundsTimeSec = timeSec;
        improved = true;
      }

      if (weightKg && reps) {
        const oneRm = estimate1RM(weightKg, reps);
        if (oneRm && oneRm > (record.best1RMKg ?? 0)) {
          record.best1RMKg = oneRm;
          // Divided by what you weighed *then*, not now, so the ratio records what actually
          // happened rather than shifting every time the scale does.
          const bw = bodyweight?.at(session.date);
          record.best1RMxBw = bw && bw > 0 ? oneRm / bw : undefined;
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

    // Rounds live on the block, not on its movements, so blocks are scanned separately and
    // attributed to the container entry for their style. Without this, moving rounds onto
    // blocks would silently kill round tracking.
    for (const block of session.blocks ?? []) {
      if (!block.rounds) continue;
      const slug = CONTAINER_SLUG[block.style];
      const record = records.get(slug) ?? { exerciseSlug: slug, date: session.date };

      if (block.rounds > (record.bestRounds ?? 0)) {
        record.bestRounds = block.rounds;
        record.bestRoundsTimeSec = block.capSec ?? block.timeSec;
        record.date = session.date;
      }
      records.set(slug, record);
    }
  }

  return records;
}

/** Library entries that stand in for a timed block when recording a best. */
const CONTAINER_SLUG: Record<string, string> = {
  amrap: 'amrap',
  emom: 'emom',
  forTime: 'for-time',
};

/**
 * The container entries themselves, for anything that browses the library.
 *
 * They are not movements. They exist so a block's rounds have something to record a best
 * against and so the Progress view has a name to print, which is why they are hidden rather
 * than deleted — removing the records would leave every AMRAP personal best nameless. Adding
 * one to a workout was never the way to start a timed piece; ‘Add block’ is.
 */
export const CONTAINER_SLUGS = new Set(Object.values(CONTAINER_SLUG));

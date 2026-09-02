/**
 * Letting last time decide what to do this time.
 *
 * Autoregulation, in the narrow sense the evidence supports: adjusting the dose from what
 * actually happened rather than from what a spreadsheet said in week one. A network
 * meta-analysis ranks autoregulated approaches above fixed percentage-based ones for maximal
 * strength, though honestly — the effect sizes are modest. The stronger argument is the
 * mechanism: a fixed 80% on a day you slept badly is a higher relative intensity than the
 * programme intended, and holding quality under fatigue is most of what this buys.
 *
 * Which is why it moves in both directions. Only ever adding is a ratchet, and a ratchet
 * eventually prescribes a session you cannot complete.
 *
 * Two independent triggers, so it still works whether or not you rate every session:
 *
 * - **How it felt.** A session rated easy earns more; one rated brutal earns less.
 * - **The 2-for-2 rule**, from NSCA: beating the target by two or more reps on two consecutive
 *   sessions earns more load. Deliberately conservative — one good day is not a trend.
 *
 * When it adds, reps move before load. That is double progression, which is what the rep
 * ranges already in the templates are for, and on a rack whose smallest jump is eight kilos it
 * is the only way to make small progress at all.
 */

import type { Exercise, LoggedSession, LoggedSet } from './types';
import { nextLoadAbove, nextLoadBelow } from './equipment';

/** At or below this, the session was comfortable enough to ask for more. */
export const EASY_RPE = 6;

/** At or above this, it took everything, and asking for more is how people get hurt. */
export const HARD_RPE = 9;

/** Reps over target that count as beating it, per the 2-for-2 rule. */
export const BEAT_BY = 2;

/** Consecutive sessions that must beat the target before load goes up. */
export const CONSECUTIVE_SESSIONS = 2;

export type Direction = 'up' | 'down';

export interface ProgressionSuggestion {
  direction: Direction;
  /** Reps move first; load only once reps are at the end of the range. */
  change: 'reps' | 'load';
  /** The new target, in whichever currency changed. */
  reps?: number;
  loadKg?: number;
  /** Why, in the words the athlete would use. */
  reason: string;
}

/** One movement's showing in one session. */
interface Performance {
  session: LoggedSession;
  sets: LoggedSet[];
}

function performances(
  sessions: LoggedSession[],
  exerciseSlug: string,
  limit: number,
): Performance[] {
  return sessions
    .filter((session) => session.endedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((session) => ({
      session,
      sets: session.sets.filter((set) => set.exerciseSlug === exerciseSlug && set.completed),
    }))
    .filter((performance) => performance.sets.length > 0)
    .slice(0, limit);
}

/** The most reps done in a single set of that movement. */
function bestReps(performance: Performance): number {
  return Math.max(...performance.sets.map((set) => set.values.reps ?? 0));
}

/** The load carried, where there was one. */
function workingLoad(performance: Performance): number | undefined {
  const loads = performance.sets.map((set) => set.values.weightKg ?? 0).filter((kg) => kg > 0);
  return loads.length > 0 ? Math.max(...loads) : undefined;
}

/**
 * What last time says about this time.
 *
 * Returns nothing when there is nothing to say — no history, no signal, or a session that went
 * exactly as prescribed. Silence is the common case and the right one: a suggestion on every
 * movement every session is noise you stop reading.
 */
export function suggestProgression(options: {
  exercise: Exercise;
  sessions: LoggedSession[];
  /** The rep range being worked in, from the athlete's goal. */
  repRange: [number, number];
  /** Loads that can actually be picked up. */
  loads?: number[];
}): ProgressionSuggestion | undefined {
  const { exercise, sessions, repRange, loads } = options;
  const [low, high] = repRange;

  const history = performances(sessions, exercise.slug, CONSECUTIVE_SESSIONS);
  if (history.length === 0) return undefined;

  const last = history[0];
  const reps = bestReps(last);
  const load = workingLoad(last);
  const rpe = last.session.sessionRpe;
  const loaded = exercise.metrics.includes('weightKg') && load !== undefined;

  /*
   * Backing off comes first. Where a session was both hard and short of target, the useful
   * answer is unambiguous, and checking "was it easy" first would let a missed session that
   * happened to go unrated slip through as no signal at all.
   */
  const missed = reps > 0 && reps < low;
  if (rpe !== undefined && rpe >= HARD_RPE) {
    return backOff(reps, load, low, high, loaded, loads, `Last time came in at ${rpe} out of 10`);
  }
  if (missed) {
    return backOff(
      reps,
      load,
      low,
      high,
      loaded,
      loads,
      `Last time you got ${reps}, short of ${low}`,
    );
  }

  if (rpe !== undefined && rpe <= EASY_RPE) {
    return stepUp(reps, load, low, high, loaded, loads, `Last time came in at ${rpe} out of 10`);
  }

  /*
   * The 2-for-2 rule. Both sessions have to beat the target, which is what makes it a trend
   * rather than one good day — and it deliberately does not care how the session felt.
   */
  const beating =
    history.length >= CONSECUTIVE_SESSIONS &&
    history.every((performance) => bestReps(performance) >= high + BEAT_BY);

  if (beating) {
    return stepUp(
      reps,
      load,
      low,
      high,
      loaded,
      loads,
      `You have beaten ${high} by ${BEAT_BY} twice running`,
    );
  }

  return undefined;
}

function stepUp(
  reps: number,
  load: number | undefined,
  low: number,
  high: number,
  loaded: boolean,
  loads: number[] | undefined,
  reason: string,
): ProgressionSuggestion | undefined {
  // Reps first: the range exists to be climbed before anything heavier goes on.
  if (reps < high) {
    return { direction: 'up', change: 'reps', reps: reps + 1, reason };
  }

  if (!loaded || load === undefined) {
    // Bodyweight at the top of its range: the next step is a harder variation, not a number.
    return undefined;
  }

  const heavier = nextLoadAbove(load, loads);
  if (heavier === undefined) return undefined;

  return {
    direction: 'up',
    change: 'load',
    loadKg: heavier,
    // Back to the bottom of the range, which is what makes double progression a cycle.
    reps: low,
    reason,
  };
}

function backOff(
  reps: number,
  load: number | undefined,
  low: number,
  high: number,
  loaded: boolean,
  loads: number[] | undefined,
  reason: string,
): ProgressionSuggestion | undefined {
  if (reps > low) {
    return { direction: 'down', change: 'reps', reps: Math.max(low, reps - 1), reason };
  }

  if (!loaded || load === undefined) return undefined;

  const lighter = nextLoadBelow(load, loads);
  if (lighter === undefined) return undefined;

  return { direction: 'down', change: 'load', loadKg: lighter, reps: high, reason };
}

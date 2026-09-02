/**
 * Turning a known maximum into a load you can actually pick up.
 *
 * The gap this closes: templates prescribe reps and an effort target, and until now the weight
 * was left entirely to you. With a measured max the app can propose one — which is the only
 * reason to measure a max at all.
 *
 * Three ideas, none of them mine:
 *
 * - **The load–repetition relationship.** NSCA's training load chart: one rep is 100% of your
 *   max, three is 93%, five 87%, eight 80%, ten 75%. It is a population average, and the chart
 *   comes with its own caveat — reps at a given percentage vary by movement (more on a squat
 *   than a bench) and vary a lot between people. So this proposes, and you overwrite it.
 * - **The training max.** Percentages are taken off 90% of the true maximum rather than the
 *   maximum itself, the convention 5/3/1 popularised. A number computed from your best day is
 *   not makeable on an average one, and a programme you miss reps on is one you stop running.
 * - **Rounding to what exists.** Shared with the test protocol: a percentage is a number and a
 *   kettlebell is an object.
 */

import type { DayKey, Exercise } from './types';
import type { PersonalRecord } from './training';
import type { TestResult } from './fitnessTests';
import { roundDownToAvailableLoad } from './equipment';
import { daysBetween } from './dates';

/**
 * NSCA's training load chart, reps to percentage of one-rep max.
 *
 * Anything between two entries is interpolated; anything past twelve stops being a strength
 * prescription, so nothing is proposed for it.
 */
const LOAD_CHART: [reps: number, percent: number][] = [
  [1, 1.0],
  [2, 0.95],
  [3, 0.93],
  [4, 0.9],
  [5, 0.87],
  [6, 0.85],
  [7, 0.83],
  [8, 0.8],
  [9, 0.77],
  [10, 0.75],
  [12, 0.7],
];

export const MAX_CHART_REPS = 12;

/** The fraction of a true max that percentages are taken from, unless you change it. */
export const DEFAULT_TRAINING_MAX = 0.9;

/**
 * How long a maximum stays worth trusting.
 *
 * Twice the retest interval. Past that the number is not wrong so much as unverified, and the
 * app says so rather than quietly prescribing from it.
 */
export const MAX_FRESH_DAYS = 56;

/** Percentage of a one-rep max that a given rep count corresponds to. */
export function percentForReps(reps: number): number | undefined {
  if (reps < 1 || reps > MAX_CHART_REPS) return undefined;

  const exact = LOAD_CHART.find(([r]) => r === reps);
  if (exact) return exact[1];

  // Only 11 falls between entries; interpolate rather than special-case it.
  const below = [...LOAD_CHART].reverse().find(([r]) => r < reps);
  const above = LOAD_CHART.find(([r]) => r > reps);
  if (!below || !above) return undefined;

  const span = above[0] - below[0];
  const along = (reps - below[0]) / span;
  return below[1] + (above[1] - below[1]) * along;
}

export type MaxOrigin = 'test' | 'manual' | 'logged';

export interface KnownMax {
  exerciseSlug: string;
  /** The true one-rep maximum, before any training-max discount. */
  oneRepMaxKg: number;
  origin: MaxOrigin;
  date: DayKey;
}

/**
 * The best evidence available for what a movement's maximum is.
 *
 * A test wins, because it was performed to a protocol under conditions you can repeat. The one
 * exception is a logged set that both post-dates the test and implies more than it did: having
 * actually lifted more than the test predicted is better evidence than the test, and refusing
 * to notice would leave the app prescribing from a number you have already beaten.
 */
export function knownMax(
  exerciseSlug: string,
  testResults: TestResult[],
  records: Map<string, PersonalRecord>,
): KnownMax | undefined {
  /*
   * A hand-entered max and a tested one are both deliberate statements about a maximum, so
   * neither automatically outranks the other — recency decides, and a test wins a tie because
   * it was performed rather than recalled.
   */
  const stated = testResults
    .filter((result) => result.exerciseSlug === exerciseSlug && result.estimated1RMKg)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (a.entry === 'manual' ? 1 : 0) - (b.entry === 'manual' ? 1 : 0),
    )[0];
  const test = stated;

  const record = records.get(exerciseSlug);
  const logged =
    record?.best1RMKg && record.sources.oneRm
      ? { kg: record.best1RMKg, date: record.sources.oneRm.date }
      : undefined;

  if (!test) {
    return logged
      ? { exerciseSlug, oneRepMaxKg: logged.kg, origin: 'logged', date: logged.date }
      : undefined;
  }

  const fromTest: KnownMax = {
    exerciseSlug,
    oneRepMaxKg: test.estimated1RMKg!,
    origin: test.entry === 'manual' ? 'manual' : 'test',
    date: test.date,
  };

  if (logged && logged.date > test.date && logged.kg > fromTest.oneRepMaxKg) {
    return { exerciseSlug, oneRepMaxKg: logged.kg, origin: 'logged', date: logged.date };
  }

  return fromTest;
}

export function isStale(max: KnownMax, today: DayKey): boolean {
  return daysBetween(max.date, today) > MAX_FRESH_DAYS;
}

export interface LoadSuggestion {
  loadKg: number;
  /** Percentage of the *true* max this works out at, for display. */
  percentOfMax: number;
  reps: number;
  max: KnownMax;
  stale: boolean;
}

/**
 * A working load for a prescribed rep count.
 *
 * Returns nothing rather than guessing where there is nothing to guess from: no known max, a
 * rep count off the chart, or a movement carrying no external load. A missing suggestion is a
 * blank field you fill in yourself, which is where this started.
 */
export function suggestLoad(options: {
  exercise: Exercise;
  reps: number;
  max: KnownMax | undefined;
  today: DayKey;
  /** Fraction of the true max to work from. Defaults to the 5/3/1 convention. */
  trainingMax?: number;
  /** Loads you can actually pick up. */
  loads?: number[];
}): LoadSuggestion | undefined {
  const { exercise, reps, max, today, trainingMax = DEFAULT_TRAINING_MAX, loads } = options;

  if (!max || max.oneRepMaxKg <= 0) return undefined;
  if (!exercise.metrics.includes('weightKg')) return undefined;

  const percent = percentForReps(reps);
  if (percent === undefined) return undefined;

  /*
   * Down to the next load you own, never up.
   *
   * Rounding to the nearest defeats the training max on a sparse rack: with bells eight kilos
   * apart, a target of 36.5 rounds up to the 40 that *is* your five rep max, prescribing 100%
   * of it for a set the discount existed to keep at 90. Overshooting means missed reps, which
   * is the exact failure the training max is there to prevent.
   */
  const loadKg = roundDownToAvailableLoad(max.oneRepMaxKg * trainingMax * percent, loads);
  if (loadKg <= 0) return undefined;

  return {
    loadKg,
    percentOfMax: loadKg / max.oneRepMaxKg,
    reps,
    max,
    stale: isStale(max, today),
  };
}

/** Resolves a prescribed `percentOfMax` load spec, which nothing wrote until now. */
export function loadForPercent(options: {
  percent: number;
  max: KnownMax | undefined;
  trainingMax?: number;
  loads?: number[];
}): number | undefined {
  const { percent, max, trainingMax = DEFAULT_TRAINING_MAX, loads } = options;
  if (!max || max.oneRepMaxKg <= 0) return undefined;
  return roundDownToAvailableLoad(max.oneRepMaxKg * trainingMax * percent, loads);
}

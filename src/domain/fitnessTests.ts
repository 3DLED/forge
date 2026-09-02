/**
 * Benchmark tests: the measurements everything else gets prescribed from.
 *
 * The protocols here are not invented. A test is only worth anything if this month's number
 * can be compared to last month's, and test–retest reliability for maximal strength is high
 * *only when the protocol is standardised* — which is the whole reason the app runs the test
 * rather than leaving you to remember how you did it last time.
 *
 * Sources for the shapes below:
 *
 * - **Weighted (3RM).** NSCA: warm up 5–10 reps light, rest a minute; a set of 3–5 with load
 *   added (5–10% upper body, 10–20% lower); then maximal attempts with 2–4 minutes between
 *   them, reaching the true maximum within 3–5 attempts. The attempt cap matters — past about
 *   five, accumulated fatigue means you are measuring endurance rather than strength.
 * - **Bodyweight (reps).** ACSM: repetitions to *technical* failure, not muscular failure.
 *   The set ends when depth, alignment or tempo goes, and hand position and depth have to be
 *   fixed or the count is not comparable to the next one.
 * - **Hold.** Time to form failure. McGill's trunk endurance tests have published norms, but
 *   they are a specific 60° sit-back rather than a front plank, so nothing here claims a
 *   standard to hit — a hold is compared against your own last one.
 */

import type { DayKey, Exercise, Id } from './types';
import { regionOf } from './regions';
import { roundToAvailableLoad } from './equipment';
import { addDays, daysBetween } from './dates';

export type TestKind = 'reps' | 'threeRepMax' | 'hold';

export interface TestKindSpec {
  label: string;
  /** What the test measures, in one line. */
  blurb: string;
  /** How the result is expressed. */
  unit: 'reps' | 'kg' | 'seconds';
  protocol: string;
}

export const TEST_KINDS: Record<TestKind, TestKindSpec> = {
  reps: {
    label: 'Max reps',
    blurb: 'One set to technical failure.',
    unit: 'reps',
    protocol:
      'Warm up, then one set for as many reps as you can hold form for. Stop when depth, alignment or tempo goes — not when the muscle gives out. Those are different numbers, and only the first one is comparable next time.',
  },
  threeRepMax: {
    label: '3 rep max',
    blurb: 'Work up in threes to the heaviest you can hold form for.',
    unit: 'kg',
    protocol:
      'Two warm-up sets, then up to five attempts of three, resting two to four minutes between them. It stops at five: past that you are measuring how tired you are rather than how strong.',
  },
  hold: {
    label: 'Max hold',
    blurb: 'One hold to form failure.',
    unit: 'seconds',
    protocol:
      'Warm up briefly, then hold for as long as the position stays honest. The clock stops when the shape goes, not when it hurts.',
  },
};

/** Which test suits a movement, from what it records. */
export function testKindFor(exercise: Exercise): TestKind {
  const metrics = exercise.metrics;
  if (metrics.includes('timeSec') && !metrics.includes('reps')) return 'hold';
  if (metrics.includes('weightKg')) return 'threeRepMax';
  return 'reps';
}

// --- how often -------------------------------------------------------------

/**
 * When a test is worth repeating.
 *
 * Practical guidance is roughly every four weeks while you are progressing quickly, stretching
 * to six or eight later; research protocols retest per training block, every six to twelve.
 * Four weeks is the shortest of those and the one that suits someone still building.
 */
export const RETEST_DUE_DAYS = 28;

/**
 * Below this, the result is not worth trusting.
 *
 * Not a rule about training, a rule about measurement: a maximal test inside a week of the
 * last one is reading residual fatigue as much as strength. Warned about, never blocked —
 * a redo after a bad attempt is legitimate and the app cannot tell the difference.
 */
export const RETEST_TOO_SOON_DAYS = 7;

export interface TestResult {
  id: Id;
  exerciseSlug: string;
  kind: TestKind;
  date: DayKey;
  /** Reps, kilograms, or seconds, according to the kind. */
  value: number;
  /** For a 3RM: the reps actually completed at that load. Three unless you note otherwise. */
  reps?: number;
  /** Derived at the time, so a later change to the formula cannot rewrite history. */
  estimated1RMKg?: number;
  /** The workout it was performed in. */
  sessionId?: Id;
  notes?: string;
}

export function latestResult(results: TestResult[], exerciseSlug: string): TestResult | undefined {
  return results
    .filter((result) => result.exerciseSlug === exerciseSlug)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

export type TestTiming =
  | { state: 'never' }
  | { state: 'tooSoon'; last: TestResult; daysSince: number; waitDays: number }
  | { state: 'ready'; last: TestResult; daysSince: number }
  | { state: 'due'; last: TestResult; daysSince: number };

/** Where a movement stands: never tested, due, fine to test, or too soon to mean anything. */
export function testTiming(
  results: TestResult[],
  exerciseSlug: string,
  today: DayKey,
): TestTiming {
  const last = latestResult(results, exerciseSlug);
  if (!last) return { state: 'never' };

  const daysSince = daysBetween(last.date, today);
  if (daysSince < RETEST_TOO_SOON_DAYS) {
    return { state: 'tooSoon', last, daysSince, waitDays: RETEST_TOO_SOON_DAYS - daysSince };
  }
  return daysSince >= RETEST_DUE_DAYS
    ? { state: 'due', last, daysSince }
    : { state: 'ready', last, daysSince };
}

export function nextDueDate(last: TestResult): DayKey {
  return addDays(last.date, RETEST_DUE_DAYS);
}

// --- the protocol ----------------------------------------------------------

export interface TestStep {
  /** Warm-up sets prepare; the attempt is the measurement. */
  role: 'warmup' | 'attempt';
  label: string;
  /** Kilograms, where the movement is loaded. */
  loadKg?: number;
  /** Target reps. Absent on an open set, where the count is the result. */
  reps?: number;
  /** Seconds to hold, for a warm-up hold. */
  holdSec?: number;
  /** Rest before the next step. */
  restSec: number;
  note?: string;
}

/**
 * Load added between attempts, as a fraction of the estimate.
 *
 * NSCA gives 5–10% for upper body and 10–20% for lower, the difference being that a squat
 * tolerates a bigger jump than a press. The conservative end of each: a jump too large ends
 * the test early with a failed attempt, and a jump too small only costs one more set.
 */
const ATTEMPT_STEP = { upper: 0.05, lower: 0.1 } as const;

export const MAX_ATTEMPTS = 5;

function stepFraction(exercise: Exercise): number {
  return regionOf(exercise) === 'lower' ? ATTEMPT_STEP.lower : ATTEMPT_STEP.upper;
}

/**
 * The lightest load heavier than this one, or null at the top of the rack.
 *
 * With no rack defined anything is loadable, so half a kilo up always exists.
 */
function nextLoadAbove(kg: number, loads?: number[]): number | null {
  if (!loads || loads.length === 0) return kg + 0.5;
  const heavier = loads.filter((load) => load > kg).sort((a, b) => a - b);
  return heavier[0] ?? null;
}

/**
 * The whole test, laid out before it starts.
 *
 * `estimateKg` is what you think you can do for three. Everything is computed from it, so a
 * wrong guess costs an extra attempt or an early failure rather than invalidating anything —
 * the result is whatever the last good set was, not whatever was predicted.
 */
export function buildProtocol(options: {
  exercise: Exercise;
  kind: TestKind;
  estimateKg?: number;
  /**
   * The loads you can actually pick up, ascending. Absent means anything to the half kilo.
   */
  loads?: number[];
}): TestStep[] {
  const { exercise, kind, estimateKg, loads } = options;
  const round = (kg: number) => roundToAvailableLoad(kg, loads);

  if (kind === 'reps') {
    return [
      {
        role: 'warmup',
        label: 'Easy set',
        reps: 8,
        restSec: 90,
        note: 'Well short of failure. Enough to be warm, not enough to cost you reps.',
      },
      {
        role: 'attempt',
        label: 'Max reps',
        restSec: 0,
        note: 'Stop at technical failure — when depth, alignment or tempo goes, not when it burns.',
      },
    ];
  }

  if (kind === 'hold') {
    return [
      {
        role: 'warmup',
        label: 'Short hold',
        holdSec: 15,
        restSec: 90,
        note: 'Find the position. Nowhere near failure.',
      },
      {
        role: 'attempt',
        label: 'Max hold',
        restSec: 0,
        note: 'Hold while the shape stays honest. The clock stops when the position goes.',
      },
    ];
  }

  // A 3RM with nothing to go on cannot lay out loads, so it asks for the estimate first.
  if (!estimateKg || estimateKg <= 0) return [];

  const step = stepFraction(exercise);
  const steps: TestStep[] = [
    {
      role: 'warmup',
      label: 'Warm-up 1',
      loadKg: round(estimateKg * 0.5),
      reps: 8,
      restSec: 60,
      note: 'Light. Moving well is the only goal.',
    },
    {
      role: 'warmup',
      label: 'Warm-up 2',
      loadKg: round(estimateKg * 0.75),
      reps: 4,
      restSec: 120,
      note: 'Getting heavy, still comfortable.',
    },
  ];

  /*
   * Every attempt has to be heavier than the one before it.
   *
   * On a sparse rack the percentage steps round to the same object: five per cent above a
   * 24 kg bell is 25.2, and the nearest bell is the 24 you just lifted. Left alone the ladder
   * stalls and asks you to repeat a weight you have already made, which measures nothing. So
   * a duplicate is pushed to the next load that exists, and when nothing heavier exists the
   * test simply ends — you cannot test past your top bell, and pretending otherwise would
   * print attempts nobody can perform.
   */
  let previous = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const target = round(estimateKg * (1 + step * attempt));
    const loadKg = target > previous ? target : nextLoadAbove(previous, loads);
    if (loadKg == null) break;

    previous = loadKg;
    steps.push({
      role: 'attempt',
      label: `Attempt ${steps.filter((s) => s.role === 'attempt').length + 1}`,
      loadKg,
      reps: 3,
      restSec: 180,
      note:
        attempt === 0
          ? 'Your estimate. Three good reps, then add load.'
          : 'Stop the test at the first set you cannot finish with good form.',
    });
  }

  return steps;
}

/**
 * A 3RM expressed as a one-rep max.
 *
 * Stored alongside the result rather than derived on read, so improving the formula later
 * cannot silently rewrite what a past test said.
 */
export function oneRepMaxFromThree(loadKg: number): number {
  // Epley at three reps: load x (1 + 3/30).
  return loadKg * 1.1;
}

/** Marks a planned session as a testing day, so the calendar can route it to the runner. */
export const TEST_DAY_MARKER = 'benchmark-test';

/**
 * The movements a plan's testing day should measure.
 *
 * Whatever the plan trains most, capped at three. A testing day is already long — five
 * attempts at three minutes rest is most of an hour for one movement — and a bookend test you
 * cannot finish is one that never happens twice, which defeats the comparison it exists for.
 */
export function testDayMovements(
  prescribedSlugs: string[],
  exerciseBySlug: Map<string, Exercise>,
  limit = 3,
): string[] {
  const counts = new Map<string, number>();
  for (const slug of prescribedSlugs) {
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([slug]) => {
      const exercise = exerciseBySlug.get(slug);
      // A run is measured by a race, not by a three rep max.
      return exercise ? regionOf(exercise) !== 'cardio' : false;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug]) => slug);
}

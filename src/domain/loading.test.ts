import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRAINING_MAX,
  MAX_FRESH_DAYS,
  isStale,
  knownMax,
  loadForPercent,
  percentForReps,
  suggestLoad,
} from './loading';
import type { KnownMax } from './loading';
import type { PersonalRecord } from './training';
import type { TestResult } from './fitnessTests';
import type { Exercise, MetricKey } from './types';

const TODAY = '2026-06-01';

const barbell = {
  slug: 'back-squat',
  metrics: ['weightKg', 'reps'] as MetricKey[],
  pattern: 'squat',
} as Exercise;

const pushUp = { slug: 'push-up', metrics: ['reps'] as MetricKey[], pattern: 'pushHorizontal' } as Exercise;

const test = (over: Partial<TestResult> = {}): TestResult => ({
  id: 't1',
  exerciseSlug: 'back-squat',
  kind: 'threeRepMax',
  date: '2026-05-01',
  value: 100,
  estimated1RMKg: 110,
  ...over,
});

const record = (over: Partial<PersonalRecord> = {}): PersonalRecord => ({
  exerciseSlug: 'back-squat',
  date: '2026-05-01',
  sources: { oneRm: { sessionId: 's1', date: '2026-05-01' } },
  best1RMKg: 105,
  ...over,
});

const max = (over: Partial<KnownMax> = {}): KnownMax => ({
  exerciseSlug: 'back-squat',
  oneRepMaxKg: 100,
  origin: 'test',
  date: '2026-05-25',
  ...over,
});

describe('percentForReps', () => {
  /** NSCA's training load chart. */
  it('matches the published chart', () => {
    expect(percentForReps(1)).toBeCloseTo(1.0);
    expect(percentForReps(3)).toBeCloseTo(0.93);
    expect(percentForReps(5)).toBeCloseTo(0.87);
    expect(percentForReps(8)).toBeCloseTo(0.8);
    expect(percentForReps(10)).toBeCloseTo(0.75);
    expect(percentForReps(12)).toBeCloseTo(0.7);
  });

  it('falls as the reps rise', () => {
    for (let reps = 2; reps <= 12; reps++) {
      expect(percentForReps(reps)!).toBeLessThan(percentForReps(reps - 1)!);
    }
  });

  it('interpolates the gap in the chart', () => {
    const eleven = percentForReps(11)!;
    expect(eleven).toBeLessThan(percentForReps(10)!);
    expect(eleven).toBeGreaterThan(percentForReps(12)!);
  });

  /** Past twelve it stops being a strength prescription, so nothing is proposed. */
  it('declines rep counts off the chart', () => {
    expect(percentForReps(0)).toBeUndefined();
    expect(percentForReps(13)).toBeUndefined();
    expect(percentForReps(30)).toBeUndefined();
  });
});

describe('knownMax', () => {
  const noRecords = new Map<string, PersonalRecord>();

  it('finds nothing without evidence', () => {
    expect(knownMax('back-squat', [], noRecords)).toBeUndefined();
  });

  it('uses a test when there is one', () => {
    const found = knownMax('back-squat', [test()], noRecords);
    expect(found).toMatchObject({ oneRepMaxKg: 110, origin: 'test' });
  });

  it('falls back to what you have lifted when nothing was tested', () => {
    const found = knownMax('back-squat', [], new Map([['back-squat', record()]]));
    expect(found).toMatchObject({ oneRepMaxKg: 105, origin: 'logged' });
  });

  /** A test is standardised, so it wins over an opportunistic set that implies less. */
  it('prefers the test over a lower logged estimate', () => {
    const found = knownMax('back-squat', [test()], new Map([['back-squat', record()]]));
    expect(found).toMatchObject({ oneRepMaxKg: 110, origin: 'test' });
  });

  /**
   * The exception: having actually lifted more than the test predicted, since the test, is
   * better evidence than the test. Refusing to notice would prescribe from a beaten number.
   */
  it('prefers a logged best that is both newer and higher', () => {
    const newer = record({
      best1RMKg: 120,
      sources: { oneRm: { sessionId: 's2', date: '2026-05-20' } },
    });
    const found = knownMax('back-squat', [test()], new Map([['back-squat', newer]]));
    expect(found).toMatchObject({ oneRepMaxKg: 120, origin: 'logged' });
  });

  it('ignores a newer logged best that is lower', () => {
    const newerButLighter = record({
      best1RMKg: 90,
      sources: { oneRm: { sessionId: 's2', date: '2026-05-20' } },
    });
    const found = knownMax('back-squat', [test()], new Map([['back-squat', newerButLighter]]));
    expect(found).toMatchObject({ oneRepMaxKg: 110, origin: 'test' });
  });

  it('takes the most recent of several tests', () => {
    const found = knownMax(
      'back-squat',
      [test({ id: 'old', date: '2026-01-01', estimated1RMKg: 80 }), test({ id: 'new' })],
      noRecords,
    );
    expect(found?.oneRepMaxKg).toBe(110);
  });

  /**
   * A hand-entered max and a tested one are both deliberate statements about a maximum, so
   * neither outranks the other on principle — recency decides.
   */
  it('uses a max you entered when there is nothing else', () => {
    const entered = test({ id: 'm1', entry: 'manual', kind: 'maxLoad', estimated1RMKg: 95 });
    expect(knownMax('back-squat', [entered], noRecords)).toMatchObject({
      oneRepMaxKg: 95,
      origin: 'manual',
    });
  });

  it('prefers a newer test over an older entry', () => {
    const entered = test({ id: 'm1', entry: 'manual', kind: 'maxLoad', date: '2026-01-01', estimated1RMKg: 200 });
    const tested = test({ id: 't1', date: '2026-05-01', estimated1RMKg: 110 });
    expect(knownMax('back-squat', [entered, tested], noRecords)).toMatchObject({
      oneRepMaxKg: 110,
      origin: 'test',
    });
  });

  it('prefers a newer entry over an older test', () => {
    const tested = test({ id: 't1', date: '2026-01-01', estimated1RMKg: 110 });
    const entered = test({ id: 'm1', entry: 'manual', kind: 'maxLoad', date: '2026-05-01', estimated1RMKg: 130 });
    expect(knownMax('back-squat', [tested, entered], noRecords)).toMatchObject({
      oneRepMaxKg: 130,
      origin: 'manual',
    });
  });

  /** Same day, and one of them was actually performed. */
  it('breaks a same-day tie toward the test', () => {
    const tested = test({ id: 't1', date: '2026-05-01', estimated1RMKg: 110 });
    const entered = test({ id: 'm1', entry: 'manual', kind: 'maxLoad', date: '2026-05-01', estimated1RMKg: 130 });
    expect(knownMax('back-squat', [entered, tested], noRecords)).toMatchObject({
      origin: 'test',
    });
  });

  it('still yields to a logged set that is newer and heavier than an entry', () => {
    const entered = test({ id: 'm1', entry: 'manual', kind: 'maxLoad', date: '2026-05-01', estimated1RMKg: 100 });
    const newer = record({
      best1RMKg: 125,
      sources: { oneRm: { sessionId: 's2', date: '2026-05-20' } },
    });
    expect(knownMax('back-squat', [entered], new Map([['back-squat', newer]]))).toMatchObject({
      oneRepMaxKg: 125,
      origin: 'logged',
    });
  });

  it('never crosses movements', () => {
    expect(knownMax('bench-press', [test()], new Map([['back-squat', record()]]))).toBeUndefined();
  });
});

describe('isStale', () => {
  it('is fresh inside the window', () => {
    expect(isStale(max({ date: '2026-05-25' }), TODAY)).toBe(false);
  });

  it('is stale past it', () => {
    expect(isStale(max({ date: '2026-01-01' }), TODAY)).toBe(true);
  });

  it('is fresh exactly on the boundary', () => {
    const boundary = max({ date: '2026-04-06' }); // 56 days before
    expect(MAX_FRESH_DAYS).toBe(56);
    expect(isStale(boundary, TODAY)).toBe(false);
  });
});

describe('suggestLoad', () => {
  const suggest = (over: Parameters<typeof suggestLoad>[0] extends infer T ? Partial<T> : never = {}) =>
    suggestLoad({ exercise: barbell, reps: 5, max: max(), today: TODAY, ...over });

  /** Percentages come off 90% of the true max, not the max itself. */
  it('works from the training max rather than the true max', () => {
    // 100 x 0.9 x 0.87 = 78.3, down to the half kilo.
    expect(suggest()?.loadKg).toBeCloseTo(78);
  });

  it('honours a different training max', () => {
    const full = suggest({ trainingMax: 1 });
    // 100 x 1 x 0.87 = 87.
    expect(full?.loadKg).toBeCloseTo(87);
    expect(full!.loadKg).toBeGreaterThan(suggest()!.loadKg);
  });

  it('defaults the training max to the established convention', () => {
    expect(DEFAULT_TRAINING_MAX).toBe(0.9);
  });

  it('gets lighter as the reps rise', () => {
    expect(suggest({ reps: 8 })!.loadKg).toBeLessThan(suggest({ reps: 3 })!.loadKg);
  });

  it('rounds to a load you own', () => {
    const bells = [16, 24, 32, 40];
    const suggestion = suggest({ loads: bells });
    expect(bells).toContain(suggestion?.loadKg);
  });

  /**
   * Down, never up. Rounding to the nearest defeats the training max on a sparse rack: a
   * target of 78.3 landing on an 80 prescribes more than the discount was there to allow, and
   * overshooting means missed reps — the exact failure it exists to prevent.
   */
  it('never suggests more than the target it computed', () => {
    const bells = [60, 70, 80, 90];
    // 100 x 0.9 x 0.87 = 78.3, which is nearer 80 than 70.
    expect(suggest({ loads: bells })!.loadKg).toBe(70);
  });

  it('offers the lightest thing you own when nothing is light enough', () => {
    expect(suggest({ loads: [100, 120], max: max({ oneRepMaxKg: 50 }) })!.loadKg).toBe(100);
  });

  it('reports the percentage of the true max it landed on', () => {
    const suggestion = suggest();
    expect(suggestion!.percentOfMax).toBeCloseTo(suggestion!.loadKg / 100, 5);
  });

  it('passes the staleness of the max it used through', () => {
    expect(suggest({ max: max({ date: '2026-01-01' }) })?.stale).toBe(true);
  });

  /* Nothing to guess from means no guess, rather than a number pulled out of the air. */
  it('proposes nothing without a max', () => {
    expect(suggest({ max: undefined })).toBeUndefined();
  });

  it('proposes nothing for a movement that carries no load', () => {
    expect(suggest({ exercise: pushUp })).toBeUndefined();
  });

  it('proposes nothing for a rep count off the chart', () => {
    expect(suggest({ reps: 20 })).toBeUndefined();
  });

  it('proposes nothing from a nonsense max', () => {
    expect(suggest({ max: max({ oneRepMaxKg: 0 }) })).toBeUndefined();
  });
});

describe('loadForPercent', () => {
  it('resolves a prescribed percentage against the training max', () => {
    // 100 x 0.9 x 0.75 = 67.5
    expect(loadForPercent({ percent: 0.75, max: max() })).toBeCloseTo(67.5);
  });

  it('rounds down to what you own', () => {
    // 100 x 0.9 x 0.75 = 67.5, so the 65 rather than the 70.
    expect(loadForPercent({ percent: 0.75, max: max(), loads: [60, 65, 70] })).toBe(65);
    expect(loadForPercent({ percent: 0.75, max: max(), loads: [16, 24, 32, 40] })).toBe(40);
  });

  it('resolves nothing without a max', () => {
    expect(loadForPercent({ percent: 0.75, max: undefined })).toBeUndefined();
  });
});

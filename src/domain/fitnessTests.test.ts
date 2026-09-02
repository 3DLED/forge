import { describe, expect, it } from 'vitest';
import {
  MAX_ATTEMPTS,
  RETEST_DUE_DAYS,
  RETEST_TOO_SOON_DAYS,
  buildProtocol,
  latestResult,
  nextDueDate,
  oneRepMaxFromThree,
  testKindFor,
  testTiming,
} from './fitnessTests';
import type { TestResult } from './fitnessTests';
import { roundToAvailableLoad } from './equipment';
import type { Exercise, MetricKey } from './types';

const ex = (over: Partial<Exercise>): Exercise =>
  ({ slug: 'x', pattern: 'pushHorizontal', metrics: ['reps'] as MetricKey[], equipment: [], ...over }) as Exercise;

const press = ex({ slug: 'press', metrics: ['weightKg', 'reps'], pattern: 'pushVertical' });
const squat = ex({ slug: 'squat', metrics: ['weightKg', 'reps'], pattern: 'squat' });
const pushUp = ex({ slug: 'push-up', metrics: ['reps'] });
const plank = ex({ slug: 'plank', metrics: ['timeSec'], pattern: 'core' });

const result = (over: Partial<TestResult> = {}): TestResult => ({
  id: 'r1',
  exerciseSlug: 'press',
  kind: 'threeRepMax',
  date: '2026-01-01',
  value: 60,
  ...over,
});

describe('testKindFor', () => {
  it('measures a loaded movement by its three rep max', () => {
    expect(testKindFor(press)).toBe('threeRepMax');
  });

  it('measures an unloaded movement by reps', () => {
    expect(testKindFor(pushUp)).toBe('reps');
  });

  it('measures a hold by time', () => {
    expect(testKindFor(plank)).toBe('hold');
  });

  /** A movement scored by time *and* reps is a rep movement; only pure holds are held. */
  it('does not call a timed rep movement a hold', () => {
    expect(testKindFor(ex({ metrics: ['timeSec', 'reps'] }))).toBe('reps');
  });
});

describe('testTiming', () => {
  const results = [result({ date: '2026-03-01' })];

  it('reports a movement never tested', () => {
    expect(testTiming([], 'press', '2026-03-10')).toEqual({ state: 'never' });
  });

  /**
   * Inside a week, a maximal test reads residual fatigue as much as strength. Reported, never
   * enforced — a redo after a bad attempt is legitimate and nothing here can tell them apart.
   */
  it('says too soon inside a week, and says how long to wait', () => {
    const timing = testTiming(results, 'press', '2026-03-04');
    expect(timing.state).toBe('tooSoon');
    if (timing.state === 'tooSoon') {
      expect(timing.daysSince).toBe(3);
      expect(timing.waitDays).toBe(RETEST_TOO_SOON_DAYS - 3);
    }
  });

  it('is ready once a week has passed', () => {
    expect(testTiming(results, 'press', '2026-03-08').state).toBe('ready');
  });

  it('is due at four weeks', () => {
    expect(testTiming(results, 'press', '2026-03-29').state).toBe('due');
  });

  it('counts the boundary day as ready rather than too soon', () => {
    expect(testTiming(results, 'press', '2026-03-08').state).toBe('ready');
  });

  it('reads the most recent test when there are several', () => {
    const history = [
      result({ id: 'old', date: '2026-01-01', value: 50 }),
      result({ id: 'new', date: '2026-03-01', value: 60 }),
    ];
    expect(latestResult(history, 'press')?.id).toBe('new');
  });

  it('ignores other movements entirely', () => {
    expect(testTiming(results, 'squat', '2026-03-02')).toEqual({ state: 'never' });
  });

  it('proposes the next date four weeks on', () => {
    expect(nextDueDate(result({ date: '2026-03-01' }))).toBe(
      `2026-03-${String(1 + RETEST_DUE_DAYS).padStart(2, '0')}`,
    );
  });
});

describe('the three rep max protocol', () => {
  const build = (exercise: Exercise, estimateKg?: number, loads?: number[]) =>
    buildProtocol({ exercise, kind: 'threeRepMax', estimateKg, loads });

  it('cannot lay out loads without an estimate to work from', () => {
    expect(build(press)).toEqual([]);
  });

  it('opens with two warm-up sets, getting heavier', () => {
    const steps = build(press, 100);
    const warmups = steps.filter((s) => s.role === 'warmup');

    expect(warmups).toHaveLength(2);
    expect(warmups[0].loadKg!).toBeLessThan(warmups[1].loadKg!);
    expect(warmups[0].reps!).toBeGreaterThan(warmups[1].reps!);
  });

  /** Past about five, the test measures accumulated fatigue rather than strength. */
  it('offers no more than five attempts', () => {
    const attempts = build(press, 100).filter((s) => s.role === 'attempt');
    expect(attempts).toHaveLength(MAX_ATTEMPTS);
  });

  it('every attempt is a set of three', () => {
    const attempts = build(press, 100).filter((s) => s.role === 'attempt');
    expect(attempts.every((s) => s.reps === 3)).toBe(true);
  });

  it('starts the attempts at your estimate', () => {
    const attempts = build(press, 100).filter((s) => s.role === 'attempt');
    expect(attempts[0].loadKg).toBe(100);
  });

  /** NSCA: 5–10% upper body, 10–20% lower. A squat tolerates a bigger jump than a press. */
  it('steps lower body up faster than upper body', () => {
    const pressAttempts = build(press, 100).filter((s) => s.role === 'attempt');
    const squatAttempts = build(squat, 100).filter((s) => s.role === 'attempt');

    expect(pressAttempts[1].loadKg).toBe(105);
    expect(squatAttempts[1].loadKg).toBe(110);
  });

  it('rests two to four minutes between attempts', () => {
    const attempts = build(press, 100).filter((s) => s.role === 'attempt');
    for (const attempt of attempts) {
      expect(attempt.restSec).toBeGreaterThanOrEqual(120);
      expect(attempt.restSec).toBeLessThanOrEqual(240);
    }
  });

  it('rounds every load to something you can actually pick up', () => {
    const bells = [16, 24, 32, 40];
    const steps = build(press, 30, bells);

    for (const step of steps) {
      expect(bells).toContain(step.loadKg);
    }
  });

  /**
   * The sparse-rack problem. Five per cent above a 24 kg bell is 25.2, whose nearest bell is
   * the 24 just lifted — so a naive ladder repeats a weight already made and measures nothing.
   */
  it('never repeats a load between attempts', () => {
    const attempts = build(press, 24, [16, 20, 24, 28, 32, 40]).filter((s) => s.role === 'attempt');
    const loads = attempts.map((s) => s.loadKg!);

    expect(new Set(loads).size).toBe(loads.length);
    for (let i = 1; i < loads.length; i++) {
      expect(loads[i]).toBeGreaterThan(loads[i - 1]);
    }
  });

  /** You cannot test past your heaviest bell, and printing attempts nobody can load is worse. */
  it('stops early when the rack runs out', () => {
    const attempts = build(press, 32, [16, 24, 32]).filter((s) => s.role === 'attempt');

    expect(attempts.map((s) => s.loadKg)).toEqual([32]);
    expect(attempts.length).toBeLessThan(MAX_ATTEMPTS);
  });

  it('numbers the attempts it actually offers', () => {
    const attempts = build(press, 32, [16, 24, 32]).filter((s) => s.role === 'attempt');
    expect(attempts[0].label).toBe('Attempt 1');
  });
});

describe('the bodyweight and hold protocols', () => {
  it('warms up, then takes one open set as the measurement', () => {
    const steps = buildProtocol({ exercise: pushUp, kind: 'reps' });

    expect(steps.map((s) => s.role)).toEqual(['warmup', 'attempt']);
    // Open: the rep count is the result, so nothing prescribes one.
    expect(steps[1].reps).toBeUndefined();
  });

  it('names technical failure as the stopping point, not muscular failure', () => {
    const steps = buildProtocol({ exercise: pushUp, kind: 'reps' });
    expect(steps[1].note).toMatch(/technical failure/i);
  });

  it('warms up a hold well short of the attempt', () => {
    const steps = buildProtocol({ exercise: plank, kind: 'hold' });

    expect(steps[0].holdSec).toBeGreaterThan(0);
    expect(steps[1].holdSec).toBeUndefined();
  });
});

describe('roundToAvailableLoad', () => {
  it('picks the nearest bell you own', () => {
    expect(roundToAvailableLoad(30, [16, 24, 32, 40])).toBe(32);
    expect(roundToAvailableLoad(19, [16, 24, 32, 40])).toBe(16);
  });

  /** A programme that drifts light on every tie is one that quietly stops progressing. */
  it('breaks a tie upward', () => {
    expect(roundToAvailableLoad(28, [24, 32])).toBe(32);
  });

  it('falls back to the nearest half kilo when the rack is unknown', () => {
    expect(roundToAvailableLoad(72.3)).toBe(72.5);
    expect(roundToAvailableLoad(72.1)).toBe(72);
  });

  it('treats an empty rack as unknown rather than impossible', () => {
    expect(roundToAvailableLoad(72.3, [])).toBe(72.5);
  });
});

describe('oneRepMaxFromThree', () => {
  it('converts a three rep max with Epley', () => {
    expect(oneRepMaxFromThree(100)).toBeCloseTo(110);
  });
});

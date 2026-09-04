/**
 * The session suggester, and specifically the conditioning finisher.
 *
 * This is what makes "lose fat" a different session from "get stronger" rather than the same
 * one wearing a different label — which is the whole reason the picker can honestly offer all
 * five goals instead of the three rep schemes underneath them.
 *
 * The evidence behind it is in `goals.ts`: in a deficit the lifting stays heavy, because load
 * is what protects muscle, and the fat loss comes from the conditioning and the eating. So the
 * scheme is untouched and the work goes on the end.
 */

import { describe, expect, it } from 'vitest';
import { suggestWorkout } from './generator';
import { conditioningMinutesFor, goalSpec } from './goals';
import type { Exercise } from './types';

const lift = (slug: string, pattern: string, over: Partial<Exercise> = {}): Exercise =>
  ({
    id: slug,
    slug,
    name: slug.replace(/-/g, ' '),
    modality: 'strength',
    pattern,
    equipment: ['bodyweight'],
    metrics: ['weightKg', 'reps'],
    primaryMuscles: [],
    secondaryMuscles: [],
    unilateral: false,
    substitutes: [],
    progression: { easier: [], harder: [] },
    isCustom: false,
    common: true,
    isAccessory: false,
    level: 3,
    bodyweightFactor: 0,
    ...over,
  }) as Exercise;

const run = (slug: string, over: Partial<Exercise> = {}): Exercise =>
  lift(slug, 'gait', { modality: 'cardio', metrics: ['distanceM', 'timeSec'], ...over });

const LIFTS = [
  lift('bench-press', 'pushHorizontal'),
  lift('overhead-press', 'pushVertical'),
  lift('barbell-row', 'pullHorizontal'),
  lift('pull-up', 'pullVertical'),
  lift('back-squat', 'squat'),
  lift('deadlift', 'hinge'),
];

const suggest = (over: Parameters<typeof suggestWorkout>[0] extends infer T ? Partial<T> : never) =>
  suggestWorkout({
    regions: ['upper', 'lower'],
    goal: 'strength',
    minutes: 60,
    exercises: LIFTS,
    available: new Set(LIFTS.map((e) => e.slug)),
    ...over,
  } as Parameters<typeof suggestWorkout>[0]);

describe('without conditioning asked for', () => {
  it('suggests lifting only', () => {
    const out = suggest({ exercises: [...LIFTS, run('easy-run')], available: new Set([...LIFTS.map((e) => e.slug), 'easy-run']) });
    expect(out.items.every((item) => item.exercise.modality === 'strength')).toBe(true);
  });

  it('does not mention conditioning at all', () => {
    expect(suggest({}).notes.join(' ')).not.toMatch(/conditioning/i);
  });
});

describe('with a finisher', () => {
  const withRun = (over = {}) =>
    suggest({
      conditioningMin: 10,
      exercises: [...LIFTS, run('easy-run'), run('row-erg')],
      available: new Set([...LIFTS.map((e) => e.slug), 'easy-run', 'row-erg']),
      ...over,
    });

  it('finishes on conditioning', () => {
    const out = withRun();
    expect(out.items.at(-1)?.exercise.modality).toBe('cardio');
  });

  it('asks for the minutes it was given', () => {
    const last = withRun().items.at(-1)!;
    expect(last.values.timeSec).toBe(600);
    expect(last.target).toBe('10 min');
  });

  it('adds exactly one piece', () => {
    expect(withRun().items.filter((i) => i.exercise.modality === 'cardio')).toHaveLength(1);
  });

  /* Taken out of the budget, not added to it — a finisher that overruns is one people drop. */
  it('takes its minutes out of the time budget rather than overrunning', () => {
    const out = withRun({ minutes: 30 });
    expect(out.estimatedMinutes).toBeLessThanOrEqual(30);
    expect(out.items.at(-1)?.exercise.modality).toBe('cardio');
  });

  /* Trimming for time must not eat the thing the goal actually asked for. */
  it('keeps the finisher even when the lifting had to be cut hard', () => {
    const out = withRun({ minutes: 12 });
    expect(out.items.at(-1)?.exercise.modality).toBe('cardio');
  });

  it('rotates onto whatever has been done least', () => {
    const out = withRun({ usage: new Map([['easy-run', 9], ['row-erg', 0]]) });
    expect(out.items.at(-1)?.exercise.slug).toBe('row-erg');
  });

  it('does not offer conditioning already in the session', () => {
    const out = withRun({ exclude: new Set(['easy-run']) });
    expect(out.items.at(-1)?.exercise.slug).toBe('row-erg');
  });

  /* Indoors with no kit there is nothing to run on, and saying so beats silently dropping it. */
  it('says so when nothing available can be used for conditioning', () => {
    const out = suggest({ conditioningMin: 10 });

    expect(out.items.every((item) => item.exercise.modality === 'strength')).toBe(true);
    expect(out.notes.join(' ')).toMatch(/No conditioning was added/);
  });
});

describe('what each goal asks for', () => {
  /* Four of the five differ. General is deliberately the neutral one, and says so. */
  it('adds conditioning for fat loss and endurance, and not for the others', () => {
    expect(conditioningMinutesFor('fatLoss')).toBeGreaterThan(0);
    expect(conditioningMinutesFor('endurance')).toBeGreaterThan(0);
    expect(conditioningMinutesFor('strength')).toBe(0);
    expect(conditioningMinutesFor('muscle')).toBe(0);
    expect(conditioningMinutesFor('general')).toBe(0);
  });

  /* The point of the research note: a deficit is not a reason to stop lifting heavy. */
  it('keeps fat loss on the heavy scheme, not a light circuit', () => {
    expect(goalSpec('fatLoss').lifting).toBe('strength');
    expect(goalSpec('fatLoss').lifting).toBe(goalSpec('strength').lifting);
  });

  it('makes fat loss a different session from getting stronger', () => {
    const heavy = suggest({
      conditioningMin: conditioningMinutesFor('strength'),
      exercises: [...LIFTS, run('easy-run')],
      available: new Set([...LIFTS.map((e) => e.slug), 'easy-run']),
    });
    const cut = suggest({
      conditioningMin: conditioningMinutesFor('fatLoss'),
      exercises: [...LIFTS, run('easy-run')],
      available: new Set([...LIFTS.map((e) => e.slug), 'easy-run']),
    });

    expect(cut.items.map((i) => i.exercise.slug)).not.toEqual(heavy.items.map((i) => i.exercise.slug));
    expect(cut.items.at(-1)?.exercise.slug).toBe('easy-run');
  });
});

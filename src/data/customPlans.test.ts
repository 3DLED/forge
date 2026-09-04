/**
 * Plans you built yourself, and the translation that lets them reuse the plan engine.
 *
 * The value of the translation is that nothing downstream knows a custom plan exists — so
 * what these check is that it produces a template the generator can consume, with the days
 * pinned where you put them, and that a snapshotted workout survives the trip.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import {
  allCustomPlans,
  rampValueAt,
  rampableMovements,
  dayLabel,
  daysPerWeek,
  duplicateCustomPlan,
  emptyWeek,
  saveCustomPlan,
  translateCustomPlan,
} from './customPlans';
import { generatePlan } from '../domain/planning';
import { SEED_SESSION_TEMPLATE_BY_SLUG } from './seed/sessionTemplates';
import type { CustomPlan, CustomPlanDay, Weekday } from '../domain/types';

const week = (over: Partial<Record<Weekday, Partial<CustomPlanDay>>>): CustomPlanDay[] =>
  emptyWeek().map((day) => ({ ...day, ...(over[day.weekday] ?? {}) }));

const savedWorkout = (name: string) => ({
  name,
  modalities: ['strength' as const],
  estimatedMinutes: 30,
  blocks: [
    {
      id: 'B1',
      style: 'amrap' as const,
      label: name,
      capSec: 600,
      items: [
        { id: 'I1', exerciseSlug: 'push-up', reps: 10, load: { kind: 'unspecified' as const } },
        { id: 'I2', exerciseSlug: 'air-squat', reps: 15, load: { kind: 'unspecified' as const } },
      ],
    },
  ],
});

const plan = (over: Partial<CustomPlan> = {}): CustomPlan =>
  ({
    id: 'CP1',
    name: 'My week',
    goal: 'general',
    weeks: 4,
    days: emptyWeek(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as CustomPlan;

beforeEach(async () => {
  await db.customPlans.clear();
  await db.changes.clear();
});

describe('reading a week', () => {
  it('starts empty, seven days, nothing decided', () => {
    const days = emptyWeek();
    expect(days).toHaveLength(7);
    expect(days.every((day) => day.kind === 'open')).toBe(true);
  });

  it('counts only the days that train', () => {
    const p = plan({
      days: week({
        1: { kind: 'template', templateSlug: 'full-body-a' },
        3: { kind: 'rest' },
        5: { kind: 'saved', workout: savedWorkout('Tuesday burner') },
      }),
    });

    expect(daysPerWeek(p)).toBe(2);
  });

  it('names what is on a day', () => {
    expect(dayLabel({ weekday: 1, kind: 'template', templateSlug: 'full-body-a' })).toBe(
      'Full Body A',
    );
    expect(dayLabel({ weekday: 2, kind: 'saved', workout: savedWorkout('Cindy') })).toBe('Cindy');
    expect(dayLabel({ weekday: 3, kind: 'rest' })).toBe('Rest');
    expect(dayLabel({ weekday: 4, kind: 'open' })).toBe('—');
  });
});

describe('translating into the plan engine', () => {
  it('pins each slot to the weekday it was put on', () => {
    const { template } = translateCustomPlan(
      plan({
        days: week({
          1: { kind: 'template', templateSlug: 'full-body-a' },
          4: { kind: 'template', templateSlug: 'run-easy' },
        }),
      }),
    );

    expect(template.slots.map((slot) => slot.weekday)).toEqual([1, 4]);
    expect(template.slots.map((slot) => slot.templateSlug)).toEqual(['full-body-a', 'run-easy']);
  });

  /**
   * A rest day has to close the day, not merely leave it empty.
   *
   * The generator adds conditioning of its own where the goal asks for it, and those float
   * into whatever day is free. Without reporting rest days separately, a plan whose author
   * said "Wednesday is off" comes back with a run on Wednesday.
   */
  it('reports the rest days so the day can be closed, not just left empty', () => {
    const { restDays, template } = translateCustomPlan(
      plan({
        days: week({
          1: { kind: 'template', templateSlug: 'full-body-a' },
          3: { kind: 'rest' },
          6: { kind: 'rest' },
        }),
      }),
    );

    expect(restDays).toEqual([3, 6]);
    // Still not slots — they schedule nothing, they only refuse.
    expect(template.slots).toHaveLength(1);
  });

  it('does not treat an undecided day as rest', () => {
    expect(translateCustomPlan(plan({ days: emptyWeek() })).restDays).toEqual([]);
  });

  it('leaves rest and undecided days out of the plan entirely', () => {
    const { template } = translateCustomPlan(
      plan({ days: week({ 1: { kind: 'template', templateSlug: 'full-body-a' }, 2: { kind: 'rest' } }) }),
    );

    expect(template.slots).toHaveLength(1);
    expect(template.daysPerWeek).toBe(1);
  });

  it('takes the modality from what is on the day, so the scheduler can match it', () => {
    const { template } = translateCustomPlan(
      plan({ days: week({ 2: { kind: 'template', templateSlug: 'run-easy' } }) }),
    );

    expect(template.slots[0].modality).toBe('cardio');
  });

  it('carries the plan’s own length and goal', () => {
    const { template } = translateCustomPlan(plan({ weeks: 8, goal: 'strength' }));
    expect(template).toMatchObject({ weeks: 8, goal: 'strength' });
  });

  it('keeps ongoing plans ongoing', () => {
    expect(translateCustomPlan(plan({ weeks: null })).template.weeks).toBeNull();
  });

  /* A built-in template that has since been renamed away is reported, not silently dropped. */
  it('reports a built-in template it cannot find', () => {
    const { template, missing } = translateCustomPlan(
      plan({ days: week({ 1: { kind: 'template', templateSlug: 'no-such-session' } }) }),
    );

    expect(missing).toEqual(['no-such-session']);
    expect(template.slots).toHaveLength(0);
  });
});

describe('a workout of your own, inside a plan', () => {
  const withSaved = () =>
    translateCustomPlan(
      plan({ days: week({ 3: { kind: 'saved', workout: savedWorkout('Tuesday burner') } }) }),
    );

  it('becomes a session template the generator can materialise', () => {
    const { template, sessionTemplateBySlug } = withSaved();
    const slug = template.slots[0].templateSlug;

    expect(sessionTemplateBySlug.get(slug)).toMatchObject({ name: 'Tuesday burner' });
  });

  it('keeps its movements and its shape', () => {
    const { template, sessionTemplateBySlug } = withSaved();
    const seed = sessionTemplateBySlug.get(template.slots[0].templateSlug)!;

    expect(seed.blocks[0].style).toBe('amrap');
    expect(seed.blocks[0].capSec).toBe(600);
    expect(seed.blocks[0].items.map((item) => item.ex)).toEqual(['push-up', 'air-squat']);
  });

  /* The built-in library has to survive alongside it, or every other day breaks. */
  it('adds to the built-in library rather than replacing it', () => {
    const { sessionTemplateBySlug } = withSaved();

    expect(sessionTemplateBySlug.get('full-body-a')).toBeDefined();
    expect(sessionTemplateBySlug.size).toBe(SEED_SESSION_TEMPLATE_BY_SLUG.size + 1);
  });

  it('gives two saved days slugs that do not collide', () => {
    const { template, sessionTemplateBySlug } = translateCustomPlan(
      plan({
        days: week({
          1: { kind: 'saved', workout: savedWorkout('Monday') },
          4: { kind: 'saved', workout: savedWorkout('Thursday') },
        }),
      }),
    );

    const slugs = template.slots.map((slot) => slot.templateSlug);
    expect(new Set(slugs).size).toBe(2);
    expect(slugs.map((slug) => sessionTemplateBySlug.get(slug)?.name)).toEqual([
      'Monday',
      'Thursday',
    ]);
  });
});

describe('end to end, through the real generator', () => {
  const openWeek = Array.from({ length: 7 }, (_, weekday) => ({
    weekday: weekday as Weekday,
    allowedModalities: ['strength', 'cardio', 'mobility', 'skill'] as const,
  }));

  const build = (days: CustomPlanDay[], weeks = 2) => {
    const { template, sessionTemplateBySlug } = translateCustomPlan(plan({ days, weeks }));
    return generatePlan({
      template,
      startDate: '2026-03-02', // a Monday
      availability: openWeek as never,
      exceptions: [],
      weekStartsOn: 0,
      exerciseBySlug: new Map(),
      available: new Set(),
      sessionTemplateBySlug,
    });
  };

  it('lands sessions on the weekdays you chose, every week', () => {
    const generated = build(
      week({
        1: { kind: 'template', templateSlug: 'full-body-a' },
        4: { kind: 'template', templateSlug: 'full-body-b' },
      }),
    );

    // Mondays and Thursdays of the two weeks beginning 2026-03-02.
    expect(generated.sessions.map((s) => s.date)).toEqual([
      '2026-03-02',
      '2026-03-05',
      '2026-03-09',
      '2026-03-12',
    ]);
  });

  it('repeats the same week for as many weeks as asked', () => {
    const generated = build(week({ 2: { kind: 'template', templateSlug: 'full-body-a' } }), 5);
    expect(generated.sessions).toHaveLength(5);
    expect(generated.weeks).toBe(5);
  });

  it('schedules a workout of your own like any other session', () => {
    const generated = build(week({ 3: { kind: 'saved', workout: savedWorkout('Cindy') } }));

    expect(generated.sessions).toHaveLength(2);
    expect(generated.sessions[0].prescription.name).toBe('Cindy');
  });
});

describe('storing them', () => {
  const draft = () => ({
    name: 'My week',
    goal: 'general' as const,
    weeks: 4,
    days: week({ 1: { kind: 'template' as const, templateSlug: 'full-body-a' } }),
  });

  it('saves and reads back', async () => {
    await saveCustomPlan(draft());
    const all = await allCustomPlans();

    expect(all).toHaveLength(1);
    expect(all[0].days.filter((d) => d.kind === 'template')).toHaveLength(1);
  });

  it('updates in place rather than adding another', async () => {
    const saved = await saveCustomPlan(draft());
    await saveCustomPlan({ ...draft(), name: 'Renamed' }, saved.id);

    const all = await allCustomPlans();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Renamed');
  });

  it('copies one without sharing anything with the original', async () => {
    const saved = await saveCustomPlan({
      ...draft(),
      days: week({ 1: { kind: 'saved', workout: savedWorkout('Cindy') } }),
    });

    const copy = await duplicateCustomPlan(saved);

    expect(copy.name).toBe('My week (copy)');
    expect(copy.id).not.toBe(saved.id);
    const copiedBlock = copy.days.find((d) => d.kind === 'saved')!.workout!.blocks[0];
    const originalBlock = saved.days.find((d) => d.kind === 'saved')!.workout!.blocks[0];
    expect(copiedBlock.id).not.toBe(originalBlock.id);
  });
});

/**
 * The one kind of progression a plan carries itself.
 *
 * Load autoregulates from what you actually lifted; distance does not, because nothing about
 * last Tuesday tells you how far to run in week nine. So a ramp is offered for distance and
 * time and for nothing else.
 */
describe('what can be made to grow', () => {
  it('finds the distance in a run session', () => {
    const found = rampableMovements({ weekday: 1, kind: 'template', templateSlug: 'run-long' });

    expect(found.length).toBeGreaterThan(0);
    expect(found[0].metric).toBe('distanceM');
    expect(found[0].value).toBeGreaterThan(0);
  });

  /**
   * Sets and reps are never offered, whatever else the session holds.
   *
   * Those are what the logger progresses, from what you actually lifted — a plan ramping them
   * too would be arguing with it every session. A timed hold in the same session is fair game,
   * because nothing autoregulates a plank either.
   */
  it('offers the hold in a lifting session and none of the lifts', () => {
    const found = rampableMovements({ weekday: 1, kind: 'template', templateSlug: 'full-body-a' });

    expect(found.every((movement) => movement.metric === 'timeSec')).toBe(true);
    expect(found.map((movement) => movement.exerciseSlug)).not.toContain('back-squat');
  });

  it('finds nothing on a rest day', () => {
    expect(rampableMovements({ weekday: 1, kind: 'rest' })).toEqual([]);
  });

  it('looks inside a workout of your own', () => {
    const found = rampableMovements({
      weekday: 1,
      kind: 'saved',
      workout: {
        name: 'Ruck',
        modalities: ['cardio'],
        blocks: [
          {
            id: 'B1',
            style: 'straight',
            items: [
              { id: 'I1', exerciseSlug: 'ruck', distanceM: 5000, load: { kind: 'unspecified' } },
            ],
          },
        ],
      },
    });

    expect(found).toEqual([{ exerciseSlug: 'ruck', metric: 'distanceM', value: 5000 }]);
  });
});

describe('how a ramp climbs', () => {
  const ramp = { exerciseSlug: 'long-run', metric: 'distanceM' as const, startValue: 5000, weeklyRate: 0.1 };

  it('starts where it says it starts', () => {
    expect(rampValueAt(ramp, 1)).toBe(5000);
  });

  /* Compounding, not linear — which is how distance is built and how the ceiling is quoted. */
  it('compounds rather than adding a flat amount', () => {
    expect(rampValueAt(ramp, 2)).toBe(5500);
    expect(rampValueAt(ramp, 3)).toBe(6050);
  });

  it('holds at the cap instead of running away', () => {
    const capped = { ...ramp, maxValue: 6000 };
    expect(rampValueAt(capped, 3)).toBe(6000);
    expect(rampValueAt(capped, 12)).toBe(6000);
  });

  /* Eight per cent sounds modest and doubles in nine weeks, which is why the UI previews it. */
  it('roughly doubles in nine weeks at eight per cent', () => {
    const eight = { ...ramp, weeklyRate: 0.08 };
    expect(rampValueAt(eight, 10) / rampValueAt(eight, 1)).toBeGreaterThan(1.9);
  });
});

describe('a ramp, through the generator', () => {
  it('grows the distance week by week in the sessions it produces', () => {
    const { template, sessionTemplateBySlug } = translateCustomPlan(
      plan({
        weeks: 4,
        days: week({
          2: {
            kind: 'template',
            templateSlug: 'run-long',
            ramp: {
              exerciseSlug: 'long-run',
              metric: 'distanceM',
              startValue: 5000,
              weeklyRate: 0.1,
            },
          },
        }),
      }),
    );

    const generated = generatePlan({
      template,
      startDate: '2026-03-02',
      availability: Array.from({ length: 7 }, (_, weekday) => ({
        weekday: weekday as Weekday,
        allowedModalities: ['strength', 'cardio', 'mobility', 'skill'],
      })) as never,
      exceptions: [],
      weekStartsOn: 0,
      exerciseBySlug: new Map(),
      available: new Set(),
      sessionTemplateBySlug,
    });

    const distances = generated.sessions.map(
      (session) => session.prescription.blocks[0].items[0].distanceM,
    );

    expect(distances).toEqual([5000, 5500, 6050, 6655]);
  });

  it('leaves a day without a ramp exactly as written', () => {
    const { template, sessionTemplateBySlug } = translateCustomPlan(
      plan({ weeks: 3, days: week({ 2: { kind: 'template', templateSlug: 'run-long' } }) }),
    );

    const generated = generatePlan({
      template,
      startDate: '2026-03-02',
      availability: Array.from({ length: 7 }, (_, weekday) => ({
        weekday: weekday as Weekday,
        allowedModalities: ['strength', 'cardio', 'mobility', 'skill'],
      })) as never,
      exceptions: [],
      weekStartsOn: 0,
      exerciseBySlug: new Map(),
      available: new Set(),
      sessionTemplateBySlug,
    });

    const distances = generated.sessions.map(
      (session) => session.prescription.blocks[0].items[0].distanceM,
    );

    expect(new Set(distances).size).toBe(1);
  });
});

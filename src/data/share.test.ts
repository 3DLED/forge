/**
 * Sharing a workout or a plan with someone else.
 *
 * The cases that matter are the ones where a file leaves one device and lands on another that
 * is not identical to it: a workout built from a movement you invented, a plan whose dates
 * mean nothing to the person receiving it, a name that is already taken. Those are exactly the
 * cases that cannot be checked by exporting and importing on the same machine, which is what
 * anyone testing this by hand would do.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { exerciseRepo, planRepo, templateRepo } from './repos';
import {
  ShareFileError,
  buildPlanFile,
  buildWorkoutFile,
  importPlan,
  importWorkout,
  parseShareFile,
  previewShareFile,
  shareFilename,
} from './share';
import type { Block, Exercise, Plan, SessionTemplate } from '../domain/types';

const exercise = (slug: string, isCustom: boolean): Omit<Exercise, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> =>
  ({
    slug,
    name: slug.replace(/-/g, ' '),
    modality: 'strength',
    pattern: 'squat',
    equipment: ['bodyweight'],
    metrics: ['reps'],
    primaryMuscles: [],
    secondaryMuscles: [],
    unilateral: false,
    substitutes: [],
    progression: { easier: [], harder: [] },
    isCustom,
    common: false,
    isAccessory: false,
    level: 3,
    bodyweightFactor: 0.6,
  }) as never;

const block = (slugs: string[]): Block => ({
  id: 'B1',
  style: 'straight',
  label: 'Work',
  items: slugs.map((slug, i) => ({
    id: `I${i}`,
    exerciseSlug: slug,
    sets: 3,
    reps: 10,
    load: { kind: 'unspecified' as const },
  })),
});

async function seedTemplate(name: string, slugs: string[]): Promise<SessionTemplate> {
  return (await templateRepo.create({
    name,
    modalities: ['strength'],
    estimatedMinutes: 25,
    blocks: [block(slugs)],
    isCustom: true,
  } as never)) as SessionTemplate;
}

async function seedPlan(over: Partial<Plan> = {}): Promise<Plan> {
  return (await planRepo.create({
    name: 'Eight Week Base',
    goal: { kind: 'general', eventDate: '2026-12-01' },
    startDate: '2026-03-02',
    endDate: '2026-03-16',
    phases: [],
    daysPerWeek: 3,
    isActive: true,
    ...over,
  } as never)) as Plan;
}

async function seedPlanSessions(planId: string, days: { date: string; slugs: string[] }[]) {
  let n = 0;
  for (const day of days) {
    n += 1;
    await db.plannedSessions.put({
      id: `PS${n}`,
      planId,
      date: day.date,
      status: 'planned',
      prescription: {
        name: `Day ${n}`,
        modalities: ['strength'],
        blocks: [block(day.slugs)],
        sourceTemplateId: 'local-template-id',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as never);
  }
}

beforeEach(async () => {
  await Promise.all([
    db.exercises.clear(),
    db.templates.clear(),
    db.plans.clear(),
    db.plannedSessions.clear(),
  ]);
  await exerciseRepo.create(exercise('air-squat', false) as never);
  await exerciseRepo.create(exercise('push-up', false) as never);
});

describe('a workout, exported', () => {
  it('carries its movements and its shape', async () => {
    const template = await seedTemplate('Cindy', ['push-up', 'air-squat']);
    const file = await buildWorkoutFile(template);

    expect(file).toMatchObject({ app: 'forge', kind: 'workout' });
    expect(file.workout?.name).toBe('Cindy');
    expect(file.workout?.blocks[0].items.map((i) => i.exerciseSlug)).toEqual([
      'push-up',
      'air-squat',
    ]);
  });

  /* Two hundred stock definitions inside a file describing one workout is a file about the library. */
  it('leaves seeded movements out — everyone already has them', async () => {
    const template = await seedTemplate('Cindy', ['push-up', 'air-squat']);
    expect((await buildWorkoutFile(template)).exercises).toEqual([]);
  });

  it('brings a movement you invented along with it', async () => {
    await exerciseRepo.create(exercise('custom-01abc', true) as never);
    const template = await seedTemplate('My thing', ['custom-01abc', 'push-up']);

    const file = await buildWorkoutFile(template);

    expect(file.exercises.map((e) => e.slug)).toEqual(['custom-01abc']);
  });

  it('carries no ids out of this device', async () => {
    const template = await seedTemplate('Cindy', ['push-up']);
    const json = JSON.stringify(await buildWorkoutFile(template));

    expect(json).not.toContain(template.id);
  });

  it('names the file after the workout', async () => {
    const template = await seedTemplate('Tuesday Burner!', ['push-up']);
    expect(shareFilename(await buildWorkoutFile(template))).toBe('forge-workout-tuesday-burner.json');
  });
});

describe('a workout, imported', () => {
  it('arrives with its movements and set counts intact', async () => {
    const file = await buildWorkoutFile(await seedTemplate('Cindy', ['push-up', 'air-squat']));
    await db.templates.clear();

    const { template } = await importWorkout(file);

    expect(template.name).toBe('Cindy');
    expect(template.blocks[0].items.map((i) => i.exerciseSlug)).toEqual(['push-up', 'air-squat']);
    expect(template.blocks[0].items[0].sets).toBe(3);
  });

  /* The case that decides whether sharing works at all: their library has never seen it. */
  it('recreates a movement the receiving library does not have', async () => {
    await exerciseRepo.create(exercise('custom-01abc', true) as never);
    const file = await buildWorkoutFile(await seedTemplate('My thing', ['custom-01abc']));

    await db.exercises.where('slug').equals('custom-01abc').delete();
    await db.templates.clear();

    const result = await importWorkout(file);

    expect(result.exercisesAdded).toBe(1);
    expect((await exerciseRepo.all()).map((e) => e.slug)).toContain('custom-01abc');
  });

  /**
   * A movement you deleted is still a row, so treating it as present would let the import
   * report success while leaving the workout pointing at something no picker will offer.
   */
  it('brings back a movement you had deleted, rather than skipping it', async () => {
    const mine = await exerciseRepo.create(exercise('custom-01abc', true) as never);
    const file = await buildWorkoutFile(await seedTemplate('My thing', ['custom-01abc']));

    await exerciseRepo.remove(mine.id);
    await db.templates.clear();
    expect((await exerciseRepo.all()).map((e) => e.slug)).not.toContain('custom-01abc');

    const result = await importWorkout(file);

    expect(result.exercisesRestored).toBe(1);
    expect(result.exercisesAdded).toBe(0);
    expect((await exerciseRepo.all()).map((e) => e.slug)).toContain('custom-01abc');
  });

  it('does not duplicate the movement it brought back', async () => {
    const mine = await exerciseRepo.create(exercise('custom-01abc', true) as never);
    const file = await buildWorkoutFile(await seedTemplate('My thing', ['custom-01abc']));
    await exerciseRepo.remove(mine.id);

    await importWorkout(file);

    const rows = (await exerciseRepo.allIncludingDeleted()).filter((e) => e.slug === 'custom-01abc');
    expect(rows).toHaveLength(1);
  });

  it('leaves a movement already here exactly as it is', async () => {
    await exerciseRepo.create(exercise('custom-01abc', true) as never);
    const file = await buildWorkoutFile(await seedTemplate('My thing', ['custom-01abc']));

    // The receiving device has its own version, renamed.
    const mine = (await exerciseRepo.all()).find((e) => e.slug === 'custom-01abc')!;
    await exerciseRepo.update(mine.id, { name: 'What I call it' });

    const result = await importWorkout(file);

    expect(result.exercisesAdded).toBe(0);
    const after = (await exerciseRepo.all()).filter((e) => e.slug === 'custom-01abc');
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe('What I call it');
  });

  /* Importing must never be a way to lose something you already had. */
  it('takes a new name rather than treading on one in use', async () => {
    const file = await buildWorkoutFile(await seedTemplate('Cindy', ['push-up']));

    const result = await importWorkout(file);

    expect(result.renamedTo).toBe('Cindy (2)');
    expect((await templateRepo.all()).map((t) => t.name).sort()).toEqual(['Cindy', 'Cindy (2)']);
  });

  it('says nothing about renaming when the name was free', async () => {
    const file = await buildWorkoutFile(await seedTemplate('Cindy', ['push-up']));
    await db.templates.clear();

    expect((await importWorkout(file)).renamedTo).toBeUndefined();
  });

  it('imports as yours, so it can be edited and deleted', async () => {
    const file = await buildWorkoutFile(await seedTemplate('Cindy', ['push-up']));
    await db.templates.clear();

    expect((await importWorkout(file)).template.isCustom).toBe(true);
  });
});

describe('a plan, exported', () => {
  it('stores its sessions as offsets from day one, not as dates', async () => {
    const plan = await seedPlan();
    await seedPlanSessions(plan.id, [
      { date: '2026-03-02', slugs: ['push-up'] },
      { date: '2026-03-04', slugs: ['air-squat'] },
      { date: '2026-03-09', slugs: ['push-up'] },
    ]);

    const file = await buildPlanFile(plan);

    expect(file.plan?.sessions.map((s) => s.dayOffset)).toEqual([0, 2, 7]);
  });

  /* Sharing a race block should not tell everyone when you are racing. */
  it('leaves your race date out of it', async () => {
    const plan = await seedPlan();
    await seedPlanSessions(plan.id, [{ date: '2026-03-02', slugs: ['push-up'] }]);

    const file = await buildPlanFile(plan);

    expect(file.plan?.goal.eventDate).toBeUndefined();
    expect(JSON.stringify(file)).not.toContain('2026-12-01');
  });

  it('drops provenance that points at a template on this device', async () => {
    const plan = await seedPlan();
    await seedPlanSessions(plan.id, [{ date: '2026-03-02', slugs: ['push-up'] }]);

    expect(JSON.stringify(await buildPlanFile(plan))).not.toContain('local-template-id');
  });

  it('reports how many weeks it runs for', async () => {
    const plan = await seedPlan();
    await seedPlanSessions(plan.id, [
      { date: '2026-03-02', slugs: ['push-up'] },
      { date: '2026-03-16', slugs: ['push-up'] },
    ]);

    expect((await buildPlanFile(plan)).plan?.weeks).toBe(3);
  });
});

describe('a plan, imported', () => {
  const exported = async () => {
    const plan = await seedPlan();
    await seedPlanSessions(plan.id, [
      { date: '2026-03-02', slugs: ['push-up'] },
      { date: '2026-03-04', slugs: ['air-squat'] },
    ]);
    const file = await buildPlanFile(plan);
    await Promise.all([db.plans.clear(), db.plannedSessions.clear()]);
    return file;
  };

  it('lands the offsets against a start date you choose', async () => {
    const result = await importPlan(await exported(), '2026-06-01');

    const dates = (await db.plannedSessions.toArray()).map((s) => s.date).sort();
    expect(dates).toEqual(['2026-06-01', '2026-06-03']);
    expect(result.sessions).toBe(2);
  });

  it('sets the end date from the last session', async () => {
    const result = await importPlan(await exported(), '2026-06-01');
    expect(result.plan.endDate).toBe('2026-06-03');
  });

  /**
   * Opening a file someone sent you is not a decision to abandon the plan you are running.
   */
  it('arrives switched off, so it cannot silently retire the plan you are following', async () => {
    const file = await exported();
    const running = await seedPlan({ name: 'What I am doing', isActive: true });

    const result = await importPlan(file, '2026-06-01');

    expect(result.plan.isActive).toBe(false);
    expect((await planRepo.all()).find((p) => p.id === running.id)?.isActive).toBe(true);
  });

  it('takes a new name rather than treading on one in use', async () => {
    const file = await exported();
    await seedPlan({ name: 'Eight Week Base' });

    expect((await importPlan(file, '2026-06-01')).renamedTo).toBe('Eight Week Base (2)');
  });
});

describe('files that should be refused', () => {
  const refuses = (json: string) => expect(() => parseShareFile(json)).toThrow(ShareFileError);

  it('refuses something that is not JSON', () => refuses('not json at all'));
  it('refuses JSON from somewhere else', () => refuses(JSON.stringify({ app: 'other' })));
  it('refuses a file with neither a workout nor a plan', () =>
    refuses(JSON.stringify({ app: 'forge', format: 1, kind: 'something' })));
  it('refuses a workout file with no workout in it', () =>
    refuses(JSON.stringify({ app: 'forge', format: 1, kind: 'workout' })));

  it('refuses a file from a newer version rather than guessing at it', () =>
    refuses(JSON.stringify({ app: 'forge', format: 99, kind: 'workout', workout: { name: 'x', blocks: [] } })));

  it('accepts a valid file with no custom movements listed', () => {
    const file = parseShareFile(
      JSON.stringify({ app: 'forge', format: 1, kind: 'workout', workout: { name: 'x', blocks: [] } }),
    );
    expect(file.exercises).toEqual([]);
  });
});

describe('what an import would do, before it does it', () => {
  it('names the movements that would be created', async () => {
    await exerciseRepo.create(exercise('custom-01abc', true) as never);
    const file = await buildWorkoutFile(await seedTemplate('My thing', ['custom-01abc', 'push-up']));
    await db.exercises.where('slug').equals('custom-01abc').delete();

    const preview = await previewShareFile(file);

    expect(preview.newExercises.map((e) => e.slug)).toEqual(['custom-01abc']);
    // Named, not slugged — a ulid in a list of what you are about to import says nothing.
    expect(preview.movements).toEqual(['custom 01abc', 'push up']);
  });

  it('says which deleted movements would come back', async () => {
    const mine = await exerciseRepo.create(exercise('custom-01abc', true) as never);
    const file = await buildWorkoutFile(await seedTemplate('My thing', ['custom-01abc']));
    await exerciseRepo.remove(mine.id);

    const preview = await previewShareFile(file);

    expect(preview.restoredExercises.map((e) => e.slug)).toEqual(['custom-01abc']);
    expect(preview.newExercises).toEqual([]);
  });

  it('reports nothing new when the library already has everything', async () => {
    const file = await buildWorkoutFile(await seedTemplate('Cindy', ['push-up']));
    expect((await previewShareFile(file)).newExercises).toEqual([]);
  });

  /* Only reachable by hand-editing a file, and better named than silently logged empty. */
  it('flags a movement the file references but does not carry', async () => {
    const file = parseShareFile(
      JSON.stringify({
        app: 'forge',
        format: 1,
        kind: 'workout',
        workout: { name: 'Broken', blocks: [block(['nothing-like-this'])] },
        exercises: [],
      }),
    );

    expect((await previewShareFile(file)).missing).toEqual(['nothing-like-this']);
  });

  it('names movements from the library when it has them', async () => {
    const file = await buildWorkoutFile(await seedTemplate('Cindy', ['push-up', 'air-squat']));
    expect((await previewShareFile(file)).movements).toEqual(['push up', 'air squat']);
  });

  it('falls back to the slug only when nothing can name it', async () => {
    const file = parseShareFile(
      JSON.stringify({
        app: 'forge',
        format: 1,
        kind: 'workout',
        workout: { name: 'Broken', blocks: [block(['nothing-like-this'])] },
        exercises: [],
      }),
    );
    expect((await previewShareFile(file)).movements).toEqual(['nothing-like-this']);
  });

  it('counts the sessions and weeks in a plan', async () => {
    const plan = await seedPlan();
    await seedPlanSessions(plan.id, [
      { date: '2026-03-02', slugs: ['push-up'] },
      { date: '2026-03-09', slugs: ['push-up'] },
    ]);

    const preview = await previewShareFile(await buildPlanFile(plan));

    expect(preview).toMatchObject({ kind: 'plan', sessionCount: 2, weeks: 2 });
  });
});

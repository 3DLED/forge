/**
 * Plan progress, against a real Dexie.
 *
 * The distinction these cover is the one the screen used to get wrong: how far through a plan
 * you are, and how much of what was due you actually did, are different numbers. Showing
 * either where the other belongs is how "40% done" ends up meaning "you have missed most of
 * this" without saying so.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { applyPlan, planProgress } from './plans';
import { planRepo } from './repos';
import { todayKey } from '../domain/dates';
import type { PlannedStatus } from '../domain/types';

const TODAY = todayKey();
const shiftDays = (days: number): string => {
  const date = new Date(`${TODAY}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

let counter = 0;
async function seed(
  rows: { offset: number; status: PlannedStatus; planId?: string }[],
): Promise<void> {
  for (const row of rows) {
    counter += 1;
    await db.plannedSessions.put({
      id: `P${counter}`,
      planId: row.planId ?? 'plan-1',
      date: shiftDays(row.offset),
      status: row.status,
      prescription: { name: 'Session', modalities: ['strength'], blocks: [] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as never);
  }
}

beforeEach(async () => {
  await db.plannedSessions.clear();
  counter = 0;
});

describe('an untouched plan', () => {
  it('is nought per cent done', async () => {
    await seed([
      { offset: 1, status: 'planned' },
      { offset: 2, status: 'planned' },
    ]);

    const progress = await planProgress('plan-1');
    expect(progress).toMatchObject({ total: 2, completed: 0, ratio: 0 });
  });

  /* Nothing due yet is not nought per cent adherence — it is no answer at all. */
  it('reports no adherence before anything is due', async () => {
    await seed([{ offset: 3, status: 'planned' }]);

    expect((await planProgress('plan-1')).adherence).toBeNull();
  });

  /* An empty plan has nothing to be done, which is not the same as nothing done. */
  it('does not call an empty plan nought per cent done', async () => {
    expect(await planProgress('plan-1')).toMatchObject({ total: 0, ratio: 0, adherence: null });
  });
});

describe('progress against adherence', () => {
  /**
   * The case that motivated splitting them. Two of ten sessions done, both of the two that
   * were due: a fifth of the way through the plan, and perfectly on top of it.
   */
  it('separates how far through you are from how well you have kept up', async () => {
    await seed([
      { offset: -2, status: 'completed' },
      { offset: -1, status: 'completed' },
      ...Array.from({ length: 8 }, (_, i) => ({ offset: i + 1, status: 'planned' as const })),
    ]);

    const progress = await planProgress('plan-1');

    expect(progress.ratio).toBeCloseTo(0.2);
    expect(progress.adherence).toBe(1);
  });

  it('counts a missed session against adherence but not against progress', async () => {
    await seed([
      { offset: -2, status: 'completed' },
      { offset: -1, status: 'skipped' },
      { offset: 1, status: 'planned' },
      { offset: 2, status: 'planned' },
    ]);

    const progress = await planProgress('plan-1');

    expect(progress.ratio).toBeCloseTo(0.25);
    expect(progress.adherence).toBeCloseTo(0.5);
    expect(progress.skipped).toBe(1);
  });

  it('counts today as due', async () => {
    await seed([{ offset: 0, status: 'completed' }]);

    expect((await planProgress('plan-1')).due).toBe(1);
  });

  it('reaches a hundred per cent when everything is done', async () => {
    await seed([
      { offset: -2, status: 'completed' },
      { offset: -1, status: 'completed' },
    ]);

    expect((await planProgress('plan-1')).ratio).toBe(1);
  });
});

describe('what belongs to the plan', () => {
  /* Counted by plan, not by date window — paging the calendar must not move the number. */
  it('ignores sessions belonging to another plan', async () => {
    await seed([
      { offset: -1, status: 'completed' },
      { offset: -1, status: 'completed', planId: 'plan-2' },
      { offset: 1, status: 'planned', planId: 'plan-2' },
    ]);

    expect(await planProgress('plan-1')).toMatchObject({ total: 1, completed: 1, ratio: 1 });
  });

  it('ignores deleted sessions', async () => {
    await seed([
      { offset: -1, status: 'completed' },
      { offset: 1, status: 'planned' },
    ]);
    await db.plannedSessions.update('P2', { deletedAt: '2026-01-02T00:00:00.000Z' });

    expect(await planProgress('plan-1')).toMatchObject({ total: 1, ratio: 1 });
  });

  /* A session moved past the plan's original end date is still part of the plan. */
  it('counts a session moved outside the original window', async () => {
    await seed([
      { offset: -1, status: 'completed' },
      { offset: 400, status: 'planned' },
    ]);

    expect((await planProgress('plan-1')).total).toBe(2);
  });

  it('adds up: completed plus skipped plus remaining is the total', async () => {
    await seed([
      { offset: -2, status: 'completed' },
      { offset: -1, status: 'skipped' },
      { offset: 1, status: 'planned' },
    ]);

    const p = await planProgress('plan-1');
    expect(p.completed + p.skipped + p.remaining).toBe(p.total);
  });
});

/**
 * Clearing a range replaces whatever was in it.
 *
 * Sessions and plans are separate records, so clearing sessions used to leave the plan behind
 * as an active card at nought per cent with nothing scheduled under it — following something
 * that is no longer there.
 */
describe('applying a plan over the top of another', () => {
  const emptyGenerated = (endDate: string) => ({
    sessions: [],
    conflicts: [],
    substitutions: [],
    unavailable: [],
    weeks: 1,
    endDate,
  });

  const template = {
    slug: 'x',
    name: 'Replacement',
    description: '',
    goal: 'general' as const,
    weeks: 1,
    daysPerWeek: 1,
    slots: [],
    tags: [],
  };

  beforeEach(async () => {
    await db.plans.clear();
  });

  it('stops following a plan whose sessions were all cleared', async () => {
    const old = await planRepo.create({
      name: 'Outgoing',
      goal: { kind: 'general', label: 'Outgoing' },
      startDate: shiftDays(0),
      endDate: shiftDays(6),
      phases: [],
      daysPerWeek: 1,
      isActive: true,
    } as never);
    await seed([{ offset: 1, status: 'planned', planId: old.id }]);

    await applyPlan({
      template,
      generated: emptyGenerated(shiftDays(6)),
      startDate: shiftDays(0),
      replaceExisting: true,
    });

    expect((await planRepo.get(old.id))?.isActive).toBe(false);
  });

  /* A plan with weeks left outside the cleared range is still one you are following. */
  it('keeps following a plan that still has sessions of its own', async () => {
    const other = await planRepo.create({
      name: 'Ongoing',
      goal: { kind: 'general', label: 'Ongoing' },
      startDate: shiftDays(0),
      endDate: shiftDays(60),
      phases: [],
      daysPerWeek: 1,
      isActive: true,
    } as never);
    await seed([
      { offset: 1, status: 'planned', planId: other.id },
      { offset: 40, status: 'planned', planId: other.id },
    ]);

    await applyPlan({
      template,
      generated: emptyGenerated(shiftDays(6)),
      startDate: shiftDays(0),
      replaceExisting: true,
    });

    expect((await planRepo.get(other.id))?.isActive).toBe(true);
  });

  /* The default, and the whole point of stacking: adding a plan disturbs nothing. */
  it('leaves everything alone when not asked to clear', async () => {
    const other = await planRepo.create({
      name: 'Ongoing',
      goal: { kind: 'general', label: 'Ongoing' },
      startDate: shiftDays(0),
      endDate: shiftDays(6),
      phases: [],
      daysPerWeek: 1,
      isActive: true,
    } as never);
    await seed([{ offset: 1, status: 'planned', planId: other.id }]);

    await applyPlan({
      template,
      generated: emptyGenerated(shiftDays(6)),
      startDate: shiftDays(0),
    });

    expect((await planRepo.get(other.id))?.isActive).toBe(true);
    expect(await planProgress(other.id)).toMatchObject({ total: 1 });
  });
});

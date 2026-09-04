/**
 * Writing plans to the database.
 *
 * One plan is active at a time. Blending running and lifting is handled *inside* a plan by
 * the hybrid templates, not by stacking two plans on the same calendar — two independent
 * programs both claiming Tuesday is how people end up doing neither.
 */

import { db } from '../db/db';
import { calendarExceptionRepo, planRepo, plannedSessionRepo } from './repos';
import type { GeneratedPlan } from '../domain/planning';
import type { SeedPlanTemplate } from './seed/planTemplates';
import { daysBetween, todayKey } from '../domain/dates';
import { ulid } from '../domain/ids';
import { TEST_DAY_MARKER } from '../domain/fitnessTests';
import type {
  CalendarException,
  DayKey,
  Goal,
  Id,
  Modality,
  Plan,
  PlanPhase,
  PlannedSession,
} from '../domain/types';
import type { ReshufflePlan } from '../domain/reshuffle';

/**
 * Every plan you are currently following.
 *
 * Plural since a strength block and a running block are a normal pair to run together, and
 * one of them having to stop for the other to start was an artificial choice. Ordered oldest
 * first so the list does not reshuffle when one is edited.
 */
export async function activePlans(): Promise<Plan[]> {
  const plans = await planRepo.all();
  return plans.filter((p) => p.isActive).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function activePlan(): Promise<Plan | undefined> {
  const plans = await planRepo.all();
  return plans.find((p) => p.isActive);
}

export async function allPlans(): Promise<Plan[]> {
  return (await planRepo.all()).sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function calendarExceptions(): Promise<CalendarException[]> {
  return (await calendarExceptionRepo.all()).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Describes the plan's shape for the plan detail screen. */
function phasesFor(template: SeedPlanTemplate, weeks: number): PlanPhase[] {
  const phases: PlanPhase[] = [];

  if (template.taperWeeks) {
    phases.push({
      id: ulid(),
      name: 'Build',
      weeks: weeks - template.taperWeeks,
      focus: 'Progressive volume with a down week every fourth',
      deloadEvery: template.deloadEvery,
    });
    phases.push({
      id: ulid(),
      name: 'Taper',
      weeks: template.taperWeeks,
      focus: 'Volume drops, intensity holds, you arrive fresh',
    });
  } else {
    phases.push({
      id: ulid(),
      name: 'Ongoing',
      weeks,
      focus: template.deloadEvery
        ? `Continuous, with a deload every ${template.deloadEvery} weeks`
        : 'Continuous',
      deloadEvery: template.deloadEvery,
    });
  }

  return phases;
}

/**
 * Removes future *unstarted* sessions in a range. Completed and skipped ones stay: they are
 * the record of what actually happened, and adherence is meaningless without them.
 */
export async function clearPlannedRange(from: DayKey, to: DayKey): Promise<number> {
  const rows = await db.plannedSessions.where('date').between(from, to, true, true).toArray();
  const removable = rows.filter((s) => !s.deletedAt && s.status === 'planned');
  for (const session of removable) await plannedSessionRepo.remove(session.id);
  return removable.length;
}

export interface ApplyPlanOptions {
  template: SeedPlanTemplate;
  generated: GeneratedPlan;
  startDate: DayKey;
  eventDate?: DayKey;
  goalLabel?: string;
  equipmentProfileId?: Id;
  /** Wipe existing unstarted sessions in the plan's date range first. */
  replaceExisting?: boolean;
  /**
   * Bookend the plan with testing days, so the finish can be compared to the start.
   *
   * Opt-in: a maximal test is a session in its own right, and a plan that opens by demanding
   * one from someone who just wanted to start training is a plan they abandon on day one.
   */
  includeTests?: boolean;
  /** Movements the testing days measure, worked out by the caller from the plan itself. */
  testMovements?: string[];
}

export async function applyPlan(options: ApplyPlanOptions): Promise<Plan> {
  const { template, generated } = options;

  /*
   * Other plans are left running. Two plans are a normal thing to want — three strength days
   * and four runs is seven sessions, not a choice between them — and the placement spreads
   * them across the week before it doubles anything up.
   */
  if (options.replaceExisting) {
    await clearPlannedRange(options.startDate, generated.endDate);
    await retireEmptyPlans();
  }

  const goal: Goal = {
    kind: template.goal,
    label: options.goalLabel ?? template.name,
    eventDate: options.eventDate,
  };

  const plan = await planRepo.create({
    name: template.name,
    goal,
    startDate: options.startDate,
    endDate: generated.endDate,
    phases: phasesFor(template, generated.weeks),
    daysPerWeek: template.daysPerWeek,
    equipmentProfileId: options.equipmentProfileId,
    isActive: true,
    notes: template.description,
  });

  for (const session of generated.sessions) {
    await plannedSessionRepo.create({
      date: session.date,
      planId: plan.id,
      prescription: session.prescription,
      status: 'planned',
      } as Omit<PlannedSession, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>);
  }

  if (options.includeTests && (options.testMovements?.length ?? 0) > 0) {
    await addTestDays(plan.id, options.startDate, generated.endDate, options.testMovements!);
  }

  return plan;
}

/**
 * A testing day at each end of the plan.
 *
 * Placed on the start and end dates themselves rather than fitted around the week's training:
 * the whole value is that the two are the same test under the same conditions, and a test that
 * drifts to whichever day was free is not that.
 */
async function addTestDays(
  planId: Id,
  startDate: DayKey,
  endDate: DayKey,
  movements: string[],
): Promise<void> {
  const prescription = {
    name: 'Benchmark tests',
    modalities: ['strength'] as Modality[],
    estimatedMinutes: 20 + movements.length * 20,
    sourceTemplateId: TEST_DAY_MARKER,
    blocks: [
      {
        id: ulid(),
        style: 'straight' as const,
        label: 'Measure',
        items: movements.map((slug) => ({
          id: ulid(),
          exerciseSlug: slug,
          load: { kind: 'unspecified' } as const,
          notes: 'Run this from Tests so the protocol is the same both times.',
        })),
      },
    ],
  };

  for (const date of [startDate, endDate]) {
    await plannedSessionRepo.create({
      date,
      planId,
      prescription,
      status: 'planned',
    } as Omit<PlannedSession, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>);
  }
}

/**
 * Where a plan stands today, in words.
 *
 * Shared by the calendar card and the plan sheet so the two cannot disagree. A plan starting
 * next month has not started, and calling that "week 1 of 12" reads as though you are already
 * behind on something you have not begun.
 */
export function planWeekLabel(plan: Plan, today: DayKey): string {
  const daysUntilStart = daysBetween(today, plan.startDate);
  if (daysUntilStart > 0) {
    return `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}`;
  }

  const totalWeeks = plan.endDate
    ? Math.ceil((daysBetween(plan.startDate, plan.endDate) + 1) / 7)
    : null;
  const week = Math.floor(daysBetween(plan.startDate, today) / 7) + 1;

  if (totalWeeks && week > totalWeeks) return 'Finished';
  return totalWeeks ? `Week ${week} of ${totalWeeks}` : `Week ${week}`;
}

/**
 * How far through a plan you are, counted over the whole thing.
 *
 * Two questions, and they are not the same one. `ratio` is how much of the whole plan is
 * behind you — what a percentage next to "week 3 of 12" is read as meaning. `adherence` is
 * how much of what was due you actually did, which is the stricter and more uncomfortable
 * question: you can be part-way through a plan having missed most of it. The calendar shows
 * the first; the plan sheet shows both, labelled, because either alone gets mistaken for
 * the other.
 *
 * Counted by `planId` rather than by date range, so it does not change as you page the
 * calendar around, and sessions moved outside the original window still belong to it.
 */
export async function planProgress(planId: Id): Promise<{
  total: number;
  completed: number;
  skipped: number;
  remaining: number;
  /** Sessions dated today or earlier — the denominator adherence uses. */
  due: number;
  /** Of what was due, how much was done. Null before anything is due. */
  adherence: number | null;
  /** Of the whole plan, how much is done. */
  ratio: number;
}> {
  const rows = (await db.plannedSessions.where('planId').equals(planId).toArray()).filter(
    (session) => !session.deletedAt,
  );

  const today = todayKey();
  const completed = rows.filter((s) => s.status === 'completed').length;
  const skipped = rows.filter((s) => s.status === 'skipped').length;
  const due = rows.filter((s) => s.date <= today).length;

  return {
    total: rows.length,
    completed,
    skipped,
    remaining: rows.length - completed - skipped,
    due,
    adherence: due > 0 ? completed / due : null,
    // An empty plan is not nought per cent done; it has nothing to be done.
    ratio: rows.length > 0 ? completed / rows.length : 0,
  };
}

/**
 * Stops following any plan that has nothing left to do.
 *
 * Run after a range is cleared. Clearing removes sessions, not plans, which used to leave a
 * plan sitting on the calendar as an active card at nought per cent with an empty schedule
 * behind it — following something that is no longer there. If you cleared everything a plan
 * had, you replaced it, and the card should say so by going away.
 *
 * Only plans with nothing still planned. One part-way through, whose remaining weeks happened
 * to fall outside the cleared range, is still a plan you are following.
 */
async function retireEmptyPlans(): Promise<void> {
  const rows = (await db.plannedSessions.toArray()).filter((s) => !s.deletedAt);
  const stillPlanned = new Set(
    rows.filter((s) => s.status === 'planned').map((s) => s.planId).filter(Boolean),
  );

  for (const plan of await planRepo.all()) {
    if (plan.isActive && !stillPlanned.has(plan.id)) {
      await planRepo.update(plan.id, { isActive: false });
    }
  }
}

/** Ends a plan and clears its remaining unstarted sessions from today forward. */
export async function endPlan(plan: Plan): Promise<number> {
  await planRepo.update(plan.id, { isActive: false });

  const rows = await db.plannedSessions.where('planId').equals(plan.id).toArray();
  const upcoming = rows.filter(
    (s) => !s.deletedAt && s.status === 'planned' && s.date >= todayKey(),
  );
  for (const session of upcoming) await plannedSessionRepo.remove(session.id);
  return upcoming.length;
}

/**
 * Commits a reshuffle: moved sessions get their new date, dropped ones are removed.
 *
 * Deletes are soft, like every other delete here, so a dropped session is recoverable from
 * the record rather than gone. Returns what it did, because the caller says so out loud.
 */
export async function applyReshuffle(plan: ReshufflePlan): Promise<{ moved: number; dropped: number }> {
  for (const move of plan.moves) {
    await plannedSessionRepo.update(move.session.id, { date: move.to });
  }
  for (const drop of plan.drops) {
    await plannedSessionRepo.remove(drop.session.id);
  }
  return { moved: plan.moves.length, dropped: plan.drops.length };
}

export async function movePlannedSession(session: PlannedSession, to: DayKey): Promise<void> {
  await plannedSessionRepo.update(session.id, { date: to });
}

export async function skipPlannedSession(session: PlannedSession): Promise<void> {
  await plannedSessionRepo.update(session.id, { status: 'skipped' });
}

export async function unskipPlannedSession(session: PlannedSession): Promise<void> {
  await plannedSessionRepo.update(session.id, { status: 'planned' });
}

export async function addBlackout(
  startDate: DayKey,
  endDate: DayKey,
  reason?: string,
): Promise<CalendarException> {
  return calendarExceptionRepo.create({ startDate, endDate, kind: 'blackout', reason });
}


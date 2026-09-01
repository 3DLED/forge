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
import { todayKey } from '../domain/dates';
import { ulid } from '../domain/ids';
import type {
  CalendarException,
  DayKey,
  Goal,
  Id,
  Plan,
  PlanPhase,
  PlannedSession,
} from '../domain/types';
import type { ReshufflePlan } from '../domain/reshuffle';

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
}

export async function applyPlan(options: ApplyPlanOptions): Promise<Plan> {
  const { template, generated } = options;

  // One active plan at a time.
  for (const plan of await planRepo.all()) {
    if (plan.isActive) await planRepo.update(plan.id, { isActive: false });
  }

  if (options.replaceExisting) {
    await clearPlannedRange(options.startDate, generated.endDate);
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

  return plan;
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

/**
 * Adherence over a window: how much of what was planned actually happened. The number that
 * tells you whether the plan is working or whether the plan is fiction.
 */
export async function planAdherence(
  from: DayKey,
  to: DayKey,
): Promise<{ planned: number; completed: number; skipped: number; ratio: number | null }> {
  const rows = (await db.plannedSessions.where('date').between(from, to, true, true).toArray())
    .filter((s) => !s.deletedAt);

  const completed = rows.filter((s) => s.status === 'completed').length;
  const skipped = rows.filter((s) => s.status === 'skipped').length;
  const due = rows.filter((s) => s.date <= todayKey()).length;

  return {
    planned: rows.length,
    completed,
    skipped,
    ratio: due > 0 ? completed / due : null,
  };
}

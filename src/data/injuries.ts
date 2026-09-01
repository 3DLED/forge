/**
 * Reading and writing the injury log.
 *
 * The only thing here with any weight to it is that logging an injury and standing sessions
 * down are one action. Recording that your shoulder hurts and then separately going through
 * the calendar marking upper-body days as skipped is the app watching you do its job.
 */

import { db } from '../db/db';
import { injuryRepo, plannedSessionRepo } from './repos';
import { todayKey } from '../domain/dates';
import { planRest, recoverable } from '../domain/injuries';
import type { Injury } from '../domain/injuries';
import type { DayKey, Exercise, Id, PlannedSession } from '../domain/types';

export async function allInjuries(): Promise<Injury[]> {
  const rows = await db.injuries.toArray();
  return rows
    .filter((row) => !(row as { deletedAt?: string }).deletedAt)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/** Planned sessions an injury's rest window covers, for previewing and for skipping. */
async function sessionsInWindow(injury: Injury, from: DayKey): Promise<PlannedSession[]> {
  const rows = await db.plannedSessions
    .where('date')
    .between(from, injury.restUntil, true, true)
    .toArray();
  return rows.filter((row) => !row.deletedAt);
}

/**
 * What logging this injury would stand down, without writing anything.
 *
 * Separate from the write so the sheet can show it first. Standing down a week of training is
 * not something to discover after the fact.
 */
export async function previewRest(
  injury: Injury,
  exerciseBySlug: Map<string, Exercise>,
  from: DayKey = todayKey(),
) {
  return planRest({
    injury,
    sessions: await sessionsInWindow(injury, from),
    exerciseBySlug,
    from,
  });
}

/**
 * Records the injury and stands down the sessions that load the area.
 *
 * Sessions are marked skipped rather than removed: skipped is already the status meaning "this
 * was planned and did not happen", it keeps adherence honest, and — the point here — it is the
 * status that can be taken back if you heal early.
 */
export async function logInjury(
  draft: Omit<Injury, 'id'>,
  exerciseBySlug: Map<string, Exercise>,
  from: DayKey = todayKey(),
): Promise<{ injury: Injury; skipped: number }> {
  const injury = (await injuryRepo.create(draft as never)) as unknown as Injury;

  const rest = planRest({
    injury,
    sessions: await sessionsInWindow(injury, from),
    exerciseBySlug,
    from,
  });

  for (const entry of rest.affected) {
    await plannedSessionRepo.update(entry.session.id, { status: 'skipped' });
  }

  return { injury, skipped: rest.affected.length };
}

/** Sessions stood down by this injury that could still be picked back up. */
export async function recoverableSessions(
  injury: Injury,
  from: DayKey = todayKey(),
): Promise<PlannedSession[]> {
  const rows = await db.plannedSessions
    .where('date')
    .between(from, injury.restUntil, true, true)
    .toArray();
  return recoverable(
    rows.filter((row) => !row.deletedAt),
    from,
  );
}

/**
 * Calls the injury healed, and optionally puts the remaining sessions back.
 *
 * Only sessions still ahead of you are restored — see `recoverable`. Putting one back on a day
 * that has already gone would be scheduling work you cannot do.
 */
export async function resolveInjury(
  injury: Injury,
  options: { restoreSessions: boolean } = { restoreSessions: true },
  from: DayKey = todayKey(),
): Promise<{ restored: number }> {
  await injuryRepo.update(injury.id, { resolvedDate: from } as never);

  if (!options.restoreSessions) return { restored: 0 };

  const sessions = await recoverableSessions(injury, from);
  for (const session of sessions) {
    await plannedSessionRepo.update(session.id, { status: 'planned' });
  }
  return { restored: sessions.length };
}

export async function updateInjury(id: Id, patch: Partial<Injury>): Promise<void> {
  await injuryRepo.update(id, patch as never);
}

export async function deleteInjury(id: Id): Promise<void> {
  await injuryRepo.remove(id);
}

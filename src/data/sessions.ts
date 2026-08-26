/**
 * Session queries and the small number of mutations the logger performs.
 *
 * Kept out of the components so the logging screen deals in "add a set" rather than in
 * record shapes, and so every write lands through the repository layer.
 */

import { db, type StoredLoggedSession } from '../db/db';
import { loggedSessionRepo, plannedSessionRepo } from './repos';
import { ulid } from '../domain/ids';
import { todayKey } from '../domain/dates';
import type {
  DayKey,
  Id,
  LoggedSession,
  LoggedSet,
  MetricValues,
  PlannedSession,
  Prescription,
} from '../domain/types';

export async function getSession(id: Id): Promise<LoggedSession | undefined> {
  return loggedSessionRepo.get(id);
}

export async function sessionsOnDay(date: DayKey): Promise<LoggedSession[]> {
  const rows = await db.loggedSessions.where('date').equals(date).toArray();
  return rows.filter((s) => !s.deletedAt);
}

/** Most recent sessions, newest first. */
export async function recentSessions(limit = 30): Promise<LoggedSession[]> {
  const rows = await db.loggedSessions.orderBy('date').reverse().limit(limit * 2).toArray();
  return rows.filter((s) => !s.deletedAt).slice(0, limit);
}

export async function sessionsBetween(from: DayKey, to: DayKey): Promise<LoggedSession[]> {
  const rows = await db.loggedSessions.where('date').between(from, to, true, true).toArray();
  return rows.filter((s) => !s.deletedAt);
}

/** Every session containing a movement, newest first — the exercise history view. */
export async function sessionsWithExercise(slug: string): Promise<LoggedSession[]> {
  const rows = await db.loggedSessions.where('exerciseSlugs').equals(slug).toArray();
  return rows.filter((s) => !s.deletedAt).sort((a, b) => b.date.localeCompare(a.date));
}

export async function plannedOnDay(date: DayKey): Promise<PlannedSession[]> {
  const rows = await db.plannedSessions.where('date').equals(date).toArray();
  return rows.filter((s) => !s.deletedAt);
}

export async function plannedBetween(from: DayKey, to: DayKey): Promise<PlannedSession[]> {
  const rows = await db.plannedSessions.where('date').between(from, to, true, true).toArray();
  return rows.filter((s) => !s.deletedAt);
}

export async function startSession(options: {
  name?: string;
  date?: DayKey;
  plannedSessionId?: Id;
} = {}): Promise<LoggedSession> {
  return loggedSessionRepo.create({
    date: options.date ?? todayKey(),
    name: options.name ?? 'Workout',
    plannedSessionId: options.plannedSessionId,
    startedAt: new Date().toISOString(),
    sets: [],
    exerciseSlugs: [],
  } as Omit<StoredLoggedSession, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>);
}

/**
 * Begin logging against a planned session: the prescription becomes the starting set list,
 * every set unchecked, with the prescribed numbers pre-filled as the targets to beat.
 */
export async function startFromPlanned(planned: PlannedSession): Promise<LoggedSession> {
  const sets = prescriptionToSets(planned.prescription);
  const session = await loggedSessionRepo.create({
    date: planned.date,
    name: planned.prescription.name,
    plannedSessionId: planned.id,
    startedAt: new Date().toISOString(),
    sets,
    exerciseSlugs: [],
  } as Omit<StoredLoggedSession, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>);

  await plannedSessionRepo.update(planned.id, { loggedSessionId: session.id });
  return session;
}

/** Expands a prescription into blank sets, carrying targets through as starting values. */
export function prescriptionToSets(prescription: Prescription): LoggedSet[] {
  const sets: LoggedSet[] = [];

  for (const block of prescription.blocks) {
    // Circuits and intervals repeat their whole item list; straight sets repeat one item.
    const outerRounds = block.style === 'straight' || block.style === 'superset' ? 1 : block.rounds ?? 1;

    for (let round = 0; round < outerRounds; round++) {
      for (const item of block.items) {
        const innerSets = block.style === 'straight' || block.style === 'superset' ? item.sets ?? 1 : 1;

        for (let setIndex = 0; setIndex < innerSets; setIndex++) {
          const values: MetricValues = {};
          if (item.reps != null) values.reps = item.reps;
          else if (item.repRange) values.reps = item.repRange[0];
          if (item.timeSec != null) values.timeSec = item.timeSec;
          if (item.distanceM != null) values.distanceM = item.distanceM;
          if (item.load.kind === 'absolute') values.weightKg = item.load.weightKg;
          if (item.load.kind === 'rpe') values.rpe = item.load.rpe;

          sets.push({
            id: ulid(),
            exerciseSlug: item.exerciseSlug,
            blockId: block.id,
            itemId: item.id,
            setIndex: sets.filter((s) => s.exerciseSlug === item.exerciseSlug).length,
            values,
            completed: false,
          });
        }
      }
    }
  }

  return sets;
}

export async function updateSets(sessionId: Id, sets: LoggedSet[]): Promise<void> {
  await loggedSessionRepo.update(sessionId, { sets });
}

/**
 * Finish a session: stamp the end time, and mark any planned session it came from as done
 * so plan-vs-actual stays honest.
 */
export async function finishSession(
  session: LoggedSession,
  details: { sessionRpe?: number; feel?: LoggedSession['feel']; notes?: string; durationMin?: number },
): Promise<void> {
  await loggedSessionRepo.update(session.id, {
    ...details,
    endedAt: new Date().toISOString(),
  });

  if (session.plannedSessionId) {
    await plannedSessionRepo.update(session.plannedSessionId, {
      status: 'completed',
      loggedSessionId: session.id,
    });
  }
}

export async function deleteSession(session: LoggedSession): Promise<void> {
  await loggedSessionRepo.remove(session.id);
  if (session.plannedSessionId) {
    const planned = await plannedSessionRepo.get(session.plannedSessionId);
    if (planned) {
      await plannedSessionRepo.update(planned.id, {
        status: 'planned',
        loggedSessionId: undefined,
      });
    }
  }
}

/** The last time this movement was trained, for the "last time you did…" prompt. */
export async function lastPerformance(
  slug: string,
  excludeSessionId?: Id,
): Promise<{ session: LoggedSession; sets: LoggedSet[] } | null> {
  const sessions = await sessionsWithExercise(slug);
  for (const session of sessions) {
    if (session.id === excludeSessionId) continue;
    const sets = session.sets.filter((s) => s.exerciseSlug === slug && s.completed);
    if (sets.length > 0) return { session, sets };
  }
  return null;
}

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
  LoggedBlock,
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

/**
 * How often each movement has been logged recently.
 *
 * What you actually train is a far better ordering than any curated list, so this outranks
 * the `common` flag in the picker. Bounded to recent sessions: a movement dropped six months
 * ago should stop floating to the top.
 */
export async function exerciseUsage(sessionLimit = 40): Promise<Map<string, number>> {
  const sessions = await recentSessions(sessionLimit);
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const slug of new Set(session.sets.map((s) => s.exerciseSlug))) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return counts;
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
  const { blocks, sets } = expandPrescription(planned.prescription);
  const session = await loggedSessionRepo.create({
    date: planned.date,
    name: planned.prescription.name,
    plannedSessionId: planned.id,
    startedAt: new Date().toISOString(),
    blocks,
    sets,
    exerciseSlugs: [],
  } as Omit<StoredLoggedSession, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>);

  await plannedSessionRepo.update(planned.id, { loggedSessionId: session.id });
  return session;
}

/** Timed prescription styles become real logged blocks rather than flattened sets. */
const TIMED_STYLES = new Set(['amrap', 'emom', 'forTime']);

export interface ExpandedPrescription {
  blocks: LoggedBlock[];
  sets: LoggedSet[];
}

/**
 * Expands a prescription into what the logger works with: blank sets, plus real blocks for
 * anything timed.
 *
 * A prescribed AMRAP used to be flattened into one set per movement per round, tagged with
 * a block id that referred to nothing — so starting a planned AMRAP produced a pile of loose
 * sets and no clock. Timed styles now materialise as a `LoggedBlock` holding one set per
 * movement: the round's recipe, which is what the block UI and the timer both expect.
 */
export function expandPrescription(prescription: Prescription): ExpandedPrescription {
  const blocks: LoggedBlock[] = [];
  const sets: LoggedSet[] = [];

  const nextIndex = (slug: string) => sets.filter((s) => s.exerciseSlug === slug).length;

  const valuesFor = (item: Prescription['blocks'][number]['items'][number]): MetricValues => {
    const values: MetricValues = {};
    if (item.reps != null) values.reps = item.reps;
    else if (item.repRange) values.reps = item.repRange[0];
    if (item.timeSec != null) values.timeSec = item.timeSec;
    if (item.distanceM != null) values.distanceM = item.distanceM;
    if (item.load.kind === 'absolute') values.weightKg = item.load.weightKg;
    if (item.load.kind === 'rpe') values.rpe = item.load.rpe;
    return values;
  };

  for (const block of prescription.blocks) {
    if (TIMED_STYLES.has(block.style)) {
      const logged: LoggedBlock = {
        id: ulid(),
        style: block.style === 'emom' ? 'emom' : block.style === 'forTime' ? 'forTime' : 'amrap',
        label: block.label ?? prescription.name,
        // Carried through so a planned run of a saved workout joins that workout's history
        // rather than starting a fresh, uncomparable one.
        sourceTemplateId: prescription.sourceTemplateId,
        capSec: block.capSec,
        intervalSec: block.style === 'emom' ? block.restSec ?? 60 : undefined,
        targetRounds: block.style === 'emom' ? block.rounds ?? 10 : undefined,
      };
      blocks.push(logged);

      for (const item of block.items) {
        sets.push({
          id: ulid(),
          exerciseSlug: item.exerciseSlug,
          blockId: logged.id,
          itemId: item.id,
          setIndex: nextIndex(item.exerciseSlug),
          values: valuesFor(item),
          completed: false,
        });
      }
      continue;
    }

    // Circuits and intervals repeat their whole item list; straight sets repeat one item.
    const outerRounds = block.style === 'straight' || block.style === 'superset' ? 1 : block.rounds ?? 1;

    for (let round = 0; round < outerRounds; round++) {
      for (const item of block.items) {
        const innerSets = block.style === 'straight' || block.style === 'superset' ? item.sets ?? 1 : 1;

        for (let setIndex = 0; setIndex < innerSets; setIndex++) {
          sets.push({
            id: ulid(),
            exerciseSlug: item.exerciseSlug,
            itemId: item.id,
            setIndex: nextIndex(item.exerciseSlug),
            values: valuesFor(item),
            completed: false,
          });
        }
      }
    }
  }

  return { blocks, sets };
}

export async function updateSets(sessionId: Id, sets: LoggedSet[]): Promise<void> {
  await loggedSessionRepo.update(sessionId, { sets });
}

// --- timed blocks ---------------------------------------------------------

export async function addBlock(
  session: LoggedSession,
  block: Omit<LoggedBlock, 'id'>,
): Promise<LoggedBlock> {
  const created: LoggedBlock = { ...block, id: ulid() };
  await loggedSessionRepo.update(session.id, {
    blocks: [...(session.blocks ?? []), created],
  });
  return created;
}

export async function updateBlock(
  session: LoggedSession,
  blockId: Id,
  patch: Partial<Omit<LoggedBlock, 'id'>>,
): Promise<void> {
  await loggedSessionRepo.update(session.id, {
    blocks: (session.blocks ?? []).map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
  });
}

/**
 * Removes the block but keeps its movements, detaching them back into the flat list.
 * Deleting the container should not delete the work recorded inside it.
 */
export async function removeBlock(session: LoggedSession, blockId: Id): Promise<void> {
  await loggedSessionRepo.update(session.id, {
    blocks: (session.blocks ?? []).filter((b) => b.id !== blockId),
    sets: session.sets.map((set) =>
      set.blockId === blockId ? { ...set, blockId: undefined } : set,
    ),
  });
}

/**
 * Turns the whole workout into one timed block: every movement already logged becomes part
 * of a round. Deliberately non-destructive — sets are re-parented, never dropped — so
 * converting a session you have been building is always undoable by removing the block.
 */
export async function convertSessionToBlock(
  session: LoggedSession,
  block: Omit<LoggedBlock, 'id'>,
): Promise<LoggedBlock> {
  const created: LoggedBlock = { ...block, id: ulid() };
  await loggedSessionRepo.update(session.id, {
    blocks: [...(session.blocks ?? []), created],
    sets: session.sets.map((set) => (set.blockId ? set : { ...set, blockId: created.id })),
  });
  return created;
}

// --- session stopwatch ----------------------------------------------------

/**
 * Elapsed seconds on the session stopwatch: time banked from earlier runs, plus the current
 * run if it is going. Derived rather than stored so it stays right across reloads and sleeps.
 */
export function sessionElapsedSec(session: LoggedSession, now: number = Date.now()): number {
  const banked = session.elapsedSec ?? 0;
  if (!session.runningSince) return banked;
  return banked + Math.max(0, (now - Date.parse(session.runningSince)) / 1000);
}

export function isStopwatchRunning(session: LoggedSession): boolean {
  return Boolean(session.runningSince);
}

export async function startStopwatch(session: LoggedSession): Promise<void> {
  if (session.runningSince) return;
  await loggedSessionRepo.update(session.id, { runningSince: new Date().toISOString() });
}

export async function pauseStopwatch(session: LoggedSession): Promise<void> {
  if (!session.runningSince) return;
  await loggedSessionRepo.update(session.id, {
    elapsedSec: Math.round(sessionElapsedSec(session)),
    runningSince: null,
  });
}

export async function resetStopwatch(session: LoggedSession): Promise<void> {
  await loggedSessionRepo.update(session.id, { elapsedSec: 0, runningSince: null });
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

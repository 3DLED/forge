/**
 * Named workouts — a timed block you can save, run again, and compare against itself.
 *
 * These are stored as ordinary `SessionTemplate` records rather than a new kind of thing.
 * That is not a shortcut: the template table is already what the planner draws from, so a
 * workout you name in the logger becomes something you can drop onto a future date without
 * any extra plumbing. One concept, two entry points.
 *
 * The comparison is the point. "Seven rounds" says nothing on its own — the score depends
 * entirely on what was in the round and how long the clock ran. Results are therefore only
 * ever compared within the same saved workout, never across AMRAPs generally.
 */

import { db } from '../db/db';
import { loggedSessionRepo, templateRepo } from './repos';
import { ulid } from '../domain/ids';
import type {
  Block,
  BlockStyle,
  Exercise,
  Id,
  LoggedBlock,
  LoggedBlockStyle,
  LoggedSession,
  LoggedSet,
  Modality,
  SessionTemplate,
} from '../domain/types';

/** Logged and prescribed styles use the same names for the three timed shapes. */
function toBlockStyle(style: LoggedBlockStyle): BlockStyle {
  return style;
}

function toLoggedStyle(style: BlockStyle): LoggedBlockStyle {
  return style === 'emom' ? 'emom' : style === 'forTime' ? 'forTime' : 'amrap';
}

/** "5 × Pull-Up · 10 × Push-Up · 15 × Air Squat" — the round, in one line. */
export function describeMovements(
  sets: LoggedSet[],
  exerciseBySlug: Map<string, Exercise>,
): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const set of sets) {
    if (seen.has(set.id)) continue;
    seen.add(set.id);
    const name = exerciseBySlug.get(set.exerciseSlug)?.name ?? set.exerciseSlug;
    const reps = set.values.reps;
    const time = set.values.timeSec;
    const distance = set.values.distanceM;
    if (reps) parts.push(`${reps} × ${name}`);
    else if (distance) parts.push(`${distance} m ${name}`);
    else if (time) parts.push(`${time}s ${name}`);
    else parts.push(name);
  }

  return parts.join(' · ');
}

/** The default name offered when saving: the movements themselves. */
export function suggestedName(sets: LoggedSet[], exerciseBySlug: Map<string, Exercise>): string {
  const names = [...new Set(sets.map((s) => exerciseBySlug.get(s.exerciseSlug)?.name ?? s.exerciseSlug))];
  return names.join(' + ');
}

export async function savedWorkouts(): Promise<SessionTemplate[]> {
  const all = await templateRepo.all();
  return all
    .filter((t) => t.isCustom)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Saves a block and its movements as a reusable workout.
 *
 * The movements are snapshotted into the template, so editing the session afterwards does
 * not silently redefine what the saved workout is.
 */
export async function saveBlockAsWorkout(
  name: string,
  block: LoggedBlock,
  sets: LoggedSet[],
  modalities: Modality[] = ['strength'],
): Promise<SessionTemplate> {
  const prescribed: Block = {
    id: ulid(),
    style: toBlockStyle(block.style),
    label: name,
    capSec: block.capSec,
    rounds: block.targetRounds,
    restSec: block.intervalSec,
    items: sets.map((set) => ({
      id: ulid(),
      exerciseSlug: set.exerciseSlug,
      reps: set.values.reps,
      timeSec: set.values.timeSec,
      distanceM: set.values.distanceM,
      load:
        set.values.weightKg != null
          ? ({ kind: 'absolute', weightKg: set.values.weightKg } as const)
          : ({ kind: 'unspecified' } as const),
    })),
  };

  return templateRepo.create({
    name,
    modalities,
    estimatedMinutes: Math.round((block.capSec ?? block.timeSec ?? 600) / 60),
    blocks: [prescribed],
    isCustom: true,
  });
}

export interface WorkoutDraft {
  block: Omit<LoggedBlock, 'id'>;
  /** One entry per movement in a round. */
  items: { exerciseSlug: string; values: LoggedSet['values'] }[];
}

/** Turns a saved workout back into something the logger can drop into a session. */
export function workoutToDraft(template: SessionTemplate): WorkoutDraft | null {
  const source = template.blocks[0];
  if (!source) return null;

  const style = toLoggedStyle(source.style);

  return {
    block: {
      style,
      label: template.name,
      sourceTemplateId: template.id,
      capSec: source.capSec,
      intervalSec: style === 'emom' ? source.restSec ?? 60 : undefined,
      targetRounds: style === 'emom' ? source.rounds ?? 10 : undefined,
    },
    items: source.items.map((item) => ({
      exerciseSlug: item.exerciseSlug,
      values: {
        ...(item.reps != null ? { reps: item.reps } : {}),
        ...(item.timeSec != null ? { timeSec: item.timeSec } : {}),
        ...(item.distanceM != null ? { distanceM: item.distanceM } : {}),
        ...(item.load.kind === 'absolute' ? { weightKg: item.load.weightKg } : {}),
      },
    })),
  };
}

export interface WorkoutResult {
  date: string;
  rounds?: number;
  timeSec?: number;
  sessionId: Id;
}

/**
 * Every previous run of one saved workout, newest first.
 *
 * Matched on `sourceTemplateId` rather than on the name, so renaming a workout keeps its
 * history attached instead of silently starting a new one.
 */
export async function workoutHistory(templateId: Id, limit = 20): Promise<WorkoutResult[]> {
  const sessions = (await db.loggedSessions.toArray()).filter(
    (s) => !s.deletedAt && (s.blocks ?? []).some((b) => b.sourceTemplateId === templateId),
  );

  const results: WorkoutResult[] = [];
  for (const session of sessions) {
    for (const block of session.blocks ?? []) {
      if (block.sourceTemplateId !== templateId) continue;
      if (block.timeSec == null && block.rounds == null) continue;
      results.push({
        date: session.date,
        rounds: block.rounds,
        timeSec: block.timeSec,
        sessionId: session.id,
      });
    }
  }

  return results.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

/** Attaches a name (and optionally a saved-workout link) to a block already in a session. */
export async function nameBlock(
  session: LoggedSession,
  blockId: Id,
  label: string,
  sourceTemplateId?: Id,
): Promise<void> {
  await loggedSessionRepo.update(session.id, {
    blocks: (session.blocks ?? []).map((b) =>
      b.id === blockId ? { ...b, label, ...(sourceTemplateId ? { sourceTemplateId } : {}) } : b,
    ),
  });
}

export async function deleteSavedWorkout(id: Id): Promise<void> {
  await templateRepo.remove(id);
}

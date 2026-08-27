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
import { expandPrescription } from './sessions';
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

/**
 * Timed pieces and whole sessions are both saved here, and they are not interchangeable.
 *
 * A saved AMRAP goes back into a session as a block with a clock; a saved session goes back
 * as loose sets. Offering one where the other belongs produces a straight workout wearing an
 * AMRAP's timer, so every list of saved workouts filters on this.
 */
export function isTimedWorkout(template: SessionTemplate): boolean {
  const style = template.blocks[0]?.style;
  return style === 'amrap' || style === 'emom' || style === 'forTime';
}

/**
 * Saves the loose part of a session — a whole workout's worth of movements and their sets.
 *
 * Sets of the same movement collapse into one prescribed item carrying a count, which is what
 * a template is: "four sets of eight", not four identical records. The numbers come from the
 * first set of each movement, since that is the target the rest were working towards.
 */
export async function saveSessionAsWorkout(
  name: string,
  sets: LoggedSet[],
  modalities: Modality[] = ['strength'],
): Promise<SessionTemplate> {
  const order: string[] = [];
  const bySlug = new Map<string, LoggedSet[]>();

  for (const set of sets) {
    if (set.blockId) continue;
    if (!bySlug.has(set.exerciseSlug)) {
      bySlug.set(set.exerciseSlug, []);
      order.push(set.exerciseSlug);
    }
    bySlug.get(set.exerciseSlug)!.push(set);
  }

  const block: Block = {
    id: ulid(),
    style: 'straight',
    label: name,
    items: order.map((slug) => {
      const group = bySlug.get(slug)!;
      const first = group[0];
      return {
        id: ulid(),
        exerciseSlug: slug,
        sets: group.length,
        reps: first.values.reps,
        timeSec: first.values.timeSec,
        distanceM: first.values.distanceM,
        restSec: first.restSec,
        load:
          first.values.weightKg != null
            ? ({ kind: 'absolute', weightKg: first.values.weightKg } as const)
            : ({ kind: 'unspecified' } as const),
      };
    }),
  };

  return templateRepo.create({
    name,
    modalities,
    // Rough, but honest: the working sets plus the rest between them.
    estimatedMinutes: Math.max(
      10,
      Math.round(
        block.items.reduce((total, item) => {
          const work = item.timeSec ?? (item.reps ?? 10) * 3;
          const count = item.sets ?? 1;
          return total + (count * work + (count - 1) * (item.restSec ?? 90)) / 60;
        }, 0),
      ),
    ),
    blocks: [block],
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

/**
 * A saved session, back as loose sets ready to log.
 *
 * Deliberately routed through `expandPrescription` rather than reimplemented: that is the
 * same function that turns a *planned* session into sets, so running a saved workout now and
 * running it off the calendar next Thursday can never drift into producing different things.
 */
export function savedWorkoutToSets(template: SessionTemplate): LoggedSet[] {
  return expandPrescription({
    name: template.name,
    modalities: template.modalities,
    estimatedMinutes: template.estimatedMinutes,
    blocks: template.blocks,
    sourceTemplateId: template.id,
  }).sets;
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

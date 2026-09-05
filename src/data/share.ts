/**
 * Handing one workout or one plan to someone else.
 *
 * Deliberately not the backup format. A backup is "all of my data, put it back on my device",
 * and it is full of ids and timestamps that only mean anything where they came from. A shared
 * file is "this one thing, for anybody" — so it carries no ids, no history, and nothing
 * personal, and importing it always *creates* rather than restoring over the top of what is
 * already there.
 *
 * Two things make the difference between a file that works on someone else's phone and one
 * that arrives broken:
 *
 * 1. **Custom movements travel with it.** A workout references movements by slug. Seeded
 *    slugs exist everywhere; a movement you invented exists only on your device, so the file
 *    carries its definition and the import creates it if the receiving library has never
 *    heard of it.
 * 2. **A plan is a shape, not a diary.** Its sessions are stored as offsets from day one
 *    rather than as dates, because "week 3, Tuesday" is what is being shared and "17 March"
 *    is not. The importer picks its own start date and the offsets land against that.
 */

import { db } from '../db/db';
import { exerciseRepo, planRepo, plannedSessionRepo, templateRepo } from './repos';
import { ulid } from '../domain/ids';
import { translateCustomPlan } from './customPlans';
import { ONGOING_PLAN_WEEKS, generatePlan } from '../domain/planning';
import { addDays, daysBetween, todayKey } from '../domain/dates';
import type {
  Block,
  CustomPlan,
  DayKey,
  Exercise,
  Goal,
  Id,
  Modality,
  Plan,
  Prescription,
  SessionTemplate,
  Weekday,
} from '../domain/types';

export const SHARE_FORMAT = 1;

/** Everything needed to recreate a movement the receiving library does not have. */
export type SharedExercise = Omit<Exercise, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export interface SharedWorkout {
  name: string;
  modalities: Modality[];
  estimatedMinutes?: number;
  blocks: Block[];
  notes?: string;
}

export interface SharedPlanSession {
  /** Days after the plan's first day. Day one is 0. */
  dayOffset: number;
  prescription: Prescription;
}

export interface SharedPlan {
  name: string;
  /** The kind of goal, without the personal parts — see `stripGoal`. */
  goal: Goal;
  daysPerWeek: number;
  /** Whole weeks the plan runs for, so the importer knows what it is taking on. */
  weeks: number;
  sessions: SharedPlanSession[];
  notes?: string;
}

export interface ShareFile {
  format: number;
  app: 'forge';
  kind: 'workout' | 'plan';
  exportedAt: string;
  workout?: SharedWorkout;
  plan?: SharedPlan;
  /** Custom movements referenced above. Seeded ones are left out; everyone has them. */
  exercises: SharedExercise[];
}

// --- reading what a payload needs -------------------------------------------

function slugsIn(blocks: Block[]): string[] {
  return [...new Set(blocks.flatMap((block) => block.items.map((item) => item.exerciseSlug)))];
}

/**
 * The custom movements a set of blocks depends on.
 *
 * Seeded movements are deliberately excluded: every install has them, and shipping 200 stock
 * definitions inside a file describing one AMRAP would make the file about the library rather
 * than about the workout.
 */
async function customExercisesFor(blocks: Block[]): Promise<SharedExercise[]> {
  const needed = new Set(slugsIn(blocks));
  const all = await exerciseRepo.allIncludingDeleted();

  return all
    .filter((exercise) => exercise.isCustom && needed.has(exercise.slug))
    .map(({ id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest }) => rest);
}

/** Block ids are local. Fresh ones on the way out keep a file from carrying our bookkeeping. */
function freshBlocks(blocks: Block[]): Block[] {
  return blocks.map((block) => ({
    ...block,
    id: ulid(),
    items: block.items.map((item) => ({ ...item, id: ulid() })),
  }));
}

/**
 * A goal with the personal parts taken out.
 *
 * A race date is yours, not the plan's — sharing a race block should not tell everyone when
 * you are racing, and it should certainly not schedule their training around your event.
 */
function stripGoal(goal: Goal): Goal {
  const { eventDate: _eventDate, ...rest } = goal;
  return rest as Goal;
}

// --- building files ---------------------------------------------------------

export async function buildWorkoutFile(template: SessionTemplate): Promise<ShareFile> {
  return {
    format: SHARE_FORMAT,
    app: 'forge',
    kind: 'workout',
    exportedAt: new Date().toISOString(),
    workout: {
      name: template.name,
      modalities: template.modalities,
      estimatedMinutes: template.estimatedMinutes,
      blocks: freshBlocks(template.blocks),
      notes: template.notes,
    },
    exercises: await customExercisesFor(template.blocks),
  };
}

export async function buildPlanFile(plan: Plan): Promise<ShareFile> {
  const rows = (await db.plannedSessions.where('planId').equals(plan.id).toArray())
    .filter((session) => !session.deletedAt)
    .sort((a, b) => a.date.localeCompare(b.date));

  const sessions: SharedPlanSession[] = rows.map((session) => ({
    dayOffset: daysBetween(plan.startDate, session.date),
    prescription: {
      ...session.prescription,
      blocks: freshBlocks(session.prescription.blocks),
      // Provenance points at a template id on our device; it means nothing on anyone else's.
      sourceTemplateId: undefined,
    },
  }));

  const span = sessions.reduce((most, session) => Math.max(most, session.dayOffset), 0);
  const blocks = rows.flatMap((session) => session.prescription.blocks);

  return {
    format: SHARE_FORMAT,
    app: 'forge',
    kind: 'plan',
    exportedAt: new Date().toISOString(),
    plan: {
      name: plan.name,
      goal: stripGoal(plan.goal),
      daysPerWeek: plan.daysPerWeek,
      weeks: Math.max(1, Math.ceil((span + 1) / 7)),
      sessions,
      notes: plan.notes,
    },
    exercises: await customExercisesFor(blocks),
  };
}

/**
 * A plan you built, as a file, without ever putting it on a calendar.
 *
 * A custom plan is a week and a repeat count; the share format is a run of sessions at day
 * offsets. Rather than inventing a second format for the same idea, the week is laid out onto
 * a notional start date by the ordinary generator and the resulting dates are converted back
 * into offsets. One format, and the ramps and deloads come out already applied.
 *
 * The start date is arbitrary and never travels — a Sunday is chosen so weekday offsets read
 * naturally — and the exercise library is deliberately left empty, so movements are written
 * out as the plan named them rather than substituted for whatever this device happens to own.
 * Substitution is the importer's business, against their kit.
 */
export async function buildCustomPlanFile(plan: CustomPlan): Promise<ShareFile> {
  const { template, sessionTemplateBySlug } = translateCustomPlan(plan);
  const start = '2026-01-04'; // a Sunday

  const generated = generatePlan({
    template,
    startDate: start,
    weeks: plan.weeks ?? ONGOING_PLAN_WEEKS,
    availability: Array.from({ length: 7 }, (_, weekday) => ({
      weekday: weekday as Weekday,
      allowedModalities: ['strength', 'cardio', 'mobility', 'skill'],
    })),
    exceptions: [],
    weekStartsOn: 0,
    exerciseBySlug: new Map(),
    available: new Set(),
    sessionTemplateBySlug,
  });

  const sessions: SharedPlanSession[] = generated.sessions.map((session) => ({
    dayOffset: daysBetween(start, session.date),
    prescription: { ...session.prescription, sourceTemplateId: undefined },
  }));

  return {
    format: SHARE_FORMAT,
    app: 'forge',
    kind: 'plan',
    exportedAt: new Date().toISOString(),
    plan: {
      name: plan.name,
      goal: stripGoal({ kind: plan.goal, label: plan.name }),
      daysPerWeek: template.daysPerWeek,
      weeks: generated.weeks,
      sessions,
      notes: plan.notes,
    },
    exercises: await customExercisesFor(
      generated.sessions.flatMap((session) => session.prescription.blocks),
    ),
  };
}

// --- files on disk ----------------------------------------------------------

/** Safe for a filename on every platform, and still recognisable a year later. */
function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'shared'
  );
}

export function shareFilename(file: ShareFile): string {
  const name = file.kind === 'plan' ? file.plan?.name : file.workout?.name;
  return `forge-${file.kind}-${slugifyName(name ?? '')}.json`;
}

export function downloadShareFile(file: ShareFile): string {
  const filename = shareFilename(file);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download on some mobile browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return filename;
}

// --- reading files back -----------------------------------------------------

export class ShareFileError extends Error {}

/**
 * Parses and checks a file before anything is written.
 *
 * Everything it can refuse, it refuses here — so the preview the user sees and the import
 * that follows are working from the same validated object, and a malformed file cannot get
 * half way in.
 */
export function parseShareFile(json: string): ShareFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ShareFileError('That file is not readable. It may have been altered or truncated.');
  }

  const file = parsed as Partial<ShareFile>;
  if (!file || typeof file !== 'object' || file.app !== 'forge') {
    throw new ShareFileError('That does not look like a Forge file.');
  }
  if (typeof file.format !== 'number' || file.format > SHARE_FORMAT) {
    throw new ShareFileError('That file was made by a newer version of Forge.');
  }
  if (file.kind === 'workout') {
    if (!file.workout?.name || !Array.isArray(file.workout.blocks)) {
      throw new ShareFileError('That workout file is missing its workout.');
    }
  } else if (file.kind === 'plan') {
    if (!file.plan?.name || !Array.isArray(file.plan.sessions)) {
      throw new ShareFileError('That plan file is missing its plan.');
    }
  } else {
    throw new ShareFileError('That file holds neither a workout nor a plan.');
  }

  return { ...file, exercises: Array.isArray(file.exercises) ? file.exercises : [] } as ShareFile;
}

export interface SharePreview {
  kind: 'workout' | 'plan';
  name: string;
  /**
   * The movements the payload uses, named, in order of first appearance.
   *
   * Names rather than slugs: a custom movement's slug is a ulid, and showing someone
   * `custom-01m1pj8x…` in a list of what they are about to import tells them nothing. The
   * name comes from the library where we have it and from the file where we do not, which
   * between them cover everything except a hand-edited file.
   */
  movements: string[];
  /** Custom movements that would be created, because this library has never seen them. */
  newExercises: SharedExercise[];
  /** Movements you deleted that would be brought back, so the payload can be used. */
  restoredExercises: SharedExercise[];
  /** Movements referenced that are neither in the library nor in the file. */
  missing: string[];
  sessionCount?: number;
  weeks?: number;
  estimatedMinutes?: number;
}

/** What an import would do, worked out before it does any of it. */
export async function previewShareFile(file: ShareFile): Promise<SharePreview> {
  const blocks =
    file.kind === 'workout'
      ? (file.workout?.blocks ?? [])
      : (file.plan?.sessions ?? []).flatMap((session) => session.prescription.blocks);

  const movements = slugsIn(blocks);
  const here = new Map(
    (await exerciseRepo.allIncludingDeleted()).map((exercise) => [exercise.slug, exercise]),
  );
  const known = new Set(here.keys());
  const carried = new Map(file.exercises.map((e) => [e.slug, e]));

  const nameFor = (slug: string) => here.get(slug)?.name ?? carried.get(slug)?.name ?? slug;

  return {
    kind: file.kind,
    name: (file.kind === 'plan' ? file.plan?.name : file.workout?.name) ?? 'Untitled',
    movements: movements.map(nameFor),
    newExercises: file.exercises.filter((e) => !known.has(e.slug)),
    restoredExercises: file.exercises.filter((e) => here.get(e.slug)?.deletedAt),
    // A file can only be short if it was hand-edited, or exported by a build with a bug.
    missing: movements.filter((slug) => !known.has(slug) && !carried.has(slug)),
    sessionCount: file.kind === 'plan' ? file.plan?.sessions.length : undefined,
    weeks: file.kind === 'plan' ? file.plan?.weeks : undefined,
    estimatedMinutes: file.kind === 'workout' ? file.workout?.estimatedMinutes : undefined,
  };
}

/**
 * Makes sure every movement a file brought with it is usable here.
 *
 * Three cases, and the middle one is easy to miss. A slug already in the library is left
 * exactly as it is — never overwritten, because the version on this device is the one its own
 * history refers to, and custom slugs carry a ulid so a genuine collision between two devices
 * does not happen. A slug the library has never seen is created.
 *
 * A slug that is here but *deleted* is restored. Deletes are soft, so a movement you got rid
 * of is still a row, and treating it as present would let the import claim success while
 * leaving the workout pointing at something no picker will offer. Importing a workout is a
 * decision to be able to do it.
 */
async function ensureExercises(file: ShareFile): Promise<{ added: number; restored: number }> {
  const existing = new Map(
    (await exerciseRepo.allIncludingDeleted()).map((exercise) => [exercise.slug, exercise]),
  );

  let added = 0;
  let restored = 0;

  for (const exercise of file.exercises) {
    const here = existing.get(exercise.slug);
    if (!here) {
      await exerciseRepo.create(exercise as never);
      added += 1;
    } else if (here.deletedAt) {
      await exerciseRepo.restore(here.id);
      restored += 1;
    }
  }

  return { added, restored };
}

/** A name that does not tread on one already in use — "Cindy", then "Cindy (2)". */
function freeName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${name} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${name} (${ulid().slice(-4)})`;
}

export interface ImportedWorkout {
  template: SessionTemplate;
  exercisesAdded: number;
  /** Movements you had deleted, brought back so the workout can actually be run. */
  exercisesRestored: number;
  renamedTo?: string;
}

export async function importWorkout(file: ShareFile): Promise<ImportedWorkout> {
  if (file.kind !== 'workout' || !file.workout) {
    throw new ShareFileError('That file does not hold a workout.');
  }

  const { added, restored } = await ensureExercises(file);
  const taken = new Set((await templateRepo.all()).map((t) => t.name));
  const name = freeName(file.workout.name, taken);

  const template = await templateRepo.create({
    name,
    modalities: file.workout.modalities ?? ['strength'],
    estimatedMinutes: file.workout.estimatedMinutes,
    blocks: freshBlocks(file.workout.blocks),
    isCustom: true,
    notes: file.workout.notes,
  } as never);

  return {
    template: template as SessionTemplate,
    exercisesAdded: added,
    exercisesRestored: restored,
    renamedTo: name === file.workout.name ? undefined : name,
  };
}

export interface ImportedPlan {
  plan: Plan;
  sessions: number;
  exercisesAdded: number;
  exercisesRestored: number;
  renamedTo?: string;
}

/**
 * Lays a shared plan onto the calendar from a chosen start date.
 *
 * Imported inactive, deliberately. Making it active would silently retire whatever plan is
 * running — and a file someone sent you is not, by the act of opening it, a decision to
 * abandon what you were doing. Starting it is a separate, visible choice.
 */
export async function importPlan(
  file: ShareFile,
  startDate: DayKey = todayKey(),
): Promise<ImportedPlan> {
  if (file.kind !== 'plan' || !file.plan) {
    throw new ShareFileError('That file does not hold a plan.');
  }

  const { added, restored } = await ensureExercises(file);
  const taken = new Set((await planRepo.all()).map((p) => p.name));
  const name = freeName(file.plan.name, taken);

  const offsets = file.plan.sessions.map((session) => session.dayOffset);
  const lastDay = offsets.length > 0 ? Math.max(...offsets) : 0;

  const plan = await planRepo.create({
    name,
    goal: file.plan.goal,
    startDate,
    endDate: addDays(startDate, lastDay),
    phases: [],
    daysPerWeek: file.plan.daysPerWeek ?? 3,
    isActive: false,
    notes: file.plan.notes,
  } as never);

  for (const session of file.plan.sessions) {
    await plannedSessionRepo.create({
      date: addDays(startDate, session.dayOffset),
      planId: (plan as Plan).id,
      prescription: {
        ...session.prescription,
        blocks: freshBlocks(session.prescription.blocks),
      },
      status: 'planned',
    } as never);
  }

  return {
    plan: plan as Plan,
    sessions: file.plan.sessions.length,
    exercisesAdded: added,
    exercisesRestored: restored,
    renamedTo: name === file.plan.name ? undefined : name,
  };
}

/**
 * Starts following a plan that was sitting on the calendar unstarted.
 *
 * Leaves anything else running. It used to retire them, from back when only one plan could be
 * active — now two plans is a thing you may well have meant, and taking one away because you
 * started another would be deciding something you did not ask for.
 */
export async function activateImportedPlan(planId: Id): Promise<void> {
  await planRepo.update(planId, { isActive: true });
}

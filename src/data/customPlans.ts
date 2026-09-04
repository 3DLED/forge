/**
 * Plans you built yourself.
 *
 * The whole trick here is that there is no second plan engine. A custom plan is translated
 * into the same `SeedPlanTemplate` shape the built-in plans use, and handed to the same
 * generator — so it gets equipment substitution, deload weeks, taper curves and conflict
 * reporting for free, and none of that logic exists twice waiting to disagree with itself.
 *
 * Two things differ from a seeded plan, and both are the point of building your own:
 *
 * 1. **Its days are pinned.** A seeded plan asks for three strength days and lets the app
 *    find room; yours says Wednesday, and `placeSlotsInWeek` honours it.
 * 2. **It can hold your own workouts.** Those are snapshotted into the plan rather than
 *    referenced, so deleting the workout cannot break a plan built on it.
 */

import { customPlanRepo } from './repos';
import { SEED_SESSION_TEMPLATE_BY_SLUG, type SeedSessionTemplate } from './seed/sessionTemplates';
import { ulid } from '../domain/ids';
import type {
  CustomPlan,
  CustomPlanDay,
  Id,
  Modality,
  SlotProgression,
  Weekday,
} from '../domain/types';
import type { SeedPlanTemplate, PlanSlot } from './seed/planTemplates';

/** A week with nothing on it, which is what the builder opens on. */
export function emptyWeek(): CustomPlanDay[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday: weekday as Weekday,
    kind: 'open' as const,
  }));
}

export function isTrainingDay(day: CustomPlanDay): boolean {
  return day.kind === 'template' || day.kind === 'saved';
}

/** How many sessions a week this plan asks for. */
export function daysPerWeek(plan: CustomPlan): number {
  return plan.days.filter(isTrainingDay).length;
}

/**
 * What a day actually holds, for display.
 *
 * The builder, the library row and the apply preview all want to say what is on Wednesday,
 * and none of them should be reaching into two different optional fields to find out.
 */
export function dayLabel(day: CustomPlanDay): string {
  if (day.kind === 'rest') return 'Rest';
  if (day.kind === 'saved') return day.workout?.name ?? 'Saved workout';
  if (day.kind === 'template') {
    return SEED_SESSION_TEMPLATE_BY_SLUG.get(day.templateSlug ?? '')?.name ?? 'Session';
  }
  return '—';
}

/** The modality a day trains, which is what the scheduler matches days against. */
function modalityOfDay(day: CustomPlanDay): Modality {
  if (day.kind === 'saved') return day.workout?.modalities[0] ?? 'strength';
  return SEED_SESSION_TEMPLATE_BY_SLUG.get(day.templateSlug ?? '')?.modalities[0] ?? 'strength';
}

/** Snapshotted workouts need a template slug of their own to be looked up by. */
function slugForSavedDay(day: CustomPlanDay): string {
  return `custom-day-${day.weekday}`;
}

/**
 * Turns a snapshotted workout into the shape the generator materialises prescriptions from.
 *
 * `Block` and `SeedBlock` say the same things in slightly different words — one is what the
 * app stores, the other what the seed files are authored in — so this is a translation rather
 * than a conversion, and deliberately lossless in the direction that matters.
 */
function asSessionTemplate(day: CustomPlanDay): SeedSessionTemplate | null {
  const workout = day.workout;
  if (!workout) return null;

  return {
    slug: slugForSavedDay(day),
    name: workout.name,
    modalities: workout.modalities,
    estimatedMinutes: workout.estimatedMinutes ?? 45,
    blocks: workout.blocks.map((block) => ({
      style: block.style,
      label: block.label,
      rounds: block.rounds,
      restSec: block.restSec,
      capSec: block.capSec,
      items: block.items.map((item) => ({
        ex: item.exerciseSlug,
        sets: item.sets,
        reps: item.repRange ?? item.reps,
        timeSec: item.timeSec,
        distanceM: item.distanceM,
        paceSecPerKm: item.paceSecPerKm,
        load: item.load,
        restSec: item.restSec,
        notes: item.notes,
      })),
    })),
  };
}

/**
 * Movements on a day that could be made to grow, with what they currently ask for.
 *
 * Only distance and time: reps and load are what the logger already autoregulates from what
 * you actually did, and a plan that also ramped them would be arguing with it every session.
 * A distance is different — nothing about last Tuesday tells you how far to run in week nine.
 */
export interface RampableMovement {
  exerciseSlug: string;
  metric: 'distanceM' | 'timeSec';
  /** What the session asks for today, which is where a ramp sensibly starts. */
  value: number;
}

export function rampableMovements(day: CustomPlanDay): RampableMovement[] {
  const blocks =
    day.kind === 'saved'
      ? (day.workout?.blocks ?? []).map((block) => ({
          items: block.items.map((item) => ({
            ex: item.exerciseSlug,
            distanceM: item.distanceM,
            timeSec: item.timeSec,
          })),
        }))
      : (SEED_SESSION_TEMPLATE_BY_SLUG.get(day.templateSlug ?? '')?.blocks ?? []).map((block) => ({
          items: block.items.map((item) => ({
            ex: item.ex,
            distanceM: item.distanceM,
            timeSec: item.timeSec,
          })),
        }));

  const found: RampableMovement[] = [];
  for (const block of blocks) {
    for (const item of block.items) {
      if (item.distanceM != null) {
        found.push({ exerciseSlug: item.ex, metric: 'distanceM', value: item.distanceM });
      } else if (item.timeSec != null) {
        found.push({ exerciseSlug: item.ex, metric: 'timeSec', value: item.timeSec });
      }
    }
  }
  return found;
}

/** What a ramp reaches in a given week, so a builder can show the curve before committing. */
export function rampValueAt(ramp: SlotProgression, week: number): number {
  const raw = ramp.startValue * (1 + ramp.weeklyRate) ** (week - 1);
  return Math.round(ramp.maxValue ? Math.min(raw, ramp.maxValue) : raw);
}

export interface TranslatedCustomPlan {
  template: SeedPlanTemplate;
  /**
   * The built-in library plus a synthetic template per snapshotted workout, ready to hand
   * straight to `generatePlan`.
   */
  sessionTemplateBySlug: Map<string, SeedSessionTemplate>;
  /** Days naming a built-in template that no longer exists — reported rather than dropped. */
  missing: string[];
  /**
   * Weekdays you marked as rest.
   *
   * These have to close the day, not merely leave it empty. The generator adds conditioning
   * sessions of its own where the goal asks for them, and those float into whatever day is
   * free — so without this, saying "Wednesday is a rest day" produces a plan with a run on
   * Wednesday, which is the opposite of what you said.
   */
  restDays: Weekday[];
}

/**
 * A custom plan, in the language the generator already speaks.
 *
 * Slots are ordered by weekday so the plan reads down the week, though the order only decides
 * ties: every slot is pinned, so nothing is placed by spreading.
 */
export function translateCustomPlan(plan: CustomPlan): TranslatedCustomPlan {
  const sessionTemplateBySlug = new Map(SEED_SESSION_TEMPLATE_BY_SLUG);
  const slots: PlanSlot[] = [];
  const missing: string[] = [];

  for (const day of plan.days.filter(isTrainingDay)) {
    if (day.kind === 'saved') {
      const synthetic = asSessionTemplate(day);
      if (!synthetic) continue;
      sessionTemplateBySlug.set(synthetic.slug, synthetic);
      slots.push({
        templateSlug: synthetic.slug,
        modality: modalityOfDay(day),
        order: day.weekday,
        weekday: day.weekday,
        progression: day.ramp,
      });
      continue;
    }

    const slug = day.templateSlug ?? '';
    if (!sessionTemplateBySlug.has(slug)) {
      missing.push(slug);
      continue;
    }
    slots.push({
      templateSlug: slug,
      modality: modalityOfDay(day),
      order: day.weekday,
      weekday: day.weekday,
      progression: day.ramp,
    });
  }

  return {
    restDays: plan.days.filter((day) => day.kind === 'rest').map((day) => day.weekday),
    template: {
      slug: `custom-${plan.id}`,
      name: plan.name,
      description: plan.notes ?? 'A plan you built yourself.',
      goal: plan.goal,
      weeks: plan.weeks,
      daysPerWeek: slots.length,
      slots,
      tags: ['custom'],
    },
    sessionTemplateBySlug,
    missing,
  };
}

// --- storage ----------------------------------------------------------------

export async function allCustomPlans(): Promise<CustomPlan[]> {
  return (await customPlanRepo.all()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCustomPlan(id: Id): Promise<CustomPlan | undefined> {
  return customPlanRepo.get(id);
}

export async function saveCustomPlan(
  draft: Omit<CustomPlan, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  id?: Id,
): Promise<CustomPlan> {
  if (id) return (await customPlanRepo.update(id, draft)) as CustomPlan;
  return (await customPlanRepo.create(draft as never)) as CustomPlan;
}

export async function deleteCustomPlan(id: Id): Promise<void> {
  await customPlanRepo.remove(id);
}

/** A copy, for building a variation without disturbing the one you are following. */
export async function duplicateCustomPlan(plan: CustomPlan): Promise<CustomPlan> {
  const taken = new Set((await allCustomPlans()).map((p) => p.name));
  let name = `${plan.name} (copy)`;
  for (let n = 2; taken.has(name) && n < 100; n += 1) name = `${plan.name} (copy ${n})`;

  return saveCustomPlan({
    name,
    goal: plan.goal,
    weeks: plan.weeks,
    // Deep enough: days carry blocks, and a shallow copy would share them with the original.
    days: plan.days.map((day) => ({
      ...day,
      workout: day.workout
        ? { ...day.workout, blocks: day.workout.blocks.map((b) => ({ ...b, id: ulid() })) }
        : undefined,
      ramp: day.ramp ? { ...day.ramp } : undefined,
    })),
    notes: plan.notes,
  });
}

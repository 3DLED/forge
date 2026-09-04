/**
 * Turning a plan template into dated sessions.
 *
 * This is where the three constraint systems finally meet: the program says *what*, your
 * calendar says *when*, and your equipment says *with what*. All three are resolved here,
 * at generation time, and the result is frozen into each planned session as a snapshot.
 *
 * Freezing matters. If a plan kept pointing at its template, buying a barbell in week six
 * would silently rewrite what weeks one through five had claimed to prescribe, and
 * plan-versus-actual would stop meaning anything.
 */

import type {
  AvailabilityRule,
  Block,
  CalendarException,
  DayKey,
  Exercise,
  LoadSpec,
  Prescription,
  PrescribedItem,
  Weekday,
} from './types';
import type { SeedItem, SeedSessionTemplate } from '../data/seed/sessionTemplates';
import type { PlanSlot, SeedPlanTemplate } from '../data/seed/planTemplates';
import type { SlotProgression } from './types';
import { addWeeks, startOfWeek, weekDays } from './dates';
import { resolveExercise } from './equipment';
import { placeSlotsInWeek, resolveWeekAvailability } from './scheduling';
import { ulid } from './ids';
import { GOAL_SCHEMES } from './generator';
import {
  CONDITIONING_MODALITY,
  CONDITIONING_TEMPLATE_SLUG,
  extraConditioningFor,
  goalSpec,
  type PrimaryGoal,
} from './goals';

/**
 * Volume multipliers for the final weeks of a race plan, indexed by how many weeks remain
 * (0 is race week). Sharpest cut closest to the start line.
 */
const TAPER_CURVES: Record<number, number[]> = {
  1: [0.6],
  2: [0.5, 0.75],
  3: [0.45, 0.65, 0.8],
};

/** How many weeks an "ongoing" plan lays down at a time. */
export const ONGOING_PLAN_WEEKS = 8;

export interface GenerateOptions {
  template: SeedPlanTemplate;
  startDate: DayKey;
  /** Overrides the template's own length; required for ongoing templates. */
  weeks?: number;
  availability: AvailabilityRule[];
  exceptions: CalendarException[];
  weekStartsOn: Weekday;
  exerciseBySlug: Map<string, Exercise>;
  /** Exercise slugs the athlete's current equipment actually allows. */
  available: Set<string>;
  sessionTemplateBySlug: Map<string, SeedSessionTemplate>;
  /** The athlete's standing goal, which biases the dose and the weekly shape. */
  primaryGoal?: PrimaryGoal;
}

export interface GeneratedSession {
  date: DayKey;
  /** 1-indexed week within the plan. */
  weekIndex: number;
  isDeload: boolean;
  prescription: Prescription;
}

export interface GenerationConflict {
  weekIndex: number;
  weekStart: DayKey;
  sessionName: string;
  reason: string;
}

export interface GeneratedPlan {
  sessions: GeneratedSession[];
  conflicts: GenerationConflict[];
  /** Movements swapped for equipment reasons, with how often. */
  substitutions: { from: string; to: string; count: number }[];
  /** Movements with no workable substitute — prescribed anyway, and flagged. */
  unavailable: string[];
  weeks: number;
  endDate: DayKey;
}

// --- week shaping ----------------------------------------------------------

/** The volume multiplier for a given week: taper wins over deload, deload over normal. */
export function weekFactor(template: SeedPlanTemplate, weekIndex: number, totalWeeks: number): number {
  if (template.taperWeeks) {
    const weeksRemaining = totalWeeks - weekIndex;
    const curve = TAPER_CURVES[template.taperWeeks];
    if (curve && weeksRemaining < curve.length) return curve[weeksRemaining];
  }

  if (template.deloadEvery && weekIndex % template.deloadEvery === 0) {
    return template.deloadFactor ?? 0.65;
  }

  return 1;
}

export function isDeloadWeek(template: SeedPlanTemplate, weekIndex: number, totalWeeks: number): boolean {
  return weekFactor(template, weekIndex, totalWeeks) < 1;
}

/** Compounding weekly progression, capped. */
function progressedValue(progression: SlotProgression, weekIndex: number): number {
  const raw = progression.startValue * (1 + progression.weeklyRate) ** (weekIndex - 1);
  return progression.maxValue ? Math.min(raw, progression.maxValue) : raw;
}

// --- materialising a prescription -----------------------------------------

function loadFor(item: SeedItem): LoadSpec {
  if (item.load) return item.load;
  if (item.rpe != null) return { kind: 'rpe', rpe: item.rpe };
  return { kind: 'unspecified' };
}

function toPrescribedItem(item: SeedItem, exerciseSlug: string): PrescribedItem {
  const prescribed: PrescribedItem = {
    id: ulid(),
    exerciseSlug,
    load: loadFor(item),
  };

  if (item.sets != null) prescribed.sets = item.sets;
  if (Array.isArray(item.reps)) prescribed.repRange = item.reps;
  else if (item.reps != null) prescribed.reps = item.reps;
  if (item.timeSec != null) prescribed.timeSec = item.timeSec;
  if (item.distanceM != null) prescribed.distanceM = item.distanceM;
  if (item.paceSecPerKm != null) prescribed.paceSecPerKm = item.paceSecPerKm;
  if (item.restSec != null) prescribed.restSec = item.restSec;
  if (item.notes) prescribed.notes = item.notes;

  return prescribed;
}

/**
 * Nudges a prescribed item toward the goal's dose.
 *
 * Deliberately a nudge and not a replacement. Overwriting every template's sets and reps with
 * the scheme's would make a Full Body A identical to a Push day and throw away the reason
 * anyone picked one plan over another; leaving them untouched would mean the goal does
 * nothing. So it moves halfway, which shifts a five-rep squat toward eights for someone
 * chasing size without turning the plan into a different programme.
 *
 * Only rep-based work is touched. Runs keep their distances and paces: a long run does not
 * get shorter because you said "build muscle", and a session's conditioning is not the place
 * the lifting goal expresses itself.
 */
function towards(value: number, target: number): number {
  return Math.round(value + (target - value) / 2);
}

function shapeItem(item: PrescribedItem, goal: PrimaryGoal | undefined): PrescribedItem {
  if (goal === undefined || goal === 'general') return item;
  // A run, an erg, or anything else scored by ground covered.
  if (item.distanceM != null || item.paceSecPerKm != null) return item;

  const scheme = GOAL_SCHEMES[goalSpec(goal).lifting];
  const shaped: PrescribedItem = { ...item };

  if (item.repRange) {
    shaped.repRange = [
      Math.max(1, towards(item.repRange[0], scheme.reps[0])),
      Math.max(1, towards(item.repRange[1], scheme.reps[1])),
    ];
  } else if (item.reps != null) {
    shaped.reps = Math.max(1, towards(item.reps, scheme.reps[0]));
  } else {
    // A hold: nothing rep-shaped to move, and rest is the block's business.
    return item;
  }

  if (item.restSec != null) shaped.restSec = Math.max(15, towards(item.restSec, scheme.restSec));

  return shaped;
}

/**
 * Applies a week's volume multiplier.
 *
 * Where the scaling lands depends on how the block is structured: repeated blocks lose
 * rounds, straight sets lose sets, and a continuous effort loses distance or time. Cutting
 * reps instead would change what the session trains, not how much of it you do.
 */
function scaleBlock(block: Block, factor: number): Block {
  if (factor >= 1) return block;

  const repeated = block.style === 'circuit' || block.style === 'interval' ||
    block.style === 'emom' || block.style === 'amrap';

  if (repeated && block.rounds) {
    return { ...block, rounds: Math.max(1, Math.round(block.rounds * factor)) };
  }

  return {
    ...block,
    items: block.items.map((item) => {
      if (item.sets != null) return { ...item, sets: Math.max(1, Math.round(item.sets * factor)) };
      if (item.distanceM != null) return { ...item, distanceM: Math.round(item.distanceM * factor) };
      if (item.timeSec != null) return { ...item, timeSec: Math.round(item.timeSec * factor) };
      return item;
    }),
  };
}

export interface MaterialiseResult {
  prescription: Prescription;
  substitutions: { from: string; to: string }[];
  unavailable: string[];
}

/**
 * Builds one dated prescription: resolves every movement against the athlete's equipment,
 * applies this week's progression, then scales for a deload or taper.
 */
export function materialisePrescription(
  seed: SeedSessionTemplate,
  options: {
    weekIndex: number;
    factor: number;
    progression?: SlotProgression;
    exerciseBySlug: Map<string, Exercise>;
    available: Set<string>;
    primaryGoal?: PrimaryGoal;
  },
): MaterialiseResult {
  const substitutions: { from: string; to: string }[] = [];
  const unavailable: string[] = [];

  const blocks: Block[] = seed.blocks.map((seedBlock) => {
    const items = seedBlock.items.map((seedItem) => {
      // Progression applies to the movement the template names, before any substitution —
      // otherwise a swapped-in movement would silently escape the plan's build-up.
      const progressed =
        options.progression && options.progression.exerciseSlug === seedItem.ex
          ? { ...seedItem, [options.progression.metric]: Math.round(progressedValue(options.progression, options.weekIndex)) }
          : seedItem;

      const resolved = resolveExercise(seedItem.ex, options.exerciseBySlug, options.available);
      if (!resolved) {
        unavailable.push(seedItem.ex);
        return shapeItem(toPrescribedItem(progressed, seedItem.ex), options.primaryGoal);
      }
      if (resolved.slug !== seedItem.ex) {
        substitutions.push({ from: seedItem.ex, to: resolved.slug });
      }
      return shapeItem(toPrescribedItem(progressed, resolved.slug), options.primaryGoal);
    });

    const block: Block = {
      id: ulid(),
      style: seedBlock.style,
      label: seedBlock.label,
      rounds: seedBlock.rounds,
      restSec: seedBlock.restSec,
      capSec: seedBlock.capSec,
      items,
    };

    return scaleBlock(block, options.factor);
  });

  return {
    prescription: {
      name: seed.name,
      modalities: seed.modalities,
      estimatedMinutes: Math.round(seed.estimatedMinutes * Math.max(options.factor, 0.5)),
      blocks,
      notes: seed.notes,
    },
    substitutions,
    unavailable,
  };
}

// --- generating a whole plan ----------------------------------------------

/**
 * The extra conditioning a goal asks for, as ordinary slots.
 *
 * Placed last in the week so they fill whatever the plan's own sessions did not want, and
 * dropped silently when there is no day left — an added session is a preference, not part of
 * the programme you chose, so it should never displace one or raise a conflict.
 */
function conditioningSlots(options: GenerateOptions): PlanSlot[] {
  const count = extraConditioningFor(
    options.primaryGoal,
    options.template.goal,
    options.template.tags,
  );

  return Array.from({ length: count }, (_, i) => ({
    templateSlug: CONDITIONING_TEMPLATE_SLUG,
    modality: CONDITIONING_MODALITY,
    order: 100 + i,
  }));
}

export function generatePlan(options: GenerateOptions): GeneratedPlan {
  const { template } = options;
  const totalWeeks = options.weeks ?? template.weeks ?? ONGOING_PLAN_WEEKS;

  const sessions: GeneratedSession[] = [];
  const conflicts: GenerationConflict[] = [];
  const substitutionCounts = new Map<string, number>();
  const unavailable = new Set<string>();

  // Plans start on the week containing the start date, but never place a session before it.
  const firstWeekStart = startOfWeek(options.startDate, options.weekStartsOn);

  for (let weekIndex = 1; weekIndex <= totalWeeks; weekIndex++) {
    const weekStart = addWeeks(firstWeekStart, weekIndex - 1);
    const days = weekDays(weekStart, options.weekStartsOn).filter((day) => day >= options.startDate);

    const availability = resolveWeekAvailability(days, options.availability, options.exceptions);
    const factor = weekFactor(template, weekIndex, totalWeeks);

    const added = conditioningSlots(options);
    const slotsThisWeek = [
      ...template.slots.filter((s) => (s.fromWeek ?? 1) <= weekIndex),
      ...added,
    ];
    const placements = placeSlotsInWeek(availability, slotsThisWeek);

    for (const placement of placements) {
      const slot = placement.slot as PlanSlot;
      const seed = options.sessionTemplateBySlug.get(slot.templateSlug);
      if (!seed) continue;

      if (!placement.date) {
        // A session the goal added is a preference, not part of the programme. When the week
        // has no room for it, it simply does not happen — reporting it as a conflict would
        // blame the plan for something the plan never asked for.
        if (!added.includes(slot)) {
          conflicts.push({
            weekIndex,
            weekStart,
            sessionName: seed.name,
            reason: placement.reason ?? 'Could not be scheduled',
          });
        }
        continue;
      }

      const result = materialisePrescription(seed, {
        weekIndex,
        factor,
        progression: slot.progression,
        exerciseBySlug: options.exerciseBySlug,
        available: options.available,
        primaryGoal: options.primaryGoal,
      });

      for (const swap of result.substitutions) {
        const key = `${swap.from}→${swap.to}`;
        substitutionCounts.set(key, (substitutionCounts.get(key) ?? 0) + 1);
      }
      for (const slug of result.unavailable) unavailable.add(slug);

      sessions.push({
        date: placement.date,
        weekIndex,
        isDeload: factor < 1,
        prescription: result.prescription,
      });
    }
  }

  return {
    sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)),
    conflicts,
    substitutions: [...substitutionCounts.entries()]
      .map(([key, count]) => {
        const [from, to] = key.split('→');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count),
    unavailable: [...unavailable],
    weeks: totalWeeks,
    endDate: weekDays(addWeeks(firstWeekStart, totalWeeks - 1), options.weekStartsOn)[6],
  };
}

/**
 * Works backwards from a race date to the start date a plan of this length needs.
 * Race day should land in the final week, which is what the taper is built around.
 */
export function startDateForRace(raceDate: DayKey, weeks: number, weekStartsOn: Weekday): DayKey {
  return addWeeks(startOfWeek(raceDate, weekStartsOn), -(weeks - 1));
}

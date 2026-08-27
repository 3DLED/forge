/**
 * Suggesting a workout from a region, a goal, and whatever equipment is on hand.
 *
 * This is the per-session half of the goal-driven generator: not "plan me a marathon block",
 * but "it is Tuesday, I want upper body, I have kettlebells, give me something sensible".
 *
 * Three ideas do the work:
 *
 * 1. **Cover the patterns, don't pile on muscles.** A region is a list of movement patterns,
 *    and a good session touches each once before it touches any twice. That is what stops a
 *    suggestion being three variations of a bench press.
 *
 * 2. **Equipment is a filter, not a footnote.** Only movements you can actually do today are
 *    candidates. Everything else in the app shows unavailable movements dimmed and teaches the
 *    substitution; a *suggestion* has no reason to propose something you cannot do.
 *
 * 3. **With no load, strength means a harder variant, not more reps.** Adding weight is only
 *    one way to progress and it is the one that needs a gym. When the goal is strength and
 *    nothing here is externally loaded, the generator climbs one rung of `progression.harder`
 *    instead. That ladder was seeded for equipment fallback; this is the other half of what it
 *    is for.
 *
 * Nothing here writes. It returns a proposal, the caller shows it, and the athlete accepts,
 * swaps, or throws it away.
 */

import type { EquipmentTag, Exercise, MetricValues, MovementPattern } from './types';
import { BUILDABLE_REGIONS, PATTERNS_IN_REGION, regionOf, type BodyRegion } from './regions';

export type TrainingGoal = 'strength' | 'muscle' | 'endurance';

export interface GoalScheme {
  label: string;
  blurb: string;
  sets: number;
  /** Inclusive rep range. The low end is prescribed; the range is what gets displayed. */
  reps: [number, number];
  /** Seconds, for movements scored by time rather than reps. */
  holdSec: number;
  restSec: number;
  /** Target effort, shown as guidance rather than pre-filled onto the sets. */
  rpe: number;
}

export const GOAL_SCHEMES: Record<TrainingGoal, GoalScheme> = {
  strength: {
    label: 'Build strength',
    blurb: 'Heavy, low reps, long rest. Or a harder variation when there is nothing to load.',
    sets: 5,
    reps: [3, 5],
    holdSec: 25,
    restSec: 180,
    rpe: 8,
  },
  muscle: {
    label: 'Build muscle',
    blurb: 'Moderate load, moderate reps, enough rest to repeat it. A rep or two left in the tank.',
    sets: 4,
    reps: [8, 12],
    holdSec: 40,
    restSec: 90,
    rpe: 8,
  },
  endurance: {
    label: 'Build endurance',
    blurb: 'Lighter, higher reps, short rest. The point is to keep going.',
    sets: 3,
    reps: [15, 20],
    holdSec: 60,
    restSec: 45,
    rpe: 7,
  },
};

export const GOAL_ORDER: TrainingGoal[] = ['strength', 'muscle', 'endurance'];

/** Container pseudo-movements. Real records, but never something to *suggest*. */
const CONTAINERS = new Set(['amrap', 'emom', 'for-time']);

/** Tags that mean the movement carries external resistance, so load is the way to progress. */
const LOADED_TAGS = new Set<EquipmentTag>([
  'barbell', 'plates', 'dumbbell', 'kettlebell', 'trapBar', 'smithMachine',
  'cableMachine', 'latPulldown', 'legPress', 'legCurl', 'legExtension',
  'chestPress', 'rowMachine', 'sled', 'sandbag', 'medicineBall', 'slamBall',
  'wallBall', 'weightVest', 'resistanceBand', 'miniBand',
]);

function isLoaded(exercise: Exercise): boolean {
  return exercise.equipment.some((tag) => LOADED_TAGS.has(tag));
}

/** Scored by a clock rather than a rep count: planks, hangs, wall sits. */
function isHold(exercise: Exercise): boolean {
  return exercise.metrics.includes('timeSec') && !exercise.metrics.includes('reps');
}

export interface SuggestedItem {
  exercise: Exercise;
  pattern: MovementPattern;
  sets: number;
  /** Pre-filled onto every set: the rep or time target. Load stays blank — that is the ask. */
  values: MetricValues;
  /** What the preview shows: "8–12" or "40s". */
  target: string;
  restSec: number;
  /** Other movements for this pattern, ranked, so the preview can offer a swap. */
  alternatives: Exercise[];
}

export interface Suggestion {
  items: SuggestedItem[];
  estimatedMinutes: number;
  /** Things worth saying out loud — a progression bumped, a pattern left uncovered. */
  notes: string[];
}

export interface SuggestOptions {
  regions: BodyRegion[];
  goal: TrainingGoal;
  /** Time budget in minutes. The suggestion is trimmed to fit rather than overflowing it. */
  minutes: number;
  exercises: Exercise[];
  /** Slugs performable with the equipment on hand for this session. */
  available: Set<string>;
  /** How often each movement has been trained lately — used to rotate, not to rank quality. */
  usage?: Map<string, number>;
  /** Movements already in the session, so a suggestion never duplicates what is there. */
  exclude?: Set<string>;
  /** Bumped by "shuffle" to walk further down each ranked list. Deterministic. */
  variant?: number;
}

/**
 * Roughly how long an item takes: the working sets plus the rest between them.
 *
 * Rest after the final set is not counted — it belongs to whatever comes next, or to going
 * home. Counting it makes every estimate one rest period too long, which over five movements
 * is most of a rep range.
 */
function itemMinutes(item: SuggestedItem): number {
  const workSec = item.values.timeSec ?? (item.values.reps ?? 10) * 3;
  return (item.sets * workSec + (item.sets - 1) * item.restSec) / 60;
}

export function estimateMinutes(items: SuggestedItem[]): number {
  return Math.round(items.reduce((total, item) => total + itemMinutes(item), 0));
}

export function suggestWorkout(options: SuggestOptions): Suggestion {
  const { goal, minutes, exercises, available, usage, variant = 0 } = options;
  const scheme = GOAL_SCHEMES[goal];
  const exclude = options.exclude ?? new Set<string>();
  const regions = options.regions.filter((r) => BUILDABLE_REGIONS.includes(r));
  const notes: string[] = [];

  const bySlug = new Map(exercises.map((e) => [e.slug, e]));

  const candidates = exercises.filter(
    (exercise) =>
      exercise.modality === 'strength' &&
      !CONTAINERS.has(exercise.slug) &&
      !exclude.has(exercise.slug) &&
      available.has(exercise.slug) &&
      regions.includes(regionOf(exercise)),
  );

  /**
   * Ranking within a pattern: compounds, then staples, then the standard version of the
   * movement, then whatever has been trained least recently.
   *
   * That third rung matters more than it looks. A push-up and an incline push-up are both
   * staples on bodyweight-only kit, and without it the tiebreak falls to something arbitrary
   * — alphabetical order, or a rotation bonus for the one you have been avoiding — either of
   * which cheerfully opens an upper day with the regression. How many rungs sit *below* a
   * movement on its own ladder is already seeded, and says exactly what is wanted here: the
   * push-up has two, the incline push-up has none.
   */
  const rank = (a: Exercise, b: Exercise) => {
    // Boolean() rather than a bare read: an exercise restored from a backup taken before
    // this flag existed has it undefined, and NaN in a comparator silently disables the sort.
    const compound = Number(Boolean(a.isAccessory)) - Number(Boolean(b.isAccessory));
    if (compound !== 0) return compound;
    const staple = Number(b.common) - Number(a.common);
    if (staple !== 0) return staple;
    const standard = b.progression.easier.length - a.progression.easier.length;
    if (standard !== 0) return standard;
    const rotation = (usage?.get(a.slug) ?? 0) - (usage?.get(b.slug) ?? 0);
    if (rotation !== 0) return rotation;
    return a.name.localeCompare(b.name);
  };

  const byPattern = new Map<MovementPattern, Exercise[]>();
  for (const exercise of candidates) {
    const list = byPattern.get(exercise.pattern) ?? [];
    list.push(exercise);
    byPattern.set(exercise.pattern, list);
  }
  for (const list of byPattern.values()) list.sort(rank);

  // Patterns interleaved across the chosen regions, so an upper + lower day alternates
  // rather than finishing all of one before starting the other.
  const patterns = interleave(regions.map((region) => PATTERNS_IN_REGION[region]));

  const items: SuggestedItem[] = [];
  const used = new Set<string>();
  let progressed = 0;

  for (const pattern of patterns) {
    const ranked = (byPattern.get(pattern) ?? []).filter((e) => !used.has(e.slug));
    if (ranked.length === 0) continue;

    let chosen = ranked[variant % ranked.length];

    // No way to add load here, and the goal is strength: climb the ladder instead. One rung
    // only — the point is a harder version of today's session, not a leap to a pistol squat.
    if (goal === 'strength' && !isLoaded(chosen)) {
      const harder = chosen.progression.harder
        .map((slug) => bySlug.get(slug))
        .find((e) => e && available.has(e.slug) && !used.has(e.slug) && !exclude.has(e.slug));
      if (harder) {
        chosen = harder;
        progressed += 1;
      }
    }

    used.add(chosen.slug);
    const hold = isHold(chosen);

    items.push({
      exercise: chosen,
      pattern,
      sets: scheme.sets,
      values: hold ? { timeSec: scheme.holdSec } : { reps: scheme.reps[0] },
      target: hold ? `${scheme.holdSec}s` : `${scheme.reps[0]}–${scheme.reps[1]}`,
      restSec: scheme.restSec,
      alternatives: ranked.filter((e) => e.slug !== chosen.slug),
    });
  }

  // Counted before the trim. Afterwards the two reasons a pattern is missing — nothing in
  // the library fits today's kit, and it did not fit the clock — are indistinguishable, and
  // reporting the second as the first sends you off hunting for equipment you already have.
  const uncovered = patterns.length - items.length;

  // Trim to the time budget from the end, where the accessories are. Cutting sets instead
  // would keep every movement and make none of them a real stimulus.
  const covered = items.length;
  while (items.length > 1 && estimateMinutes(items) > minutes) items.pop();
  const trimmed = covered - items.length;

  if (uncovered > 0) {
    notes.push(
      `${uncovered} ${uncovered === 1 ? 'pattern has' : 'patterns have'} nothing available with today's equipment.`,
    );
  }
  if (trimmed > 0) {
    notes.push(
      `${trimmed === 1 ? 'One movement was' : `${trimmed} movements were`} dropped to fit ${minutes} minutes — this goal's rest periods are long.`,
    );
  }
  if (progressed > 0) {
    notes.push(
      `Nothing here takes external load, so ${progressed === 1 ? 'one movement was' : `${progressed} movements were`} stepped up to a harder variation instead.`,
    );
  }

  return { items, estimatedMinutes: estimateMinutes(items), notes };
}

/** Round-robin through several lists: [[a,b],[1,2,3]] becomes [a,1,b,2,3]. */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
}

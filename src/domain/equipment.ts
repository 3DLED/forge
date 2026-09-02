/**
 * Equipment resolution.
 *
 * Two questions get asked constantly and both live here:
 *   "can I do this movement with what I have today?" and
 *   "if not, what should I do instead?"
 *
 * The substitution walk is breadth-first through `substitutes`, so a barbell back squat in
 * a plan degrades to a goblet squat, and then to an air squat, without the plan author
 * having had to enumerate every fallback for every equipment profile.
 */

import type { EquipmentTag, Exercise } from './types';

/** Every exercise needs these implicitly; profiles always contain them. */
const UNIVERSAL: EquipmentTag[] = ['bodyweight', 'floor', 'wall', 'stairs'];

export function canPerform(exercise: Exercise, owned: Iterable<EquipmentTag>): boolean {
  const have = new Set<EquipmentTag>([...UNIVERSAL, ...owned]);
  return exercise.equipment.every((tag) => have.has(tag));
}

export function availableSlugs(
  exercises: Exercise[],
  owned: Iterable<EquipmentTag>,
): Set<string> {
  const have = new Set<EquipmentTag>([...UNIVERSAL, ...owned]);
  return new Set(
    exercises
      .filter((e) => e.equipment.every((tag) => have.has(tag)))
      .map((e) => e.slug),
  );
}

export interface Substitution {
  slug: string;
  /** 0 when the original works as prescribed; higher means further from the intent. */
  distance: number;
}

/**
 * The nearest performable version of `slug`, or null when nothing in the library works.
 * Explores declared substitutes first, then the easier rungs of the progression ladder —
 * a regression is a better answer than an unrelated movement.
 */
export function resolveExercise(
  slug: string,
  bySlug: Map<string, Exercise>,
  available: Set<string>,
  maxDistance = 4,
): Substitution | null {
  if (available.has(slug)) return { slug, distance: 0 };

  const seen = new Set<string>([slug]);
  let frontier = [slug];

  for (let distance = 1; distance <= maxDistance; distance++) {
    const next: string[] = [];

    for (const current of frontier) {
      const exercise = bySlug.get(current);
      if (!exercise) continue;

      for (const candidate of [...exercise.substitutes, ...exercise.progression.easier]) {
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        if (available.has(candidate)) return { slug: candidate, distance };
        next.push(candidate);
      }
    }

    if (next.length === 0) break;
    frontier = next;
  }

  return null;
}

/** Which equipment tags a set of exercises would need that the profile lacks. */
export function missingEquipment(
  exercises: Exercise[],
  owned: Iterable<EquipmentTag>,
): Map<EquipmentTag, number> {
  const have = new Set<EquipmentTag>([...UNIVERSAL, ...owned]);
  const gaps = new Map<EquipmentTag, number>();

  for (const exercise of exercises) {
    for (const tag of exercise.equipment) {
      if (!have.has(tag)) gaps.set(tag, (gaps.get(tag) ?? 0) + 1);
    }
  }

  return new Map([...gaps].sort((a, b) => b[1] - a[1]));
}

/**
 * The nearest load you can actually put on the bar, or pick up off the floor.
 *
 * A percentage is a number; a kettlebell is an object. Told to lift 72.5 kg with a rack of
 * 24s and 32s, the honest answer is one of those two, and prescribing 72.5 is prescribing
 * nothing. Where the loads owned are unknown, the target comes back rounded to the nearest
 * half kilo rather than pretending to a precision nothing can deliver.
 *
 * Ties go heavy. The alternative is a programme that quietly drifts light every time a
 * percentage lands between two bells.
 */
export function roundToAvailableLoad(targetKg: number, availableKg?: number[]): number {
  if (!availableKg || availableKg.length === 0) return Math.round(targetKg * 2) / 2;

  return availableKg.reduce((best, candidate) => {
    const closer = Math.abs(candidate - targetKg) < Math.abs(best - targetKg);
    const tied = Math.abs(candidate - targetKg) === Math.abs(best - targetKg);
    return closer || (tied && candidate > best) ? candidate : best;
  }, availableKg[0]);
}

/**
 * Loads available for a movement, from an equipment profile.
 *
 * Only single-implement kit is meaningful here: a barbell's usable loads depend on which
 * plates are paired with it, which is a different sum. Absent means "no constraint", and the
 * caller rounds to the nearest half kilo instead.
 */
export function loadsForExercise(
  exercise: Exercise,
  availableWeightsKg?: Partial<Record<'kettlebell' | 'dumbbell' | 'plates', number[]>>,
): number[] | undefined {
  if (!availableWeightsKg) return undefined;
  if (exercise.equipment.includes('kettlebell')) return availableWeightsKg.kettlebell;
  if (exercise.equipment.includes('dumbbell')) return availableWeightsKg.dumbbell;
  return undefined;
}

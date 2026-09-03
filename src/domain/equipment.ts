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

import type { EquipmentProfile, EquipmentTag, Exercise } from './types';
import { barbellLoads, hasBarbellLoads } from './rack';

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
export function roundDownToAvailableLoad(targetKg: number, availableKg?: number[]): number {
  if (!availableKg || availableKg.length === 0) return Math.floor(targetKg * 2) / 2;

  const under = availableKg.filter((load) => load <= targetKg);
  // Nothing light enough: the lightest thing you own is the only honest answer.
  return under.length > 0 ? Math.max(...under) : Math.min(...availableKg);
}

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
 * Bells are owned and listed; a barbell's loads are summed from the bar and the plates on it.
 * Absent means "no constraint", and the caller rounds to the nearest half kilo instead — so
 * an empty list has to come back as `undefined` rather than `[]`, or every prescription
 * collapses onto whatever the caller does with nothing to choose from.
 */
export function loadsForExercise(
  exercise: Exercise,
  profile?: Pick<EquipmentProfile, 'availableWeightsKg' | 'barbell'>,
): number[] | undefined {
  if (!profile) return undefined;

  const bells = (loads?: number[]) => (loads && loads.length > 0 ? loads : undefined);

  if (exercise.equipment.includes('kettlebell')) {
    return bells(profile.availableWeightsKg?.kettlebell);
  }
  if (exercise.equipment.includes('dumbbell')) {
    return bells(profile.availableWeightsKg?.dumbbell);
  }
  if (exercise.equipment.includes('barbell') && hasBarbellLoads(profile.barbell)) {
    return barbellLoads(profile.barbell);
  }
  return undefined;
}

/**
 * How much heavier a load has to be before it counts as a different load.
 *
 * Ten grams, which is nothing you could put on a bar and everything you need to survive a
 * unit conversion. A weight typed in pounds and a rack computed in pounds both arrive here
 * as kilos with different trailing digits — 225 lb is 102.0582 one way and 102.06 the other
 * — and a bare `>` reads that as a step up, hands back the same weight, and stalls the
 * ladder on the number it just did.
 */
const DISTINCT_KG = 0.01;

/**
 * The lightest load heavier than this one, or undefined at the top of the rack.
 *
 * With no rack defined anything is loadable, so the NSCA increment applies instead: a couple
 * of kilos, which sits inside their 2-10% guidance for a working weight.
 */
export function nextLoadAbove(kg: number, availableKg?: number[]): number | undefined {
  if (!availableKg || availableKg.length === 0) return Math.round((kg + 2.5) * 2) / 2;
  return availableKg.filter((load) => load > kg + DISTINCT_KG).sort((a, b) => a - b)[0];
}

/** The heaviest load lighter than this one, or undefined at the bottom of the rack. */
export function nextLoadBelow(kg: number, availableKg?: number[]): number | undefined {
  if (!availableKg || availableKg.length === 0) {
    const lighter = Math.round((kg - 2.5) * 2) / 2;
    return lighter > 0 ? lighter : undefined;
  }
  return availableKg.filter((load) => load < kg - DISTINCT_KG).sort((a, b) => b - a)[0];
}

/**
 * Which part of the body a movement trains.
 *
 * Derived from `pattern` rather than stored, for the same reason `categoryOf` derives its
 * answer from equipment: the classification can then never drift out of step with the field
 * that actually decides it. A bicep curl is `pullVertical`, so it is upper body, and it stays
 * upper body no matter who edits the library later.
 *
 * The buckets are deliberately coarse. "Upper / lower / core" is how people decide what to
 * train today; anything finer belongs in the pattern, which is still there underneath.
 */

import type { Exercise, MovementPattern } from './types';

export type BodyRegion = 'upper' | 'lower' | 'core' | 'conditioning' | 'cardio';

const REGION_OF: Record<MovementPattern, BodyRegion> = {
  squat: 'lower',
  hinge: 'lower',
  lunge: 'lower',
  pushHorizontal: 'upper',
  pushVertical: 'upper',
  pullHorizontal: 'upper',
  pullVertical: 'upper',
  core: 'core',
  // Carries and burpees are neither, and calling them "full body" in a builder that also
  // offers a full-body option would be two things wearing one name.
  carry: 'conditioning',
  fullBody: 'conditioning',
  gait: 'cardio',
};

export function regionOf(exercise: Exercise): BodyRegion {
  return REGION_OF[exercise.pattern];
}

/** The regions the workout builder offers. Conditioning and cardio are logged, not generated. */
export const BUILDABLE_REGIONS: BodyRegion[] = ['upper', 'lower', 'core'];

export const REGION_LABELS: Record<BodyRegion, string> = {
  upper: 'Upper body',
  lower: 'Lower body',
  core: 'Core',
  conditioning: 'Conditioning',
  cardio: 'Cardio',
};

/**
 * Which patterns a region is built from, in the order a session should cover them.
 *
 * Upper alternates push and pull rather than doing both pushes first: the antagonist gets its
 * rest for free, which is most of what makes a 45-minute upper day fit into 45 minutes.
 */
export const PATTERNS_IN_REGION: Record<BodyRegion, MovementPattern[]> = {
  upper: ['pushHorizontal', 'pullHorizontal', 'pushVertical', 'pullVertical'],
  lower: ['squat', 'hinge', 'lunge'],
  core: ['core'],
  conditioning: ['fullBody', 'carry'],
  cardio: ['gait'],
};

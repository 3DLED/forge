/**
 * How movements are grouped for browsing.
 *
 * "Strength" is too coarse a bucket to pick from — a push-up and a barbell squat answer very
 * different questions about what you can do right now. The split is derived from the
 * equipment an exercise requires rather than stored as a new modality, for two reasons:
 * `Modality` means something specific elsewhere (it gates weekday availability and plan
 * slots, where strength is strength), and deriving it means the classification can never
 * drift out of step with the equipment tags that actually decide availability.
 */

import type { EquipmentTag, Exercise, Modality } from './types';

export type ExerciseCategory = 'weights' | 'calisthenics' | 'cardio' | 'skill' | 'mobility';

/**
 * Tags that add external resistance.
 *
 * A bench and a rack are deliberately absent: they hold a load rather than being one, so a
 * bench dip and a Bulgarian split squat stay calisthenics. The barbell in a back squat is
 * what makes it weights, not the rack it came off.
 */
const RESISTANCE_TAGS = new Set<EquipmentTag>([
  'barbell', 'plates', 'dumbbell', 'kettlebell', 'trapBar', 'smithMachine',
  'cableMachine', 'latPulldown', 'legPress', 'legCurl', 'legExtension',
  'chestPress', 'rowMachine', 'sled', 'sandbag', 'medicineBall', 'slamBall',
  'wallBall', 'weightVest', 'resistanceBand', 'miniBand', 'battleRopes', 'gripTrainer',
]);

export function categoryOf(exercise: Exercise): ExerciseCategory {
  if (exercise.modality === 'cardio') return 'cardio';
  if (exercise.modality === 'mobility') return 'mobility';
  if (exercise.modality === 'skill') return 'skill';
  return exercise.equipment.some((tag) => RESISTANCE_TAGS.has(tag)) ? 'weights' : 'calisthenics';
}

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  weights: 'Weights',
  calisthenics: 'Calisthenics',
  cardio: 'Cardio',
  skill: 'Skill',
  mobility: 'Mobility',
};

/** Order the filter chips appear in. */
export const CATEGORY_ORDER: ExerciseCategory[] = [
  'weights',
  'calisthenics',
  'cardio',
  'skill',
  'mobility',
];

/** For anywhere still working in modalities — the two strength categories collapse back. */
export function modalityOf(category: ExerciseCategory): Modality {
  if (category === 'weights' || category === 'calisthenics') return 'strength';
  return category;
}

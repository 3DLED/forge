/**
 * Shorthand for declaring seeded exercises.
 *
 * The library is long, so the literal form has to stay readable — a full `Exercise` object
 * per movement would be a thousand lines of boilerplate nobody would maintain. These
 * helpers infer the boring parts (which metrics a set records, which muscles a pattern
 * trains) and let each entry state only what is actually distinctive about it: the kit it
 * needs, what to do instead when you lack that kit, and where it sits on a progression ladder.
 */

import type {
  EquipmentTag,
  Exercise,
  MetricKey,
  Modality,
  MovementPattern,
} from '../../domain/types';

/** Anything here means the movement is externally loaded, so a set records weight. */
const LOADED_TAGS = new Set<EquipmentTag>([
  'barbell', 'plates', 'dumbbell', 'kettlebell', 'trapBar', 'smithMachine',
  'cableMachine', 'latPulldown', 'legPress', 'legCurl', 'legExtension',
  'chestPress', 'rowMachine', 'sled', 'sandbag', 'medicineBall', 'slamBall',
  'wallBall', 'weightVest',
]);

const MUSCLES: Record<MovementPattern, [string[], string[]]> = {
  squat: [['quads', 'glutes'], ['hamstrings', 'core']],
  hinge: [['hamstrings', 'glutes'], ['lower back', 'core']],
  lunge: [['quads', 'glutes'], ['hamstrings', 'core']],
  pushHorizontal: [['chest', 'triceps'], ['shoulders', 'core']],
  pushVertical: [['shoulders', 'triceps'], ['upper back', 'core']],
  pullHorizontal: [['upper back', 'biceps'], ['rear delts', 'forearms']],
  pullVertical: [['lats', 'biceps'], ['upper back', 'forearms']],
  carry: [['forearms', 'core'], ['traps', 'glutes']],
  core: [['core'], ['hip flexors', 'obliques']],
  gait: [['legs', 'cardiovascular'], ['core']],
  fullBody: [['full body'], ['cardiovascular']],
};

export interface ExerciseSpec {
  modality?: Modality;
  /** Overrides the metric inference — use for holds, carries, and anything unusual. */
  metrics?: MetricKey[];
  /** A timed hold rather than reps: plank, dead hang, wall sit. */
  hold?: boolean;
  unilateral?: boolean;
  /** Same stimulus, different equipment. Consulted when the movement is unavailable. */
  subs?: string[];
  /** Progression ladder — how to regress and advance without changing the load. */
  easier?: string[];
  harder?: string[];
  primary?: string[];
  secondary?: string[];
  common?: boolean;
  notes?: string;
}

/** The library entry before the repository stamps ids and timestamps onto it. */
export type SeedExercise = Omit<Exercise, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

function inferMetrics(
  equipment: EquipmentTag[],
  pattern: MovementPattern,
  modality: Modality,
  hold: boolean,
): MetricKey[] {
  if (modality === 'cardio') return ['distanceM', 'timeSec', 'rpe'];
  if (modality === 'mobility') return ['timeSec'];
  if (pattern === 'carry') {
    const loaded = equipment.some((tag) => LOADED_TAGS.has(tag));
    return loaded ? ['weightKg', 'distanceM', 'timeSec'] : ['distanceM', 'timeSec', 'rpe'];
  }
  if (hold) {
    return equipment.some((tag) => LOADED_TAGS.has(tag))
      ? ['weightKg', 'timeSec', 'rpe']
      : ['timeSec', 'rpe'];
  }
  return equipment.some((tag) => LOADED_TAGS.has(tag))
    ? ['weightKg', 'reps', 'rpe']
    : ['reps', 'rpe'];
}

export function ex(
  slug: string,
  name: string,
  pattern: MovementPattern,
  equipment: EquipmentTag[],
  spec: ExerciseSpec = {},
): SeedExercise {
  const modality = spec.modality ?? 'strength';
  const [primary, secondary] = MUSCLES[pattern];
  return {
    slug,
    name,
    modality,
    pattern,
    equipment,
    metrics: spec.metrics ?? inferMetrics(equipment, pattern, modality, spec.hold ?? false),
    primaryMuscles: spec.primary ?? primary,
    secondaryMuscles: spec.secondary ?? secondary,
    unilateral: spec.unilateral ?? false,
    substitutes: spec.subs ?? [],
    progression: { easier: spec.easier ?? [], harder: spec.harder ?? [] },
    isCustom: false,
    common: spec.common ?? false,
    notes: spec.notes,
  };
}

/** Cardio shorthand — the modality and metrics are always the same. */
export function cardio(
  slug: string,
  name: string,
  equipment: EquipmentTag[],
  spec: ExerciseSpec = {},
): SeedExercise {
  return ex(slug, name, 'gait', equipment, { ...spec, modality: 'cardio' });
}

export function mobility(
  slug: string,
  name: string,
  equipment: EquipmentTag[],
  spec: ExerciseSpec = {},
): SeedExercise {
  return ex(slug, name, 'fullBody', equipment, { ...spec, modality: 'mobility' });
}

/**
 * Equipment vocabulary and the starter profiles.
 *
 * An equipment profile answers one question: *what can I actually do today?* Switching
 * profiles re-resolves every prescribed movement through its substitutes, so the plan
 * survives a trip, a closed gym, or a new rack at home without being rebuilt.
 */

import type { EquipmentProfile, EquipmentTag } from '../../domain/types';

/** Present in every profile — you always have these, so nothing needs to declare them. */
export const ALWAYS_AVAILABLE: EquipmentTag[] = ['bodyweight', 'floor', 'wall', 'stairs'];

export const EQUIPMENT_LABELS: Record<EquipmentTag, string> = {
  bodyweight: 'Bodyweight',
  floor: 'Floor space',
  wall: 'A wall',
  stairs: 'Stairs',
  barbell: 'Barbell',
  plates: 'Plates',
  rack: 'Squat rack',
  bench: 'Bench',
  dumbbell: 'Dumbbells',
  kettlebell: 'Kettlebells',
  trapBar: 'Trap bar',
  pullupBar: 'Pull-up bar',
  dipBars: 'Dip bars',
  rings: 'Gymnastic rings',
  suspensionTrainer: 'Suspension trainer',
  ropeClimb: 'Climbing rope',
  cableMachine: 'Cable machine',
  latPulldown: 'Lat pulldown',
  legPress: 'Leg press',
  legCurl: 'Leg curl',
  legExtension: 'Leg extension',
  chestPress: 'Chest press machine',
  rowMachine: 'Row machine',
  smithMachine: 'Smith machine',
  hyperextension: 'Back extension bench',
  gluteHamRaise: 'Glute-ham raise',
  rowErg: 'Rowing erg',
  skiErg: 'SkiErg',
  bikeErg: 'Stationary bike',
  airBike: 'Air bike',
  treadmill: 'Treadmill',
  sled: 'Sled',
  jumpRope: 'Jump rope',
  box: 'Plyo box or step',
  medicineBall: 'Medicine ball',
  slamBall: 'Slam ball',
  wallBall: 'Wall ball',
  sandbag: 'Sandbag or bucket',
  battleRopes: 'Battle ropes',
  resistanceBand: 'Resistance bands',
  miniBand: 'Mini bands',
  abWheel: 'Ab wheel',
  gripTrainer: 'Grip trainer',
  weightVest: 'Weight vest',
  road: 'Road',
  trail: 'Trail',
  track: 'Track',
  hill: 'A hill',
  pool: 'Pool',
  openWater: 'Open water',
};

/** How the equipment picker is grouped in settings. */
export const EQUIPMENT_GROUPS: { label: string; tags: EquipmentTag[] }[] = [
  { label: 'Free weights', tags: ['kettlebell', 'dumbbell', 'barbell', 'plates', 'rack', 'bench', 'trapBar'] },
  { label: 'Hanging & bars', tags: ['pullupBar', 'dipBars', 'rings', 'suspensionTrainer', 'ropeClimb'] },
  {
    label: 'Machines',
    tags: ['cableMachine', 'latPulldown', 'chestPress', 'rowMachine', 'legPress', 'legCurl', 'legExtension', 'smithMachine', 'hyperextension', 'gluteHamRaise'],
  },
  { label: 'Conditioning', tags: ['rowErg', 'skiErg', 'bikeErg', 'airBike', 'treadmill', 'sled', 'jumpRope', 'battleRopes'] },
  { label: 'Odd objects', tags: ['box', 'sandbag', 'medicineBall', 'slamBall', 'wallBall', 'weightVest', 'abWheel', 'gripTrainer'] },
  { label: 'Bands', tags: ['resistanceBand', 'miniBand'] },
  { label: 'Places to train', tags: ['road', 'trail', 'track', 'hill', 'pool', 'openWater'] },
];

export type SeedEquipmentProfile = Omit<
  EquipmentProfile,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/**
 * Starter profiles. Deliberately spans the whole range, because most people move between
 * at least two of these in a normal month.
 */
export const SEED_EQUIPMENT_PROFILES: SeedEquipmentProfile[] = [
  {
    name: 'Bodyweight only',
    items: [...ALWAYS_AVAILABLE],
    isDefault: false,
  },
  {
    name: 'Road & bodyweight',
    items: [...ALWAYS_AVAILABLE, 'road', 'trail', 'hill'],
    isDefault: true,
  },
  {
    name: 'Home — kettlebells',
    items: [...ALWAYS_AVAILABLE, 'kettlebell', 'resistanceBand', 'road', 'hill', 'box'],
    availableWeightsKg: { kettlebell: [] },
    isDefault: false,
  },
  {
    name: 'Full gym',
    items: [
      ...ALWAYS_AVAILABLE,
      'barbell', 'plates', 'rack', 'bench', 'dumbbell', 'kettlebell', 'trapBar',
      'pullupBar', 'dipBars', 'cableMachine', 'latPulldown', 'chestPress', 'rowMachine',
      'legPress', 'legCurl', 'legExtension', 'smithMachine', 'hyperextension',
      'rowErg', 'bikeErg', 'treadmill', 'jumpRope', 'box', 'medicineBall', 'abWheel',
      'resistanceBand', 'miniBand', 'road', 'track',
    ],
    isDefault: false,
  },
];

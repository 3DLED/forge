/**
 * Seeded workout blueprints — the sessions that plan templates are assembled from.
 *
 * These are written against the *ideal* movement for each slot. Nothing here checks your
 * equipment: substitution happens when a plan is applied, so one `push-a` template covers
 * a barbell bench in a gym and a decline push-up in a hotel room without needing two
 * versions of the same workout.
 *
 * Ids are deliberately absent. They are minted when a template is materialised onto a date,
 * so a planned session owns its prescription outright and editing this file never reaches
 * backwards into a plan you already started.
 */

import type { BlockStyle, LoadSpec, Modality, SuggestSpec } from '../../domain/types';

export interface SeedItem {
  ex: string;
  sets?: number;
  reps?: number | [number, number];
  timeSec?: number;
  distanceM?: number;
  paceSecPerKm?: number;
  /** Shorthand for a target-effort load spec. */
  rpe?: number;
  /** Explicit load, when RPE is not the right language for it. */
  load?: LoadSpec;
  restSec?: number;
  notes?: string;
}

export interface SeedBlock {
  style: BlockStyle;
  label?: string;
  rounds?: number;
  restSec?: number;
  capSec?: number;
  items: SeedItem[];
}

export interface SeedSessionTemplate {
  slug: string;
  name: string;
  modalities: Modality[];
  estimatedMinutes: number;
  blocks: SeedBlock[];
  notes?: string;
  /**
   * A session with no movements, to be filled on the day it happens.
   *
   * Never used by the seeded library — every template here names what it wants. Custom plans
   * synthesise one of these for a day left open deliberately.
   */
  suggest?: SuggestSpec;
}

// --- block helpers ---------------------------------------------------------

const straight = (items: SeedItem[], label?: string): SeedBlock => ({ style: 'straight', label, items });

const superset = (items: SeedItem[], label?: string, restSec = 90): SeedBlock => ({
  style: 'superset',
  label,
  restSec,
  items,
});

const circuit = (rounds: number, items: SeedItem[], label?: string, restSec = 60): SeedBlock => ({
  style: 'circuit',
  label,
  rounds,
  restSec,
  items,
});

const intervals = (rounds: number, items: SeedItem[], label?: string, restSec = 90): SeedBlock => ({
  style: 'interval',
  label,
  rounds,
  restSec,
  items,
});

const steady = (item: SeedItem, label?: string): SeedBlock => ({ style: 'steady', label, items: [item] });

const tpl = (
  slug: string,
  name: string,
  modalities: Modality[],
  estimatedMinutes: number,
  blocks: SeedBlock[],
  notes?: string,
): SeedSessionTemplate => ({ slug, name, modalities, estimatedMinutes, blocks, notes });

// ---------------------------------------------------------------------------

export const SEED_SESSION_TEMPLATES: SeedSessionTemplate[] = [
  // --- full body -----------------------------------------------------------
  tpl('full-body-a', 'Full Body A', ['strength'], 50, [
    straight([{ ex: 'back-squat', sets: 3, reps: [5, 8], rpe: 8, restSec: 150 }], 'Main'),
    superset(
      [
        { ex: 'bench-press', sets: 3, reps: [6, 10], rpe: 8 },
        { ex: 'barbell-row', sets: 3, reps: [8, 12], rpe: 8 },
      ],
      'Upper pair',
    ),
    superset(
      [
        { ex: 'romanian-deadlift', sets: 3, reps: [8, 12], rpe: 7 },
        { ex: 'plank', sets: 3, timeSec: 45 },
      ],
      'Posterior + core',
    ),
  ]),

  tpl('full-body-b', 'Full Body B', ['strength'], 50, [
    straight([{ ex: 'deadlift', sets: 3, reps: [3, 5], rpe: 8, restSec: 180 }], 'Main'),
    superset(
      [
        { ex: 'overhead-press', sets: 3, reps: [6, 10], rpe: 8 },
        { ex: 'pull-up', sets: 3, reps: [5, 10], rpe: 8 },
      ],
      'Vertical pair',
    ),
    superset(
      [
        { ex: 'bulgarian-split-squat', sets: 3, reps: [8, 12], rpe: 7 },
        { ex: 'farmers-carry', sets: 3, distanceM: 40 },
      ],
      'Single leg + carry',
    ),
  ]),

  tpl('full-body-c', 'Full Body C', ['strength'], 50, [
    straight([{ ex: 'front-squat', sets: 3, reps: [6, 10], rpe: 8, restSec: 150 }], 'Main'),
    superset(
      [
        { ex: 'db-bench-press', sets: 3, reps: [8, 12], rpe: 8 },
        { ex: 'inverted-row', sets: 3, reps: [8, 15], rpe: 8 },
      ],
      'Upper pair',
    ),
    superset(
      [
        { ex: 'kb-swing', sets: 3, reps: 15, rpe: 7 },
        { ex: 'hanging-knee-raise', sets: 3, reps: [8, 15] },
      ],
      'Hinge + core',
    ),
  ]),

  // --- push / pull / legs --------------------------------------------------
  tpl('push-a', 'Push A', ['strength'], 55, [
    straight([{ ex: 'bench-press', sets: 4, reps: [5, 8], rpe: 8, restSec: 150 }], 'Main'),
    straight([{ ex: 'overhead-press', sets: 3, reps: [6, 10], rpe: 8, restSec: 120 }], 'Secondary'),
    superset(
      [
        { ex: 'db-incline-press', sets: 3, reps: [8, 12], rpe: 8 },
        { ex: 'lateral-raise', sets: 3, reps: [12, 15], rpe: 8 },
      ],
      'Accessory',
    ),
    straight([{ ex: 'dip', sets: 3, reps: [6, 12], rpe: 8 }], 'Finisher'),
  ]),

  tpl('pull-a', 'Pull A', ['strength'], 55, [
    straight([{ ex: 'pull-up', sets: 4, reps: [5, 10], rpe: 8, restSec: 150 }], 'Main'),
    straight([{ ex: 'barbell-row', sets: 3, reps: [6, 10], rpe: 8, restSec: 120 }], 'Secondary'),
    superset(
      [
        { ex: 'seated-cable-row', sets: 3, reps: [10, 12], rpe: 8 },
        { ex: 'face-pull', sets: 3, reps: [12, 20], rpe: 7 },
      ],
      'Accessory',
    ),
    superset(
      [
        { ex: 'bicep-curl', sets: 3, reps: [10, 15], rpe: 8 },
        { ex: 'hanging-leg-raise', sets: 3, reps: [8, 12] },
      ],
      'Finisher',
    ),
  ]),

  tpl('legs-a', 'Legs A', ['strength'], 55, [
    straight([{ ex: 'back-squat', sets: 4, reps: [5, 8], rpe: 8, restSec: 180 }], 'Main'),
    straight([{ ex: 'romanian-deadlift', sets: 3, reps: [8, 10], rpe: 8, restSec: 120 }], 'Secondary'),
    superset(
      [
        { ex: 'walking-lunge', sets: 3, reps: 20, rpe: 7 },
        { ex: 'leg-curl', sets: 3, reps: [10, 15], rpe: 8 },
      ],
      'Accessory',
    ),
    straight([{ ex: 'plank', sets: 3, timeSec: 45 }], 'Core'),
  ]),

  tpl('push-b', 'Push B', ['strength'], 50, [
    straight([{ ex: 'overhead-press', sets: 4, reps: [5, 8], rpe: 8, restSec: 150 }], 'Main'),
    straight([{ ex: 'incline-bench-press', sets: 3, reps: [8, 10], rpe: 8, restSec: 120 }], 'Secondary'),
    superset(
      [
        { ex: 'push-up', sets: 3, reps: [10, 20], rpe: 8 },
        { ex: 'band-lateral-raise', sets: 3, reps: [15, 20], rpe: 7 },
      ],
      'Accessory',
    ),
  ]),

  tpl('pull-b', 'Pull B', ['strength'], 50, [
    straight([{ ex: 'deadlift', sets: 3, reps: [3, 5], rpe: 8, restSec: 180 }], 'Main'),
    straight([{ ex: 'lat-pulldown', sets: 3, reps: [8, 12], rpe: 8, restSec: 120 }], 'Secondary'),
    superset(
      [
        { ex: 'db-row', sets: 3, reps: [10, 12], rpe: 8 },
        { ex: 'band-pull-apart', sets: 3, reps: 20, rpe: 6 },
      ],
      'Accessory',
    ),
    straight([{ ex: 'dead-hang', sets: 3, timeSec: 30 }], 'Grip'),
  ]),

  tpl('legs-b', 'Legs B', ['strength'], 50, [
    straight([{ ex: 'front-squat', sets: 4, reps: [6, 8], rpe: 8, restSec: 150 }], 'Main'),
    straight([{ ex: 'hip-thrust', sets: 3, reps: [8, 12], rpe: 8, restSec: 120 }], 'Secondary'),
    superset(
      [
        { ex: 'bulgarian-split-squat', sets: 3, reps: [8, 12], rpe: 8 },
        { ex: 'nordic-curl', sets: 3, reps: [4, 8], rpe: 8 },
      ],
      'Accessory',
    ),
  ]),

  // --- upper / lower -------------------------------------------------------
  tpl('upper-a', 'Upper A', ['strength'], 55, [
    superset(
      [
        { ex: 'bench-press', sets: 4, reps: [5, 8], rpe: 8 },
        { ex: 'barbell-row', sets: 4, reps: [6, 10], rpe: 8 },
      ],
      'Main pair',
      150,
    ),
    superset(
      [
        { ex: 'overhead-press', sets: 3, reps: [8, 10], rpe: 8 },
        { ex: 'pull-up', sets: 3, reps: [5, 10], rpe: 8 },
      ],
      'Vertical pair',
    ),
    superset(
      [
        { ex: 'bicep-curl', sets: 3, reps: [10, 15], rpe: 8 },
        { ex: 'bench-dip', sets: 3, reps: [10, 15], rpe: 8 },
      ],
      'Arms',
    ),
  ]),

  tpl('lower-a', 'Lower A', ['strength'], 55, [
    straight([{ ex: 'back-squat', sets: 4, reps: [5, 8], rpe: 8, restSec: 180 }], 'Main'),
    straight([{ ex: 'romanian-deadlift', sets: 3, reps: [8, 10], rpe: 8, restSec: 120 }], 'Secondary'),
    superset(
      [
        { ex: 'reverse-lunge', sets: 3, reps: 20, rpe: 7 },
        { ex: 'hanging-knee-raise', sets: 3, reps: [10, 15] },
      ],
      'Accessory',
    ),
  ]),

  tpl('upper-b', 'Upper B', ['strength'], 55, [
    superset(
      [
        { ex: 'overhead-press', sets: 4, reps: [5, 8], rpe: 8 },
        { ex: 'lat-pulldown', sets: 4, reps: [8, 12], rpe: 8 },
      ],
      'Main pair',
      150,
    ),
    superset(
      [
        { ex: 'db-incline-press', sets: 3, reps: [8, 12], rpe: 8 },
        { ex: 'chest-supported-row', sets: 3, reps: [10, 12], rpe: 8 },
      ],
      'Secondary pair',
    ),
    straight([{ ex: 'farmers-carry', sets: 3, distanceM: 40 }], 'Carry'),
  ]),

  tpl('lower-b', 'Lower B', ['strength'], 55, [
    straight([{ ex: 'deadlift', sets: 4, reps: [3, 5], rpe: 8, restSec: 180 }], 'Main'),
    straight([{ ex: 'bulgarian-split-squat', sets: 3, reps: [8, 12], rpe: 8, restSec: 120 }], 'Secondary'),
    superset(
      [
        { ex: 'leg-curl', sets: 3, reps: [10, 15], rpe: 8 },
        { ex: 'side-plank', sets: 3, timeSec: 30 },
      ],
      'Accessory',
    ),
  ]),

  // --- bodyweight / minimal kit -------------------------------------------
  tpl('bodyweight-full-a', 'Bodyweight Full Body A', ['strength'], 40, [
    circuit(
      4,
      [
        { ex: 'push-up', reps: [8, 15], rpe: 8 },
        { ex: 'inverted-row', reps: [8, 12], rpe: 8 },
        { ex: 'air-squat', reps: 20, rpe: 7 },
        { ex: 'plank', timeSec: 45 },
      ],
      'Circuit',
      75,
    ),
  ]),

  tpl('bodyweight-full-b', 'Bodyweight Full Body B', ['strength'], 40, [
    circuit(
      4,
      [
        { ex: 'pike-push-up', reps: [6, 12], rpe: 8 },
        { ex: 'pull-up', reps: [3, 8], rpe: 8 },
        { ex: 'bulgarian-split-squat', reps: [8, 12], rpe: 8 },
        { ex: 'hollow-hold', timeSec: 30 },
      ],
      'Circuit',
      75,
    ),
  ]),

  tpl('kettlebell-full-body', 'Kettlebell Full Body', ['strength'], 40, [
    straight([{ ex: 'turkish-get-up', sets: 5, reps: 1, rpe: 7, restSec: 60 }], 'Warm-up / skill'),
    circuit(
      4,
      [
        { ex: 'kb-swing', reps: 15, rpe: 8 },
        { ex: 'goblet-squat', reps: 10, rpe: 8 },
        { ex: 'kb-press', reps: 8, rpe: 8 },
        { ex: 'kb-row', reps: 10, rpe: 8 },
      ],
      'Complex',
      90,
    ),
    straight([{ ex: 'suitcase-carry', sets: 3, distanceM: 40 }], 'Carry'),
  ]),

  // --- running -------------------------------------------------------------
  tpl('run-easy', 'Easy Run', ['cardio'], 40, [
    steady({ ex: 'easy-run', distanceM: 5000, rpe: 4 }),
  ], 'Conversational the whole way. If you cannot talk, slow down.'),

  tpl('run-recovery', 'Recovery Run', ['cardio'], 30, [
    steady({ ex: 'recovery-run', distanceM: 4000, rpe: 3 }),
  ], 'Deliberately slow. The point is blood flow, not fitness.'),

  tpl('run-long', 'Long Run', ['cardio'], 75, [
    steady({ ex: 'long-run', distanceM: 12000, rpe: 5 }),
  ], 'The most important session of any distance plan. Steady effort, not steady pace.'),

  tpl('run-tempo', 'Tempo Run', ['cardio'], 45, [
    steady({ ex: 'easy-run', distanceM: 1600, rpe: 3 }, 'Warm-up'),
    steady({ ex: 'tempo-run', distanceM: 5000, rpe: 7 }, 'Tempo'),
    steady({ ex: 'easy-run', distanceM: 1600, rpe: 3 }, 'Cool-down'),
  ], 'Comfortably hard — about one-hour race effort.'),

  tpl('run-intervals', 'Track Intervals', ['cardio'], 45, [
    steady({ ex: 'easy-run', distanceM: 1600, rpe: 3 }, 'Warm-up'),
    intervals(6, [{ ex: 'interval-run', distanceM: 400, rpe: 9 }], '400s', 90),
    steady({ ex: 'easy-run', distanceM: 1600, rpe: 3 }, 'Cool-down'),
  ]),

  tpl('run-hills', 'Hill Repeats', ['cardio'], 40, [
    steady({ ex: 'easy-run', distanceM: 1600, rpe: 3 }, 'Warm-up'),
    intervals(8, [{ ex: 'hill-repeats', timeSec: 45, rpe: 9 }], 'Hills', 120),
    steady({ ex: 'easy-run', distanceM: 1600, rpe: 3 }, 'Cool-down'),
  ], 'Strength work disguised as running. Jog down as the recovery.'),

  tpl('run-race-pace', 'Race-Pace Run', ['cardio'], 50, [
    steady({ ex: 'easy-run', distanceM: 1600, rpe: 3 }, 'Warm-up'),
    steady({ ex: 'race-pace-run', distanceM: 6000, rpe: 7 }, 'At goal pace'),
    steady({ ex: 'easy-run', distanceM: 1200, rpe: 3 }, 'Cool-down'),
  ]),

  tpl('run-trail', 'Trail Run', ['cardio'], 60, [
    steady({ ex: 'trail-run', distanceM: 8000, rpe: 5 }),
  ], 'Uneven ground and real climbing — where OCR fitness actually gets built.'),

  // --- hybrid and obstacle racing -----------------------------------------
  tpl('ocr-grip-finisher', 'Grip & Hang Finisher', ['strength', 'skill'], 15, [
    circuit(
      3,
      [
        { ex: 'dead-hang', timeSec: 30 },
        { ex: 'farmers-carry', distanceM: 40 },
        { ex: 'bottoms-up-carry', distanceM: 20 },
      ],
      'Grip circuit',
      60,
    ),
  ], 'Grip fails before the arms do on a rig. Train it last, when you are already tired.'),

  tpl('ocr-burpee-conditioning', 'Burpee Conditioning', ['strength', 'cardio'], 20, [
    intervals(10, [{ ex: 'burpee', reps: 10, rpe: 8 }], 'EMOM burpees', 0),
  ], 'Every failed obstacle costs 30 burpees. Practise them tired.'),

  tpl('ocr-long-run-finisher', 'Long Run + Obstacle Finisher', ['cardio', 'strength'], 90, [
    steady({ ex: 'trail-run', distanceM: 12000, rpe: 5 }, 'Long run'),
    circuit(
      3,
      [
        { ex: 'burpee', reps: 15, rpe: 8 },
        { ex: 'bucket-carry', distanceM: 50 },
        { ex: 'dead-hang', timeSec: 30 },
      ],
      'On tired legs',
      90,
    ),
  ], 'Obstacles come at mile eight, not mile zero. This rehearses that.'),

  tpl('hybrid-race-sim', 'Race Simulation', ['cardio', 'strength'], 70, [
    intervals(
      4,
      [
        { ex: 'easy-run', distanceM: 1000, rpe: 7 },
        { ex: 'ski-erg', distanceM: 500, rpe: 8 },
        { ex: 'sled-push', distanceM: 25, rpe: 8 },
        { ex: 'burpee-broad-jump', reps: 15, rpe: 8 },
      ],
      'Run + station',
      0,
    ),
  ], 'Run a kilometre, hit a station, repeat. The compromised running is the whole event.'),

  tpl('hybrid-race-strength', 'Race Strength', ['strength'], 50, [
    straight([{ ex: 'back-squat', sets: 4, reps: [6, 8], rpe: 8, restSec: 150 }], 'Main'),
    circuit(
      4,
      [
        { ex: 'wall-ball', reps: 20, rpe: 8 },
        { ex: 'box-step-over', reps: 20, rpe: 7 },
        { ex: 'farmers-carry', distanceM: 50 },
      ],
      'Stations',
      90,
    ),
  ]),

  tpl('conditioning-circuit', 'Conditioning Circuit', ['strength', 'cardio'], 30, [
    circuit(
      5,
      [
        { ex: 'kb-swing', reps: 15, rpe: 8 },
        { ex: 'burpee', reps: 10, rpe: 8 },
        { ex: 'mountain-climber', reps: 30, rpe: 7 },
      ],
      'AMRAP-ish',
      60,
    ),
  ]),

  // --- mobility ------------------------------------------------------------
  tpl('mobility-flow', 'Mobility Flow', ['mobility'], 20, [
    circuit(
      2,
      [
        { ex: 'worlds-greatest-stretch', timeSec: 60 },
        { ex: 'ninety-ninety', timeSec: 60 },
        { ex: 'couch-stretch', timeSec: 60 },
        { ex: 'cat-cow', timeSec: 45 },
        { ex: 'downward-dog', timeSec: 45 },
      ],
      'Flow',
      15,
    ),
  ]),
];

export const SEED_SESSION_TEMPLATE_BY_SLUG = new Map(
  SEED_SESSION_TEMPLATES.map((t) => [t.slug, t]),
);

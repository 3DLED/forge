/**
 * Core domain model.
 *
 * Two rules hold this together:
 *
 * 1. **Exercises declare their metrics.** A set is a bag of values, not `{weight, reps}`.
 *    That is what lets a barbell squat, a 400 m repeat, and a plank share one table,
 *    one logging UI, and one history query.
 *
 * 2. **Prescription and performance are separate records.** A `PlannedSession` snapshots
 *    what you were told to do; a `LoggedSession` records what happened. Editing a template
 *    must never rewrite the past.
 *
 * Storage is canonical SI — kilograms, meters, seconds. Display converts (see units.ts).
 */

/** ULID: lexicographically sortable, generated offline, safe for a future sync. */
export type Id = string;

/** ISO-8601 instant, e.g. "2026-08-26T14:03:00.000Z". */
export type Instant = string;

/** Local calendar day, "YYYY-MM-DD". Never a Date — timezones ruin date-keyed data. */
export type DayKey = string;

/**
 * Every stored record carries these. The repository layer stamps them on write, so a
 * later sync engine has timestamps and tombstones to work with and nothing has to migrate.
 */
export interface Entity {
  id: Id;
  createdAt: Instant;
  updatedAt: Instant;
  /** Soft delete. Rows are never hard-removed, so a sync can propagate the deletion. */
  deletedAt?: Instant | null;
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type Modality = 'strength' | 'cardio' | 'mobility' | 'skill';

/** Coarse movement buckets — enough to balance a week, not a kinesiology textbook. */
export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'pushHorizontal'
  | 'pushVertical'
  | 'pullHorizontal'
  | 'pullVertical'
  | 'carry'
  | 'core'
  | 'gait'
  | 'fullBody';

/**
 * What an exercise requires. An `EquipmentProfile` is a set of these; an exercise is
 * available when the profile is a superset of its requirements.
 */
export type EquipmentTag =
  // always available
  | 'bodyweight' | 'floor' | 'wall' | 'stairs'
  // free weights
  | 'barbell' | 'plates' | 'rack' | 'bench' | 'dumbbell' | 'kettlebell' | 'trapBar'
  // suspension / hanging
  | 'pullupBar' | 'dipBars' | 'rings' | 'suspensionTrainer' | 'ropeClimb'
  // machines
  | 'cableMachine' | 'latPulldown' | 'legPress' | 'legCurl' | 'legExtension'
  | 'chestPress' | 'rowMachine' | 'smithMachine' | 'hyperextension' | 'gluteHamRaise'
  // conditioning kit
  | 'rowErg' | 'skiErg' | 'bikeErg' | 'airBike' | 'treadmill' | 'sled' | 'jumpRope'
  | 'box' | 'medicineBall' | 'slamBall' | 'wallBall' | 'sandbag' | 'battleRopes'
  | 'resistanceBand' | 'miniBand' | 'abWheel' | 'gripTrainer' | 'weightVest'
  // places
  | 'road' | 'trail' | 'track' | 'hill' | 'pool' | 'openWater';

/** The values a set can hold. An exercise declares which ones it uses. */
export type MetricKey =
  | 'weightKg'
  | 'reps'
  | 'timeSec'
  | 'distanceM'
  | 'rpe'
  | 'rounds';

/** Perceived effort, 1-10 (RPE) — the one number that spans running and lifting. */
export type Rpe = number;

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

export interface Exercise extends Entity {
  name: string;
  /** Stable slug for seeded movements, so plan templates can reference them by name. */
  slug: string;
  modality: Modality;
  pattern: MovementPattern;
  /** All tags must be present in an equipment profile for this to be available. */
  equipment: EquipmentTag[];
  /** Which values a set of this exercise records. Drives the logging UI. */
  metrics: MetricKey[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  /** True when left and right are trained separately (affects volume math). */
  unilateral: boolean;
  /**
   * Same stimulus, different kit. Used when an equipment profile makes this unavailable —
   * the first available substitute wins.
   */
  substitutes: string[];
  /**
   * Progression ladder, for when you cannot add load: harder leverage, less assistance,
   * slower tempo. This is how bodyweight and fixed-weight training actually progresses.
   */
  progression: { easier: string[]; harder: string[] };
  /** Seeded library entries are read-only; user-created ones are editable. */
  isCustom: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Prescription
// ---------------------------------------------------------------------------

/** How the items in a block relate to each other in time. */
export type BlockStyle =
  /** Sets of one exercise, rest between. Classic lifting. */
  | 'straight'
  /** Alternate between items with little rest. */
  | 'superset'
  /** All items back to back, repeated for rounds. */
  | 'circuit'
  /** Every minute on the minute. */
  | 'emom'
  /** As many rounds as possible in a time cap. */
  | 'amrap'
  /** Work / recovery repeats — 6x400 m, 8x30 s hill. */
  | 'interval'
  /** One continuous effort — an easy run, a long ride. */
  | 'steady';

/** How the load for a prescribed item is expressed. */
export type LoadSpec =
  | { kind: 'absolute'; weightKg: number }
  | { kind: 'percentOfMax'; percent: number }
  | { kind: 'rpe'; rpe: Rpe }
  | { kind: 'bodyweight' }
  | { kind: 'unspecified' };

export interface PrescribedItem {
  id: Id;
  exerciseSlug: string;
  sets?: number;
  /** Fixed target, or a range like 8-12. */
  reps?: number;
  repRange?: [number, number];
  timeSec?: number;
  distanceM?: number;
  /** Target pace in seconds per kilometer, for runs and ergs. */
  paceSecPerKm?: number;
  load: LoadSpec;
  restSec?: number;
  notes?: string;
}

export interface Block {
  id: Id;
  style: BlockStyle;
  label?: string;
  /** Rounds through the items, for circuit / emom / interval. */
  rounds?: number;
  /** Recovery between rounds, or between work bouts in an interval. */
  restSec?: number;
  /** Time cap, for amrap / emom. */
  capSec?: number;
  items: PrescribedItem[];
}

/** A reusable workout blueprint: "Push A", "Long run + OCR finisher". */
export interface SessionTemplate extends Entity {
  name: string;
  slug?: string;
  modalities: Modality[];
  estimatedMinutes?: number;
  blocks: Block[];
  /** Seeded templates from the plan library are read-only until copied. */
  isCustom: boolean;
  notes?: string;
}

/** The prescription as it exists on a specific day — a snapshot, never a reference. */
export interface Prescription {
  name: string;
  modalities: Modality[];
  estimatedMinutes?: number;
  blocks: Block[];
  notes?: string;
  /** Which template it came from, for provenance only. Never read back for content. */
  sourceTemplateId?: Id;
}

export type PlannedStatus = 'planned' | 'completed' | 'skipped' | 'moved';

export interface PlannedSession extends Entity {
  date: DayKey;
  planId?: Id;
  prescription: Prescription;
  status: PlannedStatus;
  /** Set when status is 'moved' — where it went. */
  movedToDate?: DayKey;
  loggedSessionId?: Id;
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

/** The recorded values of one set. Keys are constrained to the exercise's metrics. */
export type MetricValues = Partial<Record<MetricKey, number>>;

export interface LoggedSet {
  id: Id;
  exerciseSlug: string;
  /** Which prescribed block/item this satisfies, when the session came from a plan. */
  blockId?: Id;
  itemId?: Id;
  setIndex: number;
  values: MetricValues;
  /** For unilateral work logged per side. */
  side?: 'left' | 'right';
  completed: boolean;
  notes?: string;
}

export interface LoggedSession extends Entity {
  date: DayKey;
  plannedSessionId?: Id;
  name: string;
  startedAt?: Instant;
  endedAt?: Instant;
  sets: LoggedSet[];
  /** Session RPE x duration is the one training-load number that spans all modalities. */
  sessionRpe?: Rpe;
  durationMin?: number;
  feel?: 'great' | 'good' | 'ok' | 'rough' | 'bad';
  notes?: string;
}

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

export interface EquipmentProfile extends Entity {
  name: string;
  items: EquipmentTag[];
  /** Which loads you actually own, for kettlebells/dumbbells — drives real prescriptions. */
  availableWeightsKg?: Partial<Record<'kettlebell' | 'dumbbell' | 'plates', number[]>>;
  isDefault: boolean;
}

/** Weekday, 0 = Sunday, matching Date.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AvailabilityRule {
  weekday: Weekday;
  /** Empty means no training that weekday. */
  allowedModalities: Modality[];
  maxMinutes?: number;
}

export interface CalendarException extends Entity {
  startDate: DayKey;
  endDate: DayKey;
  kind: 'blackout' | 'restricted';
  /** For 'restricted' — what is still allowed. */
  allowedModalities?: Modality[];
  reason?: string;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type GoalKind = 'race' | 'strength' | 'physique' | 'general';

export interface Goal {
  kind: GoalKind;
  /** "5k", "marathon", "hyrox", "spartan-beast", "back-squat-315" — free-form. */
  label: string;
  eventDate?: DayKey;
  targetMetric?: { metric: MetricKey; value: number; exerciseSlug?: string };
}

export interface PlanPhase {
  id: Id;
  name: string;
  weeks: number;
  focus: string;
  /** 0 = no deload; 4 = every fourth week is a deload. */
  deloadEvery?: number;
}

export interface Plan extends Entity {
  name: string;
  goal: Goal;
  startDate: DayKey;
  endDate?: DayKey;
  phases: PlanPhase[];
  daysPerWeek: number;
  equipmentProfileId?: Id;
  isActive: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type UnitSystem = 'imperial' | 'metric';

export interface Profile extends Entity {
  displayName: string;
  units: UnitSystem;
  bodyweightKg?: number;
  activeEquipmentProfileId?: Id;
  availability: AvailabilityRule[];
  /** First day of the week for calendar rendering. */
  weekStartsOn: Weekday;
  /** Visual direction — see `src/ui/themes.ts`. Absent means the default. */
  theme?: string;
}

/** Bodyweight, resting HR, and anything else tracked over time rather than per set. */
export interface BodyMetric extends Entity {
  date: DayKey;
  kind: 'bodyweightKg' | 'restingHr' | 'sleepHours' | 'custom';
  customLabel?: string;
  value: number;
}

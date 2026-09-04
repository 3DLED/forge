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

/**
 * Perceived effort, 1-10 — the one number that spans running and lifting.
 *
 * Called RPE in the literature and in this code; the interface says "Effort" everywhere,
 * because that is the word people can actually answer without translating first. The stored
 * field names stay `rpe` / `sessionRpe`: renaming them buys nothing and breaks every backup
 * file already written.
 */
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
  /**
   * A staple most people reach for. Surfaced above the long tail in the picker so a bench
   * press is not buried between "Bear Crawl" and "Bench Dip" by an alphabetical sort.
   */
  common: boolean;
  /**
   * Isolation and support work — curls, raises, face pulls, glute bridges.
   *
   * Not a judgement about value, only about ordering: a suggested session should open with
   * the movement that justifies the session and finish with the ones that top it up.
   */
  isAccessory: boolean;
  /**
   * Difficulty, 1 (easiest) to 5, calibrated across the whole library rather than within a
   * pattern. Drives the ladder you see when swapping a movement for an easier or harder one.
   * See `domain/difficulty.ts` for why this is authored rather than derived.
   */
  level: number;
  /**
   * Share of your own bodyweight this movement makes you move, per rep. 0 when the load is
   * entirely external.
   *
   * Without it every calisthenics set scores zero volume, because volume was weight x reps
   * and a push-up records no weight. Set for unloaded movements and for the weighted variants
   * of them, where added load stacks on top of bodyweight rather than replacing it.
   */
  bodyweightFactor: number;
  /**
   * How to perform it, for movements you added yourself.
   *
   * The seeded library keeps its write-ups in a static table rather than in the database —
   * static reference material nobody edits, so it costs no storage and no migration when a
   * cue is reworded. A movement you invented has nowhere in that table to live, so it carries
   * its own. Absent on seeded entries, which still read from the table.
   */
  coaching?: {
    setup: string;
    cues: string[];
    fault: string;
  };
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
  /** Fixed work against the clock; the score is the time. */
  | 'forTime'
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
  /**
   * Rest prescribed after this set, when something prescribed one.
   *
   * Lives on the set rather than the exercise because it is a property of the *dose*, not of
   * the movement: the same back squat rests three minutes for a heavy triple and forty-five
   * seconds inside a circuit. Absent means the logger's default.
   */
  restSec?: number;
  notes?: string;
  /**
   * For AMRAP and EMOM work: seconds from the start of the effort at which each round was
   * completed. `values.rounds` is the count; this is the pacing behind it — whether you held
   * 90-second rounds or fell off a cliff at round six.
   */
  roundSplitsSec?: number[];
}

/** How a logged block is scored. */
export type LoggedBlockStyle = 'amrap' | 'emom' | 'forTime';

/**
 * A timed container for several movements — an AMRAP, an EMOM, a for-time piece.
 *
 * The movements inside it are ordinary `LoggedSet`s carrying this block's `id` in their
 * `blockId`, so nothing downstream needs to learn a second shape: volume, history, and the
 * exercise library all keep working on the sets exactly as before. What lives here is only
 * what belongs to the block as a whole — the clock, and the rounds it produced.
 *
 * Within a block a set states what one round contains ("10 burpees"), not one performance of
 * it. Ticking every movement on every round would be unusable at the pace these are done;
 * the round count is the record.
 */
export interface LoggedBlock {
  id: Id;
  style: LoggedBlockStyle;
  /** A name, when this is a workout worth recognising again. */
  label?: string;
  /**
   * The saved workout this came from.
   *
   * This is what makes "am I getting better at Cindy" answerable. Comparing any AMRAP to any
   * other AMRAP is meaningless — the score depends entirely on what was in the round — so
   * results are only ever compared within the same source.
   */
  sourceTemplateId?: Id;
  /** Time cap, for AMRAP and capped for-time work. */
  capSec?: number;
  /** Interval length, for EMOM. */
  intervalSec?: number;
  /** Prescribed rounds, for EMOM. */
  targetRounds?: number;
  /** Rounds actually completed. */
  rounds?: number;
  /** Seconds from block start at which each round was completed. */
  roundSplitsSec?: number[];
  /** Total working seconds once the block has been run. */
  timeSec?: number;
  notes?: string;
}

export interface LoggedSession extends Entity {
  date: DayKey;
  plannedSessionId?: Id;
  name: string;
  /** Timed containers. Sets reference these by `blockId`. */
  blocks?: LoggedBlock[];
  /**
   * Equipment available for this session only, overriding the profile default.
   *
   * Stored as a tag list rather than a profile reference: what you had in a hotel gym on a
   * given Tuesday should stay true in the record even if you later rename or edit the
   * profile you picked it from.
   */
  equipmentTags?: EquipmentTag[];
  startedAt?: Instant;
  endedAt?: Instant;
  /**
   * Session stopwatch. `elapsedSec` is time banked from previous runs; `runningSince` is set
   * while the clock is going. Storing an instant rather than a countdown means the elapsed
   * time stays true across a reload, a backgrounded tab, or a phone that went to sleep —
   * all of which happen constantly during a real session.
   */
  elapsedSec?: number;
  runningSince?: Instant | null;
  sets: LoggedSet[];
  /** Effort x duration is the one training-load number that spans all modalities. */
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
  /** Which bells you actually own — drives real prescriptions. */
  availableWeightsKg?: Partial<Record<'kettlebell' | 'dumbbell', number[]>>;
  /**
   * The bar and what goes on it. Kept apart from the bell lists because its loads are
   * derived rather than owned — see `barbellLoads`.
   */
  barbell?: BarbellRack;
  isDefault: boolean;
}

/**
 * A movement inside a plan that grows week by week.
 *
 * The one kind of progression a plan has to carry itself. Load autoregulates — the logger
 * reads what you actually lifted and suggests more — but you cannot autoregulate your way to
 * a twenty kilometre long run. That distance is scheduled, weeks in advance, and the schedule
 * is the plan's job.
 *
 * Compounding rather than linear, because that is how distance is actually built and how the
 * conventional ceiling is expressed: eight to ten per cent a week, with a cap so the curve
 * levels off at the distance you were aiming for rather than running away.
 */
export interface SlotProgression {
  /** Which movement inside the session to scale. */
  exerciseSlug: string;
  metric: 'distanceM' | 'timeSec';
  startValue: number;
  /** Compounding weekly increase. 0.08 is the conventional 8-10% ceiling. */
  weeklyRate: number;
  maxValue?: number;
}

/**
 * A plan you laid out yourself, kept to be used again.
 *
 * Stored as a week rather than as a calendar: seven days, each either a session or not, and a
 * number of times to repeat it. That is the same shape the seeded plans already have — a
 * weekly pattern the generator lays onto dates — so a custom plan goes through exactly the
 * machinery everything else does, and gets equipment substitution, deload weeks and conflict
 * reporting without any of it being written twice.
 *
 * What differs is that its days are pinned. A seeded plan says "three strength days" and lets
 * the app find room; yours says Wednesday.
 */
export interface CustomPlanDay {
  weekday: Weekday;
  /**
   * `open` was never filled in, `rest` was chosen. Nothing is scheduled for either — the
   * difference is whether reopening the plan should look like a decision or a gap.
   */
  kind: 'open' | 'rest' | 'template' | 'saved';
  /** For `template`: one of the built-in session templates, by slug. */
  templateSlug?: string;
  /**
   * For `saved`: a copy of one of your saved workouts, taken when the plan was built.
   *
   * Snapshotted rather than referenced, which is what saving a workout already does. A plan
   * cannot then be broken by deleting the workout it was built from, and editing that workout
   * later does not silently redefine a plan you have been following for six weeks.
   */
  workout?: {
    name: string;
    modalities: Modality[];
    estimatedMinutes?: number;
    blocks: Block[];
  };
  /**
   * A distance or time on this day that grows each week.
   *
   * Set per day rather than per plan, because it is a fact about one session: the long run
   * builds, the strength day does not, and both live in the same week.
   */
  ramp?: SlotProgression;
}

export interface CustomPlan extends Entity {
  name: string;
  goal: GoalKind;
  /** null means ongoing — repeats until you stop it. */
  weeks: number | null;
  /** Always seven, one per weekday, so the builder and the record are the same thing. */
  days: CustomPlanDay[];
  notes?: string;
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

import type { PrimaryGoal } from './goals';
import type { BarbellRack } from './rack';

export type UnitSystem = 'imperial' | 'metric';

export interface Profile extends Entity {
  displayName: string;
  units: UnitSystem;
  bodyweightKg?: number;
  activeEquipmentProfileId?: Id;
  availability: AvailabilityRule[];
  /** First day of the week for calendar rendering. */
  weekStartsOn: Weekday;
  /**
   * The fraction of a true maximum that percentage-based loads are worked from, as a
   * percentage. Ninety by default — see the note in `loading.ts`.
   */
  trainingMaxPercent?: number;
  /**
   * What you are training for, standing until you change it.
   *
   * On the profile rather than on a plan because three things read it and only one of them is
   * a plan: the session suggester, plan generation, and resolving a percentage of your max.
   * Absent means nothing has been asked yet, which behaves as 'general' — no bias at all.
   */
  primaryGoal?: PrimaryGoal;
  /** Visual direction — see `src/ui/themes.ts`. Absent means the default. */
  theme?: string;
  /**
   * Show an effort box on every set, as well as the one for the whole session.
   *
   * Off unless asked for. It is a load-selection tool for autoregulated strength work —
   * you hit a 9 on a triple you wanted at 8, so the next set comes down — and it only
   * earns the extra box per row if you actually act on it between sets. Everyone else
   * wants the single figure at the end, which is the one training load is built from.
   */
  perSetEffort?: boolean;
}

/** Bodyweight, resting HR, and anything else tracked over time rather than per set. */
export interface BodyMetric extends Entity {
  date: DayKey;
  kind: 'bodyweightKg' | 'restingHr' | 'sleepHours' | 'custom';
  customLabel?: string;
  value: number;
}

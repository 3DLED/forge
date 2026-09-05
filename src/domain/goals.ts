/**
 * What you are training for, and what the app does about it.
 *
 * This is the athlete's standing answer, not a plan's. It lives on the profile because three
 * different things need it and only one of them is a plan: the session suggester (which
 * otherwise just assumes you want hypertrophy), plan generation, and — later — resolving a
 * percentage of your max into a weight.
 *
 * It is deliberately separate from `GoalKind`, which classifies a *plan template* (a race
 * block, a strength block). One describes the athlete, the other describes the programme, and
 * collapsing them would mean a marathon plan could not be run by someone chasing fat loss.
 *
 * ## On fat loss
 *
 * The obvious implementation — lighter weights, higher reps, short rest, "burn more" — is
 * gym convention and the evidence runs against it. In an energy deficit, resistance training
 * preserves lean mass and continues to build strength, and *load* is what does the
 * preserving; converting the lifting into light circuits gives that up for no established
 * fat-loss benefit. Nor is interval work superior to steady state once energy expenditure is
 * matched, so the mode of conditioning should be whatever gets done consistently.
 *
 * So fat loss here keeps the heavy scheme and adds conditioning volume, and the app says so
 * where you pick it rather than leaving heavy triples looking like a bug.
 */

import type { GoalKind, Modality } from './types';
import type { TrainingGoal } from './generator';

export type PrimaryGoal = 'strength' | 'muscle' | 'endurance' | 'fatLoss' | 'general';

export interface PrimaryGoalSpec {
  label: string;
  /**
   * The label with the verb taken off, for a row of chips.
   *
   * "Build muscle" and "Build endurance" side by side spend most of their width saying the
   * same word, and on a phone that is the difference between five options fitting and having
   * to scroll a row to find out what the other two are.
   */
  short: string;
  /** One line under the option, describing the training. */
  blurb: string;
  /** Which of the three lifting doses this goal trains at. */
  lifting: TrainingGoal;
  /** Extra conditioning sessions added to a week, where the plan permits it. */
  extraConditioning: number;
  /** Plan kinds this goal surfaces first in the library. */
  prefers: GoalKind[];
  /** Said out loud where the goal is chosen, when the programming needs explaining. */
  note?: string;
}

export const PRIMARY_GOALS: Record<PrimaryGoal, PrimaryGoalSpec> = {
  strength: {
    label: 'Get stronger',
    short: 'Strength',
    blurb: 'Heavy, low reps, long rest.',
    lifting: 'strength',
    extraConditioning: 0,
    prefers: ['strength', 'general'],
  },
  muscle: {
    label: 'Build muscle',
    short: 'Muscle',
    blurb: 'Moderate loads and rep ranges, with enough rest to repeat them.',
    lifting: 'muscle',
    extraConditioning: 0,
    prefers: ['physique', 'strength'],
  },
  endurance: {
    label: 'Build endurance',
    short: 'Endurance',
    blurb: 'Lighter, higher reps, short rest, and more time on your feet.',
    lifting: 'endurance',
    extraConditioning: 1,
    prefers: ['race', 'general'],
  },
  fatLoss: {
    label: 'Lose fat',
    short: 'Fat loss',
    blurb: 'Heavy lifting kept intact, with conditioning added around it.',
    lifting: 'strength',
    extraConditioning: 1,
    prefers: ['general', 'physique'],
    note: 'The lifting stays heavy on purpose — load is what protects muscle while you are losing weight, and light high-rep circuits give that up for nothing. The conditioning and the eating do the fat loss.',
  },
  general: {
    label: 'General fitness',
    short: 'General',
    blurb: 'No particular bias. Plans and suggestions are left as written.',
    lifting: 'muscle',
    extraConditioning: 0,
    prefers: ['general'],
  },
};

/**
 * Minutes of conditioning a single session should finish with, for this goal.
 *
 * The session-level counterpart to `extraConditioning`, which says how many conditioning
 * *sessions* a week a plan should gain. Ten minutes is short enough to actually get done at
 * the end of a lift and long enough to be worth logging.
 */
export const CONDITIONING_FINISHER_MIN = 10;

export function conditioningMinutesFor(goal: PrimaryGoal | undefined): number {
  return goalSpec(goal).extraConditioning > 0 ? CONDITIONING_FINISHER_MIN : 0;
}

export const PRIMARY_GOAL_ORDER: PrimaryGoal[] = [
  'strength',
  'muscle',
  'endurance',
  'fatLoss',
  'general',
];

/** The default before anyone has answered: no bias, nothing reshaped. */
export const DEFAULT_PRIMARY_GOAL: PrimaryGoal = 'general';

export function goalSpec(goal: PrimaryGoal | undefined): PrimaryGoalSpec {
  return PRIMARY_GOALS[goal ?? DEFAULT_PRIMARY_GOAL];
}

/**
 * Whether a plan may have conditioning added to it.
 *
 * A plan built around an event already has its conditioning decided — that is most of what a
 * race plan *is* — so adding to it would be overriding a choice you made deliberately rather
 * than expressing a preference. Only open-ended plans are adjusted.
 */
export function acceptsExtraConditioning(templateGoal: GoalKind, tags: string[] = []): boolean {
  if (templateGoal === 'race') return false;
  return !tags.includes('hybridRace') && !tags.includes('ocr');
}

/** How many conditioning sessions a week should gain, given the goal and the plan. */
export function extraConditioningFor(
  goal: PrimaryGoal | undefined,
  templateGoal: GoalKind,
  tags: string[] = [],
): number {
  if (!acceptsExtraConditioning(templateGoal, tags)) return 0;
  return goalSpec(goal).extraConditioning;
}

/**
 * Orders plan templates so the ones matching the goal come first.
 *
 * A stable sort on preference rank alone: within a rank the library's own ordering survives,
 * which is what keeps the catalogue from reshuffling into something unrecognisable every time
 * the goal changes.
 */
export function rankByGoal<T extends { goal: GoalKind }>(
  templates: T[],
  goal: PrimaryGoal | undefined,
): T[] {
  const prefers = goalSpec(goal).prefers;
  const rank = (template: T) => {
    const index = prefers.indexOf(template.goal);
    return index === -1 ? prefers.length : index;
  };
  return [...templates].sort((a, b) => rank(a) - rank(b));
}

/** The modality an added conditioning session occupies. */
export const CONDITIONING_MODALITY: Modality = 'cardio';

/**
 * The session an added conditioning slot runs.
 *
 * Every run template records exactly one modality, which matters: a session claiming both
 * strength and cardio, placed on a cardio-only day, is one the rest-day reshuffle would
 * immediately report as not fitting the week it was just generated for.
 */
export const CONDITIONING_TEMPLATE_SLUG = 'run-easy';

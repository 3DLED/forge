/**
 * Training around something that hurts.
 *
 * The premise is that an injury almost never stops you training — it stops you training *one
 * area*. Hurt a shoulder and your squats and your runs are untouched, and a log that responds
 * by clearing the whole calendar is one you work around rather than use. So an injury names a
 * region, and only the sessions that load that region step aside.
 *
 * Two things this deliberately does not do:
 *
 * - **It never blocks anything.** Affected work is flagged, not forbidden. The app has no idea
 *   how your shoulder feels this morning and should not pretend otherwise.
 * - **It offers no clinical opinion.** The suggested rest window comes from the severity *you*
 *   picked and nothing else. It is a starting number to adjust, not a prognosis.
 */

import type { DayKey, Exercise, Id, Prescription } from './types';
import type { BodyRegion } from './regions';
import { regionOf } from './regions';
import { addDays } from './dates';

export type InjurySeverity = 'twinge' | 'sore' | 'unusable';

export interface SeveritySpec {
  label: string;
  /** What the level means, in terms of what you can do rather than how bad it is. */
  blurb: string;
  /** Days of rest proposed as a starting point. Always editable. */
  suggestedDays: number;
}

export const SEVERITIES: Record<InjurySeverity, SeveritySpec> = {
  twinge: {
    label: 'Twinge',
    blurb: 'Noticeable, but it does not stop you.',
    suggestedDays: 3,
  },
  sore: {
    label: 'Sore',
    blurb: 'It limits what you can do with the area.',
    suggestedDays: 10,
  },
  unusable: {
    label: 'Cannot use it',
    blurb: 'Training this area is off the table for now.',
    suggestedDays: 21,
  },
};

export const SEVERITY_ORDER: InjurySeverity[] = ['twinge', 'sore', 'unusable'];

export interface Injury {
  id: Id;
  /** Which area steps aside. */
  region: BodyRegion;
  /** Yours, in your words: "left shoulder", "right achilles". */
  label: string;
  severity: InjurySeverity;
  /** When it happened. */
  startDate: DayKey;
  /** Rest through this day, inclusive. */
  restUntil: DayKey;
  /** How it happened, when it is worth remembering. */
  cause?: string;
  /** The workout it happened in, when logged from one. */
  sessionId?: Id;
  /** The movement that did it. */
  exerciseSlug?: string;
  /** Set when you called it healed. After this it affects nothing. */
  resolvedDate?: DayKey;
  notes?: string;
}

/** The return date a severity proposes, counting from when it happened. */
export function suggestedRestUntil(startDate: DayKey, severity: InjurySeverity): DayKey {
  return addDays(startDate, SEVERITIES[severity].suggestedDays);
}

/**
 * Still resting from this one.
 *
 * Resolving it ends the injury regardless of the date, which is the "it healed faster than
 * expected" case; otherwise the rest window decides.
 */
export function isActive(injury: Injury, today: DayKey): boolean {
  if (injury.resolvedDate) return false;
  return today <= injury.restUntil;
}

export function activeInjuries(injuries: Injury[], today: DayKey): Injury[] {
  return injuries.filter((injury) => isActive(injury, today));
}

/** Whether a movement loads the area that hurts. */
export function affectsExercise(injury: Injury, exercise: Exercise | undefined): boolean {
  return exercise ? regionOf(exercise) === injury.region : false;
}

/** The injuries, if any, that a movement runs into. */
export function injuriesAffecting(
  injuries: Injury[],
  exercise: Exercise | undefined,
  today: DayKey,
): Injury[] {
  if (!exercise) return [];
  return activeInjuries(injuries, today).filter((injury) => affectsExercise(injury, exercise));
}

/**
 * Whether a planned session asks you to load the injured area.
 *
 * One affected movement is enough. A session is done as a whole, and "do the session but skip
 * the two movements that hurt" is a judgement call for the day, not something worth encoding
 * into whether the session is scheduled.
 */
export function affectsPrescription(
  injury: Injury,
  prescription: Prescription,
  exerciseBySlug: Map<string, Exercise>,
): boolean {
  return prescription.blocks.some((block) =>
    block.items.some((item) => affectsExercise(injury, exerciseBySlug.get(item.exerciseSlug))),
  );
}

export interface RestPlanEntry<T> {
  session: T;
  injury: Injury;
}

export interface RestPlan<T> {
  /** Sessions inside the window that load the injured area. */
  affected: RestPlanEntry<T>[];
  /** Sessions inside the window that do not, and carry on as planned. */
  unaffected: number;
}

/**
 * Which planned sessions an injury should stand down, and which carry on.
 *
 * Only future, unstarted sessions are considered: a session already completed is a record of
 * something that happened, and one already skipped needs no further skipping.
 */
export function planRest<
  T extends { date: DayKey; status: string; prescription: Prescription },
>(options: {
  injury: Injury;
  sessions: T[];
  exerciseBySlug: Map<string, Exercise>;
  from: DayKey;
}): RestPlan<T> {
  const { injury, sessions, exerciseBySlug, from } = options;

  const inWindow = sessions.filter(
    (session) =>
      session.status === 'planned' && session.date >= from && session.date <= injury.restUntil,
  );

  const affected: RestPlanEntry<T>[] = [];
  let unaffected = 0;

  for (const session of inWindow) {
    if (affectsPrescription(injury, session.prescription, exerciseBySlug)) {
      affected.push({ session, injury });
    } else {
      unaffected++;
    }
  }

  return { affected, unaffected };
}

/**
 * Sessions stood down for an injury that can now be picked back up.
 *
 * The "it healed faster" case. Only sessions still in the future are offered: bringing back
 * one whose day has already passed would put work on a day you cannot train on any more.
 */
export function recoverable<T extends { date: DayKey; status: string }>(
  sessions: T[],
  from: DayKey,
): T[] {
  return sessions.filter((session) => session.status === 'skipped' && session.date >= from);
}

/**
 * How hard a movement is, and what else you could do instead.
 *
 * The library already knows which movements are alternatives to each other — they share a
 * `pattern`, which is the field that decides equipment substitution and session balance, so
 * it cannot drift out of step with either. What it did not know is the order.
 *
 * That order has to be authored. It was tempting to derive it from the `progression` ladder,
 * since that data is already there, but the graph is far too sparse to yield a total order:
 * walking it produces "weighted chin-up is easier than a negative pull-up", and its connected
 * components merge barbell bench, ring dips and push-ups into a single 26-movement blob. A
 * wrong ordering presented confidently is worse than none, so the levels are declared.
 *
 * Levels are calibrated across the whole library, not within a pattern — a level 4 pull is
 * meant to be about as demanding as a level 4 push. That is what lets "show me something
 * easier" mean the same thing wherever it is asked.
 */

import type { Exercise } from './types';

/** 1 (easiest) to 5 (hardest). 3 is the version most people mean by the movement's name. */
export type Level = 1 | 2 | 3 | 4 | 5;

export const DEFAULT_LEVEL: Level = 3;

export function levelOf(exercise: Exercise): Level {
  const value = exercise.level;
  return value != null && value >= 1 && value <= 5 ? (value as Level) : DEFAULT_LEVEL;
}

/**
 * Three bands rather than five labels: "beginner / intermediate / advanced" is how people
 * describe themselves, while five levels is finer than that vocabulary supports. The five
 * are kept for ordering, the three for reading.
 */
export type Band = 'beginner' | 'intermediate' | 'advanced';

export function bandOf(level: Level): Band {
  if (level <= 2) return 'beginner';
  if (level === 3) return 'intermediate';
  return 'advanced';
}

export const BAND_LABELS: Record<Band, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const BAND_ORDER: Band[] = ['beginner', 'intermediate', 'advanced'];

/** A filled-then-hollow run of pips, so the level reads at a glance without a legend. */
export function levelPips(level: Level): string {
  return '●'.repeat(level) + '○'.repeat(5 - level);
}

export interface Variation {
  exercise: Exercise;
  level: Level;
  band: Band;
  /** Performable with the equipment on hand. */
  available: boolean;
  /** Same movement as the one being swapped. */
  current: boolean;
}

/**
 * Every alternative to a movement, easiest first.
 *
 * Includes the movement itself, so the list reads as a ladder with your current rung marked
 * rather than as a menu of things that are not what you are doing. Unavailable movements stay
 * in — dimmed — for the same reason the picker keeps them: hiding a movement you know exists
 * makes the app look broken, while showing it greyed teaches where the ladder goes next.
 */
export function variationsOf(
  exercise: Exercise,
  exercises: Exercise[],
  available: Set<string>,
): Variation[] {
  return exercises
    .filter((candidate) => candidate.pattern === exercise.pattern && candidate.modality === exercise.modality)
    .map((candidate) => {
      const level = levelOf(candidate);
      return {
        exercise: candidate,
        level,
        band: bandOf(level),
        available: available.has(candidate.slug),
        current: candidate.slug === exercise.slug,
      };
    })
    .sort(
      (a, b) =>
        a.level - b.level ||
        Number(b.available) - Number(a.available) ||
        a.exercise.name.localeCompare(b.exercise.name),
    );
}

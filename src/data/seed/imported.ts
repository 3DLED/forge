/**
 * The imported catalogue, as seeded movements.
 *
 * A thin adapter over the generated `catalogue.ts`, kept apart from it so the generated file
 * stays pure data and this stays hand-written. Everything interesting is a decision the
 * importer already made; what is left here is the shape change, plus two things that are
 * cheaper to do in TypeScript than to bake into a million-character literal:
 *
 * - **Metrics** come from `inferMetrics`, the same function the curated library uses. A set of
 *   an imported movement therefore records exactly what an equivalent curated one would, and
 *   the logging screen needs no idea where the movement came from.
 * - **Coaching** is the catalogue's instructions, carried inline. Curated movements read from
 *   the authored table in `coaching.ts`, which is terse, imperative and has a "watch for"
 *   line the catalogue has no field for. Rather than dilute that table with 1,300 generic
 *   entries, imported movements bring their own, which is what `Exercise.coaching` is for.
 */

import { CATALOGUE, type CatalogueEntry } from './catalogue';
import { inferMetrics, type SeedExercise } from './define';

/**
 * The catalogue's instructions in the shape the info sheet already renders.
 *
 * The last step of every ExerciseDB write-up is some variant of "repeat for the desired
 * number of repetitions", which is true of every exercise ever performed and so tells a
 * reader nothing. It is dropped, and the step before it becomes the fault line — not because
 * it is a fault, but because the sheet's third slot is the last thing read and the final cue
 * is the most useful thing to leave someone with.
 */
function coachingFrom(entry: CatalogueEntry): SeedExercise['coaching'] {
  const steps = entry.instructions.filter(
    (step) => !/^repeat (for|the)/i.test(step.trim()),
  );
  if (steps.length === 0) return undefined;

  const [setup, ...rest] = steps;
  return {
    setup,
    cues: rest.length > 0 ? rest : [setup],
    // No equivalent field in the catalogue, and inventing one would be putting words in
    // somebody's mouth about how a movement goes wrong.
    fault: '',
  };
}

function toSeed(entry: CatalogueEntry): SeedExercise {
  const hold = entry.modality === 'mobility';
  return {
    slug: entry.slug,
    name: entry.name,
    modality: entry.modality,
    pattern: entry.pattern,
    equipment: entry.equipment,
    metrics: entry.metrics ?? inferMetrics(entry.equipment, entry.pattern, entry.modality, hold),
    primaryMuscles: entry.primary,
    secondaryMuscles: entry.secondary,
    unilateral: entry.unilateral,
    // Relationships between movements, which the catalogue does not express. Empty means the
    // swap sheet offers nothing here rather than something wrong.
    substitutes: [],
    progression: { easier: [], harder: [] },
    isCustom: false,
    // The long tail by definition: the generator ranks staples above these, which is the
    // whole reason importing them is safe.
    common: false,
    isAccessory: entry.accessory,
    // Forge's levels are authored across the library so a ladder can be walked end to end.
    // A guess per movement would corrupt that ordering rather than extend it; 3 is "no
    // opinion", which is the truth.
    level: 3,
    bodyweightFactor: entry.bodyweightFactor,
    coaching: coachingFrom(entry),
    description: entry.description || undefined,
  };
}

export const IMPORTED_EXERCISES: SeedExercise[] = CATALOGUE.map(toSeed);

/** Slugs that came from the catalogue, so the coaching audit can skip them. */
export const IMPORTED_SLUGS = new Set(IMPORTED_EXERCISES.map((e) => e.slug));

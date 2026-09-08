/**
 * Pictures of the movements.
 *
 * The most-asked-for thing in every round of testing, and the one part of this app whose
 * content cannot be written — somebody has to draw it. These come from a licensed set
 * (ExerciseDB), which shapes three decisions that would otherwise look arbitrary:
 *
 * **They are referenced, never embedded.** EULA 2026.2 §9 permits displaying, embedding,
 * resizing and reformatting the visuals inside the app; §12 forbids distributing the raw
 * files to any third party. An export that inlined a GIF would be exactly that — performed by
 * the user, in a file this app wrote. So exports carry the slug and each install resolves the
 * picture from its own copy, which is why this module deals in ids and URLs rather than data.
 *
 * **Only the movements Forge has.** The purchased set is 1,394 exercises and 530 MB; Forge's
 * library is 234, and the overlap is smaller still. `tools/build_exercise_media` copies across
 * only what it matched, which is why this is megabytes rather than hundreds of them.
 *
 * **They are not precached.** Everything else in this app is, because opening with no network
 * is the premise. Images are the exception: adding tens of megabytes to the install to make a
 * reference picture available offline is the wrong trade on a phone. They cache as they are
 * viewed, so the movements you actually train stay available and the rest cost nothing.
 */

import { EXERCISE_MEDIA } from './exerciseMediaMap';

/**
 * Where this movement's animation lives, or null when there is not one.
 *
 * Null is the ordinary case, not an error: custom movements have no picture, and neither do
 * the ones the licensed set does not cover — carries, most of the running, and anything with
 * a sandbag. Everything that calls this has to read well with nothing there.
 */
export function exerciseMediaUrl(slug: string): string | null {
  const id = EXERCISE_MEDIA[slug];
  if (!id) return null;
  // Relative, like every other asset here, so the app still works from a Pages subpath.
  return `${import.meta.env.BASE_URL}exercise-media/${id}.gif`;
}

/** Whether a picture exists, for laying out around one without fetching it. */
export function hasExerciseMedia(slug: string): boolean {
  return EXERCISE_MEDIA[slug] != null;
}

/** How much of the library is illustrated — shown when reviewing coverage. */
export function mediaCoverage(): number {
  return Object.keys(EXERCISE_MEDIA).length;
}

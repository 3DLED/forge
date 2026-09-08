/**
 * Pictures of the movements.
 *
 * The most-asked-for thing in every round of testing, and the one part of this app whose
 * content cannot be written — somebody has to draw it. These come from a licensed set
 * (ExerciseDB), which shapes three decisions that would otherwise look arbitrary:
 *
 * **They are referenced, never embedded.** A share file, a plan export and a backup all carry
 * exercises, and the licence permits displaying the images in the app while forbidding
 * redistributing the files. An export that inlined a GIF would be redistribution, sent by the
 * user, in a file the app wrote. So exports carry the slug and each install resolves the
 * picture from its own copy — which is also why this module deals in ids and URLs rather than
 * in data.
 *
 * **Only the movements Forge has.** The purchased set is 1,394 exercises; Forge's library is
 * 234, and the overlap is smaller still. At 180 pixels a GIF is about 120 KB, so the whole set
 * is around 165 MB and the part we can use is a fraction of that. `tools/build_exercise_media`
 * copies across only what it matched.
 *
 * **They are not precached.** Everything else in this app is, because opening with no network
 * is the premise. Images are the exception: adding tens of megabytes to the install to make a
 * reference picture available offline is the wrong trade on a phone. They cache as they are
 * viewed, so the movements you actually train stay available and the rest cost nothing.
 */

import { EXERCISE_MEDIA } from './exerciseMediaMap';

/** The size that gets shipped. Drawn at about 150 CSS pixels, so 180 covers a 2× screen. */
const SIZE = 180;

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
  return `${import.meta.env.BASE_URL}exercise-media/${id}-${SIZE}.gif`;
}

/** Whether a picture exists, for laying out around one without fetching it. */
export function hasExerciseMedia(slug: string): boolean {
  return EXERCISE_MEDIA[slug] != null;
}

/** How much of the library is illustrated — shown when reviewing coverage. */
export function mediaCoverage(): number {
  return Object.keys(EXERCISE_MEDIA).length;
}

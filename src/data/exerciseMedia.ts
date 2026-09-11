/**
 * Pictures of the movements.
 *
 * The most-asked-for thing in every round of testing, and the one part of this app whose
 * content cannot be written — somebody has to draw it. These come from a licensed set
 * (ExerciseDB), which shapes the decisions here that would otherwise look arbitrary:
 *
 * **They are referenced, never embedded.** EULA 2026.2 §9 permits displaying, embedding,
 * resizing and reformatting the visuals inside the app; §12 forbids distributing the raw
 * files to any third party. An export that inlined a picture would be exactly that —
 * performed by the user, in a file this app wrote. So exports carry the slug and each install
 * resolves the picture from its own copy, which is why this module deals in ids and URLs.
 *
 * **Two ways to find one, because the library came from two places.** The imported catalogue
 * states the set's id per entry, so those movements carry `mediaId` and need no lookup. The
 * curated library was authored here and has no id of its own, so it is matched by slug through
 * the table `tools/build_exercise_media.py` generates. Between them the whole library is
 * covered except the movements the set simply does not have — the carries, the sled work, and
 * most of the running.
 *
 * **They ship in the bundle, as WebP.** This used to say the opposite: that images were the
 * one thing not precached, because tens of megabytes to make a reference picture available
 * offline was the wrong trade. That reasoning was about a web app with a network behind it. A
 * Capacitor build serves from the device and has no origin to fetch a missing picture from, so
 * the choice is carry them or do without — and doing without is what shipped to TestFlight,
 * where every illustration was a broken image. Animated WebP at 270px is what makes carrying
 * them reasonable: the full set costs about a third of what the GIFs did.
 */

import { EXERCISE_MEDIA, SHOWN_WITH } from './exerciseMediaMap';
import type { Exercise } from '../domain/types';

/** Enough of a movement to find its picture. */
type Illustrated = Pick<Exercise, 'slug' | 'mediaId'>;

function mediaIdOf({ slug, mediaId }: Illustrated): string | undefined {
  return mediaId ?? EXERCISE_MEDIA[slug];
}

/**
 * Where this movement's animation lives, or null when there is not one.
 *
 * Null is the ordinary case, not an error: custom movements have no picture, and neither do
 * the ones the licensed set does not cover. Everything that calls this has to read well with
 * nothing there.
 */
export function exerciseMediaUrl(exercise: Illustrated): string | null {
  const id = mediaIdOf(exercise);
  if (!id) return null;
  // Relative, like every other asset here, so the app still works from a Pages subpath.
  return `${import.meta.env.BASE_URL}exercise-media/${id}.webp`;
}

/** Whether a picture exists, for laying out around one without fetching it. */
export function hasExerciseMedia(exercise: Illustrated): boolean {
  return mediaIdOf(exercise) != null;
}

/**
 * True when the picture shows different kit to the one the movement calls for.
 *
 * Eight kettlebell movements are illustrated with a dumbbell, because the licensed set has no
 * kettlebell version and the movement is the same shape either way — a reverse lunge is a
 * reverse lunge whatever is hanging off your hands. The swap is fine; doing it silently is
 * not, because somebody looking up a movement they do not know cannot tell.
 *
 * Every substitution today is a dumbbell, which is why the caption is one fixed sentence
 * rather than built from the table. `SHOWN_WITH` in the generated map says which implement
 * each one actually shows; a future substitution that is not a dumbbell needs a second string
 * here, and the table is where you would notice.
 */
export function showsDifferentKit(exercise: Illustrated): boolean {
  return SHOWN_WITH[exercise.slug] != null && mediaIdOf(exercise) != null;
}

/**
 * Where a movement's write-up comes from.
 *
 * Two sources, and the distinction is deliberate. Seeded movements keep theirs in a static
 * table: reference material nobody edits, so it costs no storage, no migration when a cue is
 * reworded, and nothing to sync. A movement you added yourself has no entry there, so it
 * carries its own on the record.
 *
 * Everything else asks this rather than either source, so no screen has to know which is which.
 */

import { coachingFor, type Coaching } from '../data/seed/coaching';
import type { Exercise } from './types';

export function coachingOf(exercise: Exercise): Coaching | undefined {
  return exercise.coaching ?? coachingFor(exercise.slug);
}

export type { Coaching };

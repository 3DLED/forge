/**
 * The application's typed repositories. Feature code imports from here, never from Dexie.
 */

import { db, type StoredLoggedSession } from '../db/db';
import { createRepo } from '../db/repo';

/**
 * Logged sessions carry a derived list of the movements they contain so that
 * "show me every set of front squats" is an index lookup rather than a full scan.
 * See the note at the top of `db.ts`.
 */
function withExerciseIndex(session: StoredLoggedSession): StoredLoggedSession {
  return {
    ...session,
    exerciseSlugs: [...new Set(session.sets.map((set) => set.exerciseSlug))],
  };
}

export const exerciseRepo = createRepo(db.exercises, 'exercises');
export const templateRepo = createRepo(db.templates, 'templates');
export const plannedSessionRepo = createRepo(db.plannedSessions, 'plannedSessions');
export const loggedSessionRepo = createRepo(db.loggedSessions, 'loggedSessions', withExerciseIndex);
export const equipmentProfileRepo = createRepo(db.equipmentProfiles, 'equipmentProfiles');
export const calendarExceptionRepo = createRepo(db.calendarExceptions, 'calendarExceptions');
export const planRepo = createRepo(db.plans, 'plans');
export const profileRepo = createRepo(db.profiles, 'profiles');
export const bodyMetricRepo = createRepo(db.bodyMetrics, 'bodyMetrics');
export const injuryRepo = createRepo(db.injuries, 'injuries');
export const testResultRepo = createRepo(db.testResults, 'testResults');

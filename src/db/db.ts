/**
 * IndexedDB schema (via Dexie).
 *
 * Design notes worth keeping in mind before changing anything here:
 *
 * - **Sets live inside their session document.** A workout is edited as one thing, so
 *   storing it as one record keeps every save atomic and keeps undo simple. The cost is
 *   that "every set of front squats I have ever done" needs a scan — so sessions carry a
 *   derived, multiEntry-indexed `exerciseSlugs` array to narrow that scan to the handful
 *   of sessions that contain the movement. At realistic volume (a few hundred sessions a
 *   year) reducing over those in memory is instant.
 *
 * - **Nothing is ever hard-deleted.** Deletes set `deletedAt`. Every query filters
 *   tombstones out. This is what makes a later sync possible without a migration.
 *
 * - **Every write appends to `changes`.** Also for that future sync: it is the outbox.
 *   It is bounded by `MAX_CHANGE_LOG` so it cannot grow forever while unused.
 */

import Dexie, { type Table } from 'dexie';
import type { Injury } from '../domain/injuries';
import type { TestResult } from '../domain/fitnessTests';
import type {
  BodyMetric,
  CalendarException,
  EquipmentProfile,
  Exercise,
  Id,
  Instant,
  LoggedSession,
  Plan,
  PlannedSession,
  Profile,
  SessionTemplate,
} from '../domain/types';

/** Sessions gain a derived index of the movements they contain. See note above. */
export type StoredLoggedSession = LoggedSession & { exerciseSlugs: string[] };

export interface ChangeRow {
  seq?: number;
  table: string;
  recordId: Id;
  op: 'put' | 'delete';
  at: Instant;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export const MAX_CHANGE_LOG = 5_000;

export class TrainingDb extends Dexie {
  exercises!: Table<Exercise, Id>;
  templates!: Table<SessionTemplate, Id>;
  plannedSessions!: Table<PlannedSession, Id>;
  loggedSessions!: Table<StoredLoggedSession, Id>;
  equipmentProfiles!: Table<EquipmentProfile, Id>;
  calendarExceptions!: Table<CalendarException, Id>;
  plans!: Table<Plan, Id>;
  profiles!: Table<Profile, Id>;
  bodyMetrics!: Table<BodyMetric, Id>;
  injuries!: Table<Injury & { createdAt: Instant; updatedAt: Instant }, Id>;
  testResults!: Table<TestResult & { createdAt: Instant; updatedAt: Instant }, Id>;
  changes!: Table<ChangeRow, number>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'training-tracker') {
    super(name);

    // Version 1. Add a new `.version(n).stores({...}).upgrade(...)` block for changes —
    // never edit this one once it has shipped to a device.
    this.version(1).stores({
      // Slug is indexed but deliberately NOT unique. A unique index turns one stray
      // duplicate into a failed database upgrade that locks the user out of their history;
      // bootstrap repairs duplicates instead, which is recoverable.
      exercises: 'id, slug, modality, pattern, isCustom, updatedAt, *equipment',
      templates: 'id, slug, isCustom, updatedAt, *modalities',
      plannedSessions: 'id, date, planId, status, updatedAt, [date+status]',
      loggedSessions: 'id, date, plannedSessionId, updatedAt, *exerciseSlugs',
      equipmentProfiles: 'id, name, isDefault, updatedAt',
      calendarExceptions: 'id, startDate, endDate, kind, updatedAt',
      plans: 'id, startDate, isActive, updatedAt',
      profiles: 'id, updatedAt',
      bodyMetrics: 'id, date, kind, [kind+date], updatedAt',
      changes: '++seq, table, recordId, at',
      meta: 'key',
    });

    /*
     * Version 2: the injury log.
     *
     * A new table and nothing else, so there is no upgrade function — Dexie creates the store
     * and every existing record is untouched. Additive migrations are the only safe kind on a
     * device you cannot inspect, which is why the injury lives in its own table rather than
     * as a field on the profile.
     */
    this.version(2).stores({
      injuries: 'id, region, startDate, restUntil, resolvedDate, updatedAt',
    });

    /*
     * Version 3: benchmark test results.
     *
     * Additive again, for the same reason. Indexed by movement and date because every read is
     * "what is the latest result for this movement" — the question both the retest warning and
     * percentage-based loading ask.
     */
    this.version(3).stores({
      testResults: 'id, exerciseSlug, kind, date, [exerciseSlug+date], updatedAt',
    });
  }
}

export const db = new TrainingDb();

/** Table names that hold user data — used by export, import, and wipe. */
export const DATA_TABLES = [
  'exercises',
  'templates',
  'plannedSessions',
  'loggedSessions',
  'equipmentProfiles',
  'calendarExceptions',
  'plans',
  'profiles',
  'bodyMetrics',
  'injuries',
  'testResults',
] as const;

export type DataTableName = (typeof DATA_TABLES)[number];

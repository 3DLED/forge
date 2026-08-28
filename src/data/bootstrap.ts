/**
 * First-run setup, and library top-ups on later runs.
 *
 * Seeding is additive and keyed by slug: movements you already have are left alone, so a
 * future release can add exercises without touching anything you customised, and without
 * resurrecting entries you deliberately deleted.
 */

import { db } from '../db/db';
import { getMeta, setMeta } from '../db/repo';
import type { AvailabilityRule, Profile, Weekday } from '../domain/types';
import { equipmentProfileRepo, exerciseRepo, profileRepo } from './repos';
import { SEED_EQUIPMENT_PROFILES } from './seed/equipment';
import { SEED_EXERCISES } from './seed/exercises';
import { SEED_SESSION_TEMPLATES } from './seed/sessionTemplates';
import { SEED_PLAN_TEMPLATES } from './seed/planTemplates';

/** Bump when the seed library changes so new movements reach existing installs. */
const SEED_VERSION = 1;

/**
 * Repairs duplicate slugs left by an interrupted or concurrent seed.
 *
 * Sets reference exercises by slug, never by id, so collapsing duplicates cannot orphan any
 * logged data. The oldest row wins, and anything the user customised beats seed data.
 */
async function dedupeExercises(): Promise<number> {
  const all = await db.exercises.toArray();
  const bySlug = new Map<string, typeof all>();
  for (const exercise of all) {
    if (!bySlug.has(exercise.slug)) bySlug.set(exercise.slug, []);
    bySlug.get(exercise.slug)!.push(exercise);
  }

  const doomed: string[] = [];
  for (const group of bySlug.values()) {
    if (group.length < 2) continue;
    const keep = group
      .slice()
      .sort((a, b) =>
        Number(b.isCustom) - Number(a.isCustom) || a.createdAt.localeCompare(b.createdAt),
      )[0];
    doomed.push(...group.filter((e) => e.id !== keep.id).map((e) => e.id));
  }

  if (doomed.length > 0) await db.exercises.bulkDelete(doomed);
  return doomed.length;
}

/**
 * Brings curated flags on already-installed seed entries up to date.
 *
 * Seeding only ever *adds* missing slugs, which is right for user data but leaves existing
 * installs stuck with whatever the library said the day they first ran it. Curation like
 * `common` has to reach them too, or the picker's ordering silently does nothing for anyone
 * who is not a brand new user. Custom entries are never touched.
 *
 * Only the curated flags are pushed. Names, equipment, and progressions are left alone: those
 * are things a user may reasonably have edited, and overwriting them would be data loss.
 */
async function syncSeedFlags(): Promise<number> {
  const existing = await db.exercises.toArray();
  const seedBySlug = new Map(SEED_EXERCISES.map((s) => [s.slug, s]));

  const stale = existing.filter((exercise) => {
    if (exercise.isCustom || exercise.deletedAt) return false;
    const seed = seedBySlug.get(exercise.slug);
    if (!seed) return false;
    // Compared loosely: installs from before a field existed have it undefined, which must
    // still count as stale so the value actually lands.
    return (
      seed.common !== exercise.common ||
      seed.isAccessory !== Boolean(exercise.isAccessory) ||
      seed.level !== (exercise.level ?? 0)
    );
  });

  if (stale.length === 0) return 0;

  await db.exercises.bulkPut(
    stale.map((exercise) => {
      const seed = seedBySlug.get(exercise.slug)!;
      return { ...exercise, common: seed.common, isAccessory: seed.isAccessory, level: seed.level };
    }),
  );
  return stale.length;
}

async function seedExercises(): Promise<number> {
  const existing = await db.exercises.toArray();
  const known = new Set(existing.map((e) => e.slug));
  const missing = SEED_EXERCISES.filter((e) => !known.has(e.slug));

  for (const seed of missing) {
    await exerciseRepo.create(seed);
  }
  return missing.length;
}

async function seedEquipmentProfiles(): Promise<void> {
  if ((await equipmentProfileRepo.all()).length > 0) return;
  for (const seed of SEED_EQUIPMENT_PROFILES) {
    await equipmentProfileRepo.create(seed);
  }
}

/** Everything allowed on every day until the user says otherwise. */
function openAvailability(): AvailabilityRule[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday: weekday as Weekday,
    allowedModalities: ['strength', 'cardio', 'mobility', 'skill'],
  })) as AvailabilityRule[];
}

async function ensureProfile(): Promise<Profile> {
  const existing = await profileRepo.all();
  if (existing[0]) return existing[0];

  const profiles = await equipmentProfileRepo.all();
  const defaultEquipment = profiles.find((p) => p.isDefault) ?? profiles[0];

  return profileRepo.create({
    displayName: 'Athlete',
    units: 'imperial',
    activeEquipmentProfileId: defaultEquipment?.id,
    availability: openAvailability(),
    weekStartsOn: 0,
  });
}

export interface BootstrapResult {
  profile: Profile;
  exercisesAdded: number;
  firstRun: boolean;
}

/**
 * Bootstrap runs at most once per page load. React's StrictMode deliberately double-invokes
 * effects in development, and two concurrent seeds would each read an empty library and
 * then both write it.
 */
let inFlight: Promise<BootstrapResult> | null = null;

export function bootstrap(): Promise<BootstrapResult> {
  inFlight ??= runBootstrap();
  return inFlight;
}

/**
 * Session templates reference exercises by slug, and a typo there produces a workout that
 * silently prescribes nothing. Caught loudly in development, where it is free to fix.
 */
function verifySeedIntegrity(): void {
  const known = new Set(SEED_EXERCISES.map((e) => e.slug));
  const missing = new Set<string>();

  for (const template of SEED_SESSION_TEMPLATES) {
    for (const block of template.blocks) {
      for (const item of block.items) {
        if (!known.has(item.ex)) missing.add(`${template.slug} → ${item.ex}`);
      }
    }
  }

  const templateSlugs = new Set(SEED_SESSION_TEMPLATES.map((t) => t.slug));
  for (const plan of SEED_PLAN_TEMPLATES) {
    for (const slot of plan.slots) {
      if (!templateSlugs.has(slot.templateSlug)) missing.add(`${plan.slug} → ${slot.templateSlug}`);
    }
  }

  if (missing.size > 0) {
    console.error('Seed data references unknown slugs:', [...missing]);
  }
}

async function runBootstrap(): Promise<BootstrapResult> {
  if (import.meta.env.DEV) verifySeedIntegrity();
  await db.open();

  const previousSeed = await getMeta<number>('seedVersion', 0);
  const firstRun = previousSeed === 0;

  await seedEquipmentProfiles();
  await dedupeExercises();
  const exercisesAdded = await seedExercises();
  await syncSeedFlags();
  const profile = await ensureProfile();

  if (previousSeed !== SEED_VERSION) await setMeta('seedVersion', SEED_VERSION);

  return { profile, exercisesAdded, firstRun };
}

/**
 * First-run setup, and library top-ups on later runs.
 *
 * Seeding is additive and keyed by slug: movements you already have are left alone, so a
 * future release can add exercises without touching anything you customised, and without
 * resurrecting entries you deliberately deleted.
 */

import { db } from '../db/db';
import { getMeta, setMeta } from '../db/repo';
import { ulid } from '../domain/ids';
import type { AvailabilityRule, Profile, Weekday } from '../domain/types';
import { equipmentProfileRepo, exerciseRepo, profileRepo } from './repos';
import { SEED_EQUIPMENT_PROFILES } from './seed/equipment';
import { SEED_EXERCISES } from './seed/exercises';
import type { SeedExercise } from './seed/define';
import { COACHED_SLUGS } from './seed/coaching';
import { SEED_SESSION_TEMPLATES } from './seed/sessionTemplates';
import { SEED_PLAN_TEMPLATES } from './seed/planTemplates';

/** Bump when the seed library changes so new movements reach existing installs. */
const SEED_VERSION = 2;

/**
 * Everything the library ships with: the curated movements, then the imported catalogue.
 *
 * Loaded on demand rather than imported at the top, and the reason is the install size. The
 * catalogue is 1.3 MB of names, muscles and write-ups that go into IndexedDB on first run and
 * are never read from the bundle again — so holding it in the main chunk made every launch
 * parse a megabyte to answer a question already answered. As its own chunk it is still
 * precached, so a first run with no network still works, but the app shell is back to the
 * size it was.
 *
 * Order matters only for the duplicate-slug tiebreak in `dedupeExercises`, which keeps the
 * oldest row. Curated first means a curated movement wins a collision, which is right — it
 * carries authored progressions and coaching that an imported one does not.
 */
async function allSeedExercises(): Promise<SeedExercise[]> {
  const { IMPORTED_EXERCISES } = await import('./seed/imported');
  return [...SEED_EXERCISES, ...IMPORTED_EXERCISES];
}

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
 *
 * Muscles and the description are pushed too, which looks like it breaks that rule and does
 * not: the library screen splits custom entries from seeded ones and the editor only ever
 * writes `isCustom: true`, so there is no path by which a seeded movement's muscles are
 * anything but what the seed said. They are here because the curated library's muscles were
 * never authored — `define.ts` derived them from the movement pattern, so every squat in the
 * app claimed the same four muscles — and the catalogue states them per movement.
 */
async function syncSeedFlags(library: SeedExercise[]): Promise<number> {
  const existing = await db.exercises.toArray();
  const seedBySlug = new Map(library.map((s) => [s.slug, s]));

  const stale = existing.filter((exercise) => {
    if (exercise.isCustom || exercise.deletedAt) return false;
    const seed = seedBySlug.get(exercise.slug);
    if (!seed) return false;
    // Compared loosely: installs from before a field existed have it undefined, which must
    // still count as stale so the value actually lands.
    return (
      seed.common !== exercise.common ||
      seed.isAccessory !== Boolean(exercise.isAccessory) ||
      seed.level !== (exercise.level ?? 0) ||
      seed.bodyweightFactor !== (exercise.bodyweightFactor ?? -1) ||
      seed.description !== exercise.description ||
      seed.primaryMuscles.join() !== exercise.primaryMuscles.join() ||
      seed.secondaryMuscles.join() !== exercise.secondaryMuscles.join()
    );
  });

  if (stale.length === 0) return 0;

  await db.exercises.bulkPut(
    stale.map((exercise) => {
      const seed = seedBySlug.get(exercise.slug)!;
      return {
        ...exercise,
        common: seed.common,
        isAccessory: seed.isAccessory,
        level: seed.level,
        bodyweightFactor: seed.bodyweightFactor,
        primaryMuscles: seed.primaryMuscles,
        secondaryMuscles: seed.secondaryMuscles,
        description: seed.description,
      };
    }),
  );
  return stale.length;
}

/**
 * Cleans up duplicates left by restoring a backup onto a fresh install.
 *
 * `restoreBackup` no longer creates these — it reconciles seeded rows on their natural key
 * rather than on an id that bootstrap mints afresh every install. This repairs the databases
 * that were damaged before that fix, which is every device the reinstall-and-merge workflow
 * has touched, and it cannot be done by the fix alone because the duplicate rows are already
 * written.
 *
 * Kept rather than removed once everyone is clean: it is cheap, it runs on a table with a
 * handful of rows, and a repair that quietly does nothing is the correct steady state.
 *
 * Exported for its tests. It deletes rows, so it is worth being able to aim at it directly.
 */
export async function dedupeEquipmentProfiles(): Promise<number> {
  const all = (await db.equipmentProfiles.toArray()).filter((row) => !row.deletedAt);

  const byName = new Map<string, typeof all>();
  for (const item of all) {
    if (!byName.has(item.name)) byName.set(item.name, []);
    byName.get(item.name)!.push(item);
  }

  /* Configured beats blank. Two copies of "Home — kettlebells" and only one knows the bells. */
  const richness = (item: (typeof all)[number]): number => {
    const weights = Object.values(item.availableWeightsKg ?? {}).flat().length;
    const plates = item.barbell?.plates?.length ?? 0;
    return weights * 100 + plates * 100 + (item.barbell ? 50 : 0) + item.items.length;
  };

  const doomed: string[] = [];
  const survivors = new Map<string, string>();

  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const keep = group
      .slice()
      .sort((a, b) => richness(b) - richness(a) || a.createdAt.localeCompare(b.createdAt))[0];
    survivors.set(keep.name, keep.id);
    doomed.push(...group.filter((item) => item.id !== keep.id).map((item) => item.id));
  }

  if (doomed.length === 0) return 0;
  await db.equipmentProfiles.bulkDelete(doomed);

  // A profile pointing at one of the copies we just removed would train as "no equipment".
  const gone = new Set(doomed);
  for (const profile of await db.profiles.toArray()) {
    if (!profile.activeEquipmentProfileId || !gone.has(profile.activeEquipmentProfileId)) continue;
    const replacement =
      [...survivors.values()][0] ??
      (await db.equipmentProfiles.toArray()).find((p) => p.isDefault)?.id;
    await db.profiles.update(profile.id, { activeEquipmentProfileId: replacement });
  }

  return doomed.length;
}

/**
 * Collapses duplicate athlete profiles, keeping the one that has actually been used.
 *
 * There is only ever meant to be one, and every screen reads `profiles[0]` — so a second one
 * makes which settings apply a matter of which row Dexie hands back first. Same cause as the
 * equipment duplicates, same repair.
 */
export async function dedupeProfiles(): Promise<number> {
  const all = (await db.profiles.toArray()).filter((row) => !row.deletedAt);
  if (all.length < 2) return 0;

  const equipment = new Set((await db.equipmentProfiles.toArray()).map((p) => p.id));

  /* Anything the athlete set themselves counts; a freshly seeded profile has none of it. */
  const configured = (profile: Profile): number =>
    (profile.bodyweightKg ? 1 : 0) +
    (profile.primaryGoal ? 1 : 0) +
    (profile.trainingMaxPercent ? 1 : 0) +
    (profile.units === 'metric' ? 1 : 0) +
    (profile.activeEquipmentProfileId && equipment.has(profile.activeEquipmentProfileId) ? 1 : 0) +
    (profile.availability?.some((rule) => rule.allowedModalities.length === 0) ? 1 : 0);

  const keep = all
    .slice()
    .sort((a, b) => configured(b) - configured(a) || a.createdAt.localeCompare(b.createdAt))[0];

  const doomed = all.filter((profile) => profile.id !== keep.id).map((profile) => profile.id);
  await db.profiles.bulkDelete(doomed);
  return doomed.length;
}

/**
 * Adds any library movement this install has never seen, keyed by slug.
 *
 * In bulk, and that is not a micro-optimisation. `create()` opens its own transaction per
 * record and every write counts the change outbox to decide whether to trim it, so seeding a
 * thirteen-hundred movement library one row at a time is thirteen hundred transactions and
 * thirteen hundred counts — on a phone, on first run, before the first screen appears.
 * `bulkPut` does it in one.
 *
 * Ids and timestamps are minted here because `bulkPut` puts records rather than creating
 * them. Deliberate: the same movement gets a different id on every install, which is exactly
 * why backups reconcile the seeded tables on slug rather than on id.
 */
async function seedExercises(library: SeedExercise[]): Promise<number> {
  const existing = await db.exercises.toArray();
  const known = new Set(existing.map((e) => e.slug));
  const missing = library.filter((e) => !known.has(e.slug));
  if (missing.length === 0) return 0;

  const timestamp = new Date().toISOString();
  await exerciseRepo.bulkPut(
    missing.map((seed) => ({
      ...seed,
      id: ulid(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    })),
  );
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
async function verifySeedIntegrity(): Promise<void> {
  const { IMPORTED_SLUGS } = await import('./seed/imported');
  const known = new Set([...SEED_EXERCISES.map((e) => e.slug), ...IMPORTED_SLUGS]);
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

  // Coaching text is authored by hand, so a movement added later silently ships without a
  // write-up unless something says so. Containers are not movements and have nothing to write.
  const containers = new Set(['amrap', 'emom', 'for-time']);
  // Imported movements carry their own write-up inline, so they have nothing to look up in
  // the authored table and listing all thirteen hundred of them would bury the real gaps.
  const uncoached = SEED_EXERCISES.filter(
    (e) => !containers.has(e.slug) && !IMPORTED_SLUGS.has(e.slug) && !COACHED_SLUGS.has(e.slug),
  ).map((e) => e.slug);
  if (uncoached.length > 0) {
    console.warn('Movements with no coaching write-up:', uncoached);
  }

  const orphaned = [...COACHED_SLUGS].filter((slug) => !known.has(slug));
  if (orphaned.length > 0) {
    console.warn('Coaching text for slugs no longer in the library:', orphaned);
  }
}

async function runBootstrap(): Promise<BootstrapResult> {
  if (import.meta.env.DEV) await verifySeedIntegrity();
  await db.open();

  const previousSeed = await getMeta<number>('seedVersion', 0);
  const firstRun = previousSeed === 0;

  await seedEquipmentProfiles();
  await dedupeEquipmentProfiles();
  await dedupeProfiles();
  await dedupeExercises();
  const library = await allSeedExercises();
  const exercisesAdded = await seedExercises(library);
  await syncSeedFlags(library);
  const profile = await ensureProfile();

  if (previousSeed !== SEED_VERSION) await setMeta('seedVersion', SEED_VERSION);

  return { profile, exercisesAdded, firstRun };
}

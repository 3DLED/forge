/**
 * Restoring a backup onto a fresh install.
 *
 * This is the flow that actually happens: export a backup, delete the app, reinstall it, and
 * import. The reinstall is not an empty database — bootstrap seeds the movement library, the
 * equipment profiles and a user profile before the restore ever runs, and it seeds them with
 * new ulids every time. So the backup arrives carrying its own copy of rows that already
 * exist here under a different id, and a merge keyed on id has no way to see that "Full gym"
 * and "Full gym" are the same profile.
 *
 * Left alone that produces a duplicate set of everything seeded, per reinstall, forever.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { buildBackup, restoreBackup } from './backup';
import { equipmentProfileRepo, exerciseRepo, profileRepo } from './repos';
import { dedupeEquipmentProfiles, dedupeProfiles } from './bootstrap';
import type { Exercise } from '../domain/types';

const movement = (slug: string, over: Partial<Exercise> = {}) =>
  ({
    slug,
    name: slug.replace(/-/g, ' '),
    modality: 'strength',
    pattern: 'squat',
    equipment: ['bodyweight'],
    metrics: ['reps'],
    primaryMuscles: [],
    secondaryMuscles: [],
    unilateral: false,
    substitutes: [],
    progression: { easier: [], harder: [] },
    isCustom: false,
    common: false,
    isAccessory: false,
    level: 3,
    bodyweightFactor: 0.6,
    ...over,
  }) as never;

/** What bootstrap does on a fresh install: the same logical rows, brand new ids. */
async function seedAsFreshInstall(): Promise<void> {
  await equipmentProfileRepo.create({
    name: 'Road & bodyweight',
    items: ['bodyweight', 'road'],
    isDefault: true,
  } as never);
  await equipmentProfileRepo.create({
    name: 'Full gym',
    items: ['bodyweight', 'barbell'],
    isDefault: false,
  } as never);
  await exerciseRepo.create(movement('push-up'));
  await exerciseRepo.create(movement('air-squat'));
  await profileRepo.create({
    displayName: 'You',
    units: 'imperial',
    availability: [],
  } as never);
}

async function wipeEverything(): Promise<void> {
  await Promise.all([
    db.exercises.clear(),
    db.equipmentProfiles.clear(),
    db.profiles.clear(),
    db.loggedSessions.clear(),
    db.templates.clear(),
    db.changes.clear(),
    db.meta.clear(),
  ]);
}

beforeEach(wipeEverything);

describe('reinstalling and restoring', () => {
  /** Export, delete the app, reinstall, import — with a merge, which is what the screen offers. */
  const reinstallAndRestore = async () => {
    const json = JSON.stringify(await buildBackup());
    await wipeEverything();
    await seedAsFreshInstall();
    return restoreBackup(json, 'merge');
  };

  it('does not end up with two of every equipment profile', async () => {
    await seedAsFreshInstall();
    await reinstallAndRestore();

    const names = (await equipmentProfileRepo.all()).map((p) => p.name).sort();
    expect(names).toEqual(['Full gym', 'Road & bodyweight']);
  });

  it('does not end up with two of every movement', async () => {
    await seedAsFreshInstall();
    await reinstallAndRestore();

    const slugs = (await exerciseRepo.all()).map((e) => e.slug).sort();
    expect(slugs).toEqual(['air-squat', 'push-up']);
  });

  /* Everything reads `profiles[0]`, so a second one is a coin toss over whose settings apply. */
  it('does not end up with two user profiles', async () => {
    await seedAsFreshInstall();
    await reinstallAndRestore();

    expect(await profileRepo.all()).toHaveLength(1);
  });

  it('keeps the settings from the backup, not the fresh install', async () => {
    await seedAsFreshInstall();
    const mine = (await profileRepo.all())[0];
    await profileRepo.update(mine.id, { units: 'metric', displayName: 'John' });

    await reinstallAndRestore();

    const after = (await profileRepo.all())[0];
    expect(after).toMatchObject({ units: 'metric', displayName: 'John' });
  });

  /* The kettlebells he entered have to survive, or the rack is empty again every reinstall. */
  it('keeps equipment set up in the backup rather than the seeded blank', async () => {
    await seedAsFreshInstall();
    const gym = (await equipmentProfileRepo.all()).find((p) => p.name === 'Full gym')!;
    await equipmentProfileRepo.update(gym.id, {
      availableWeightsKg: { kettlebell: [16, 24, 32] },
    });

    await reinstallAndRestore();

    const after = (await equipmentProfileRepo.all()).find((p) => p.name === 'Full gym');
    expect(after?.availableWeightsKg?.kettlebell).toEqual([16, 24, 32]);
  });

  it('keeps a movement you added yourself', async () => {
    await seedAsFreshInstall();
    await exerciseRepo.create(movement('custom-01abc', { isCustom: true, name: 'Zercher hold' }));

    await reinstallAndRestore();

    const mine = (await exerciseRepo.all()).filter((e) => e.isCustom);
    expect(mine.map((e) => e.name)).toEqual(['Zercher hold']);
  });

  it('keeps logged sessions, which only ever exist in the backup', async () => {
    await seedAsFreshInstall();
    await db.loggedSessions.put({
      id: 'S1',
      date: '2026-03-01',
      name: 'Morning session',
      sets: [],
      blocks: [],
      exerciseSlugs: [],
      createdAt: '2026-03-01T09:00:00.000Z',
      updatedAt: '2026-03-01T09:00:00.000Z',
    } as never);

    await reinstallAndRestore();

    expect(await db.loggedSessions.count()).toBe(1);
  });

  /* Doing it repeatedly is his actual workflow, so once is not enough to prove. */
  it('stays clean across several reinstalls', async () => {
    await seedAsFreshInstall();
    await reinstallAndRestore();
    await reinstallAndRestore();
    await reinstallAndRestore();

    expect((await equipmentProfileRepo.all()).map((p) => p.name).sort()).toEqual([
      'Full gym',
      'Road & bodyweight',
    ]);
    expect(await profileRepo.all()).toHaveLength(1);
  });
});

describe('merging onto a device that has been used since', () => {
  /* The other reason merge exists: two devices, both with real data. */
  it('keeps rows that only exist here', async () => {
    await seedAsFreshInstall();
    const json = JSON.stringify(await buildBackup());

    await equipmentProfileRepo.create({
      name: 'Hotel gym',
      items: ['bodyweight'],
      isDefault: false,
    } as never);

    await restoreBackup(json, 'merge');

    expect((await equipmentProfileRepo.all()).map((p) => p.name)).toContain('Hotel gym');
  });

  /* A profile you built here is yours, even if the backup happens to hold the same name. */
  it('does not drop a profile you set up on this device', async () => {
    await seedAsFreshInstall();
    const json = JSON.stringify(await buildBackup());
    await wipeEverything();
    await seedAsFreshInstall();

    // Configure the freshly seeded one before restoring, so it is no longer untouched.
    const mine = (await equipmentProfileRepo.all()).find((p) => p.name === 'Full gym')!;
    await equipmentProfileRepo.update(mine.id, {
      availableWeightsKg: { kettlebell: [20] },
    });

    await restoreBackup(json, 'merge');

    const kept = (await equipmentProfileRepo.all()).find((p) => p.id === mine.id);
    expect(kept?.availableWeightsKg?.kettlebell).toEqual([20]);
  });

  it('lets the newer copy of a row win', async () => {
    await seedAsFreshInstall();
    const gym = (await equipmentProfileRepo.all()).find((p) => p.name === 'Full gym')!;
    await equipmentProfileRepo.update(gym.id, { name: 'Full gym (renamed in backup)' });
    const json = JSON.stringify(await buildBackup());

    await restoreBackup(json, 'merge');

    const names = (await equipmentProfileRepo.all()).map((p) => p.name);
    expect(names).toContain('Full gym (renamed in backup)');
    expect(names).not.toContain('Full gym');
  });
});

/**
 * Repairing devices that were damaged before the fix above.
 *
 * Every phone the reinstall-and-merge workflow has touched already holds the duplicates, and
 * no change to the restore can reach rows that are already written. These delete data, so
 * what they keep matters more than what they remove.
 */
describe('cleaning up duplicates already on a device', () => {
  const profile = (name: string, over: Record<string, unknown> = {}) =>
    equipmentProfileRepo.create({
      name,
      items: ['bodyweight'],
      isDefault: false,
      ...over,
    } as never);

  it('leaves a healthy database alone', async () => {
    await profile('Road & bodyweight');
    await profile('Full gym');

    expect(await dedupeEquipmentProfiles()).toBe(0);
    expect(await equipmentProfileRepo.all()).toHaveLength(2);
  });

  it('collapses copies sharing a name', async () => {
    await profile('Full gym');
    await profile('Full gym');
    await profile('Full gym');

    expect(await dedupeEquipmentProfiles()).toBe(2);
    expect(await equipmentProfileRepo.all()).toHaveLength(1);
  });

  /* The copy that knows your bells is the one worth keeping, whichever order they are in. */
  it('keeps the copy that has the weights set up', async () => {
    await profile('Home — kettlebells');
    await profile('Home — kettlebells', { availableWeightsKg: { kettlebell: [16, 24, 32] } });
    await profile('Home — kettlebells');

    await dedupeEquipmentProfiles();

    const left = await equipmentProfileRepo.all();
    expect(left).toHaveLength(1);
    expect(left[0].availableWeightsKg?.kettlebell).toEqual([16, 24, 32]);
  });

  it('keeps the copy that knows your plates', async () => {
    await profile('Full gym');
    await profile('Full gym', { barbell: { barKg: 20, plates: [{ kg: 20, pairs: 2 }] } });

    await dedupeEquipmentProfiles();

    expect((await equipmentProfileRepo.all())[0].barbell?.plates).toHaveLength(1);
  });

  it('keeps profiles that are genuinely different', async () => {
    await profile('Full gym');
    await profile('Full gym');
    await profile('Hotel gym');

    await dedupeEquipmentProfiles();

    expect((await equipmentProfileRepo.all()).map((p) => p.name).sort()).toEqual([
      'Full gym',
      'Hotel gym',
    ]);
  });

  /* Pointing at a deleted copy would leave you training as though you owned nothing. */
  it('repoints the athlete at the copy it kept', async () => {
    await profile('Full gym', { availableWeightsKg: { kettlebell: [24] } });
    const doomed = await profile('Full gym');
    const me = await profileRepo.create({
      displayName: 'You',
      units: 'imperial',
      availability: [],
      activeEquipmentProfileId: doomed.id,
    } as never);

    await dedupeEquipmentProfiles();

    const after = (await profileRepo.all()).find((p) => p.id === me.id)!;
    const left = await equipmentProfileRepo.all();
    expect(left).toHaveLength(1);
    expect(after.activeEquipmentProfileId).toBe(left[0].id);
  });

  it('leaves a pointer alone when its profile survived', async () => {
    const kept = await profile('Full gym', { availableWeightsKg: { kettlebell: [24] } });
    await profile('Full gym');
    const me = await profileRepo.create({
      displayName: 'You',
      units: 'imperial',
      availability: [],
      activeEquipmentProfileId: kept.id,
    } as never);

    await dedupeEquipmentProfiles();

    expect((await profileRepo.all()).find((p) => p.id === me.id)?.activeEquipmentProfileId).toBe(
      kept.id,
    );
  });
});

describe('cleaning up duplicate athlete profiles', () => {
  const blank = () =>
    profileRepo.create({ displayName: 'Athlete', units: 'imperial', availability: [] } as never);

  it('leaves a single profile alone', async () => {
    await blank();
    expect(await dedupeProfiles()).toBe(0);
    expect(await profileRepo.all()).toHaveLength(1);
  });

  it('never removes the last one', async () => {
    await blank();
    await blank();

    await dedupeProfiles();

    expect(await profileRepo.all()).toHaveLength(1);
  });

  /* A blank profile and a used one: the used one is the athlete. */
  it('keeps the one that has actually been set up', async () => {
    await blank();
    await profileRepo.create({
      displayName: 'John',
      units: 'metric',
      bodyweightKg: 82,
      primaryGoal: 'strength',
      availability: [],
    } as never);
    await blank();

    await dedupeProfiles();

    const left = await profileRepo.all();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ displayName: 'John', bodyweightKg: 82 });
  });

  it('falls back to the oldest when neither has been touched', async () => {
    const first = await blank();
    await blank();

    await dedupeProfiles();

    expect((await profileRepo.all())[0].id).toBe(first.id);
  });
});

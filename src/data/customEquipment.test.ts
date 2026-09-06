/**
 * Kit somebody added themselves.
 *
 * The whole point is that a custom tag is indistinguishable from a seeded one everywhere it
 * matters — a profile holds it, a movement requires it, and availability compares the two
 * without knowing which kind it is. So these check the seam rather than the plumbing: that the
 * name resolves, that availability behaves, and that deleting it does not leave a profile
 * pointing at something nothing can name.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { equipmentProfileRepo, exerciseRepo } from './repos';
import {
  addCustomEquipment,
  allCustomEquipment,
  customEquipmentByTag,
  deleteCustomEquipment,
  equipmentLabel,
  movementsNeeding,
  renameCustomEquipment,
} from './customEquipment';
import { canPerform, availableSlugs } from '../domain/equipment';
import { isCustomEquipment } from '../domain/types';
import type { EquipmentTag, Exercise } from '../domain/types';

const movement = (slug: string, equipment: EquipmentTag[]): Exercise =>
  ({
    slug,
    name: slug.replace(/-/g, ' '),
    modality: 'cardio',
    pattern: 'gait',
    equipment,
    metrics: ['timeSec'],
    primaryMuscles: [],
    secondaryMuscles: [],
    unilateral: false,
    substitutes: [],
    progression: { easier: [], harder: [] },
    isCustom: true,
    common: false,
    isAccessory: false,
    level: 3,
    bodyweightFactor: 0,
  }) as unknown as Exercise;

beforeEach(async () => {
  await Promise.all([
    db.customEquipment.clear(),
    db.equipmentProfiles.clear(),
    db.exercises.clear(),
    db.changes.clear(),
  ]);
});

describe('adding a piece of kit', () => {
  it('gives it a tag nothing else will collide with', async () => {
    const a = await addCustomEquipment('Rebounder');
    const b = await addCustomEquipment('Macebell');

    expect(a.tag).not.toBe(b.tag);
    expect(isCustomEquipment(a.tag)).toBe(true);
  });

  it('keeps the name you gave it, trimmed', async () => {
    const item = await addCustomEquipment('  Sledgehammer  ');
    expect(item.name).toBe('Sledgehammer');
  });

  it('renames everywhere at once, because the tag never changes', async () => {
    const item = await addCustomEquipment('Rebounder');
    await renameCustomEquipment(item.id, 'Mini trampoline');

    const after = (await allCustomEquipment())[0];
    expect(after.tag).toBe(item.tag);
    expect(after.name).toBe('Mini trampoline');
  });
});

describe('what a tag is called', () => {
  it('names the built-in kit from the static table', () => {
    expect(equipmentLabel('kettlebell')).toBe('Kettlebells');
    expect(equipmentLabel('rebounder')).toBe('Rebounder');
  });

  it('names your own from the database', async () => {
    const item = await addCustomEquipment('Macebell');
    expect(equipmentLabel(item.tag, customEquipmentByTag(await allCustomEquipment()))).toBe(
      'Macebell',
    );
  });

  /* Only reachable via a file that carried a movement without the kit it needs. */
  it('says something rather than a ulid when the kit is missing', async () => {
    expect(equipmentLabel('custom-01nothing')).toBe('Something you added');
  });
});

describe('availability treats it like any other kit', () => {
  it('allows a movement when the profile has the tag', async () => {
    const item = await addCustomEquipment('Rebounder');
    const bounce = movement('bounce', [item.tag]);

    expect(canPerform(bounce, [item.tag])).toBe(true);
    expect(canPerform(bounce, [])).toBe(false);
  });

  it('leaves it out of a profile that does not have it', async () => {
    const item = await addCustomEquipment('Rebounder');
    const slugs = availableSlugs([movement('bounce', [item.tag]), movement('walk', [])], []);

    expect([...slugs]).toEqual(['walk']);
  });
});

describe('deleting it', () => {
  it('names the movements that need it, before you decide', async () => {
    const item = await addCustomEquipment('Rebounder');
    await exerciseRepo.create(movement('bounce', [item.tag]) as never);
    await exerciseRepo.create(movement('walk', []) as never);

    expect(await movementsNeeding(item.tag)).toEqual(['bounce']);
  });

  /* A profile holding a tag nothing can name would show movements it cannot explain. */
  it('takes the tag out of every profile holding it', async () => {
    const item = await addCustomEquipment('Rebounder');
    const home = await equipmentProfileRepo.create({
      name: 'Home',
      items: ['bodyweight', item.tag],
      isDefault: true,
    } as never);
    const gym = await equipmentProfileRepo.create({
      name: 'Gym',
      items: ['barbell'],
      isDefault: false,
    } as never);

    await deleteCustomEquipment(item);

    const profiles = await equipmentProfileRepo.all();
    expect(profiles.find((p) => p.id === home.id)?.items).toEqual(['bodyweight']);
    expect(profiles.find((p) => p.id === gym.id)?.items).toEqual(['barbell']);
    expect(await allCustomEquipment()).toEqual([]);
  });

  /* The movement stays: it is simply not available, exactly as a barbell lift is at home. */
  it('leaves the movements alone', async () => {
    const item = await addCustomEquipment('Rebounder');
    await exerciseRepo.create(movement('bounce', [item.tag]) as never);

    await deleteCustomEquipment(item);

    expect((await exerciseRepo.all()).map((e) => e.slug)).toEqual(['bounce']);
  });
});

/**
 * Kit the app has never heard of.
 *
 * No list is going to hold every macebell, sledgehammer, rebounder and vibration plate anyone
 * trains with, and trying would produce a picker nobody can find a kettlebell in. So the
 * seeded list stays deliberately finite and anything else is added by the person who owns it.
 *
 * A custom tag behaves exactly like a seeded one everywhere it matters: an equipment profile
 * holds it, a movement requires it, and `canPerform` compares the two without knowing or
 * caring which kind it is. The only thing that differs is where its name is kept — the seeded
 * labels are a static table, and a rebounder somebody typed in has nowhere in it to live.
 */

import { customEquipmentRepo, exerciseRepo } from './repos';
import { EQUIPMENT_LABELS } from './seed/equipment';
import { ulid } from '../domain/ids';
import type {
  CustomEquipment,
  CustomEquipmentTag,
  EquipmentTag,
  Id,
  SeededEquipmentTag,
} from '../domain/types';
import { isCustomEquipment } from '../domain/types';

export async function allCustomEquipment(): Promise<CustomEquipment[]> {
  return (await customEquipmentRepo.all()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * What to call a tag.
 *
 * Falls back to the tag itself, which for a seeded one is at least readable and for a custom
 * one is a ulid — but that only happens for equipment referenced by a movement whose
 * definition arrived without it, and the importer already refuses to let that happen quietly.
 */
export function equipmentLabel(
  tag: EquipmentTag,
  custom: Map<string, CustomEquipment> = new Map(),
): string {
  if (isCustomEquipment(tag)) return custom.get(tag)?.name ?? 'Something you added';
  return EQUIPMENT_LABELS[tag as SeededEquipmentTag] ?? tag;
}

export function customEquipmentByTag(items: CustomEquipment[]): Map<string, CustomEquipment> {
  return new Map(items.map((item) => [item.tag, item]));
}

export async function addCustomEquipment(name: string, group?: string): Promise<CustomEquipment> {
  const tag = `custom-${ulid().toLowerCase()}` as CustomEquipmentTag;
  return (await customEquipmentRepo.create({ tag, name: name.trim(), group } as never)) as CustomEquipment;
}

export async function renameCustomEquipment(id: Id, name: string): Promise<void> {
  await customEquipmentRepo.update(id, { name: name.trim() });
}

/**
 * Movements that would stop being available if this kit went away.
 *
 * Asked before deleting rather than after. Removing the equipment does not touch them — they
 * simply stop being offered, exactly as a barbell movement does on a bodyweight profile — but
 * "three of your movements need this" is the thing worth knowing before you decide.
 */
export async function movementsNeeding(tag: EquipmentTag): Promise<string[]> {
  const exercises = await exerciseRepo.all();
  return exercises.filter((exercise) => exercise.equipment.includes(tag)).map((e) => e.name);
}

/**
 * Removes a piece of kit, and takes it out of every profile holding it.
 *
 * Leaving it in the profiles would make movements requiring it look available while nothing
 * could name the thing they need.
 */
export async function deleteCustomEquipment(item: CustomEquipment): Promise<void> {
  const { equipmentProfileRepo } = await import('./repos');

  for (const profile of await equipmentProfileRepo.all()) {
    if (!profile.items.includes(item.tag)) continue;
    await equipmentProfileRepo.update(profile.id, {
      items: profile.items.filter((tag) => tag !== item.tag),
    });
  }

  await customEquipmentRepo.remove(item.id);
}

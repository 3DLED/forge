/**
 * Bodyweight over time.
 *
 * One weigh-in per day. Logging twice on the same day replaces rather than appends, because
 * two readings a few hours apart differ by more than a week of real change, and a chart made
 * of both is mostly noise about when you last ate.
 */

import { db } from '../db/db';
import { bodyMetricRepo, profileRepo } from './repos';
import { todayKey } from '../domain/dates';
import type { BodyMetric, DayKey, Id } from '../domain/types';

export async function bodyweightEntries(): Promise<BodyMetric[]> {
  const rows = await db.bodyMetrics.where('kind').equals('bodyweightKg').toArray();
  return rows.filter((m) => !m.deletedAt).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Records a weigh-in, and keeps the profile's current figure in step.
 *
 * The profile copy is what everything reads when it has no history to hand — it is a cache of
 * the latest entry, not a second source of truth.
 */
export async function logBodyweight(
  kg: number,
  date: DayKey = todayKey(),
  profileId?: Id,
): Promise<void> {
  const existing = (await bodyweightEntries()).find((m) => m.date === date);

  if (existing) await bodyMetricRepo.update(existing.id, { value: kg });
  else await bodyMetricRepo.create({ date, kind: 'bodyweightKg', value: kg });

  if (!profileId) return;
  const latest = (await bodyweightEntries()).at(-1);
  if (latest && latest.date <= date) {
    await profileRepo.update(profileId, { bodyweightKg: kg });
  }
}

export async function deleteBodyweight(id: Id): Promise<void> {
  await bodyMetricRepo.remove(id);
}

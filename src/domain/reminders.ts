/**
 * Which reminders should be pending right now.
 *
 * A pure function over the plan, because scheduling is the part that cannot be tested on a
 * laptop and the part most likely to be wrong. Everything that decides *whether* somebody
 * gets woken up lives here; `data/notifications` only carries the answer to the operating
 * system.
 *
 * The model is replace, not append. Plans move constantly — a session gets skipped, a week
 * gets shifted, a whole plan gets swapped — and trying to keep a pile of scheduled
 * notifications in step with that by patching it is how people end up being told to train on
 * a day they cancelled a month ago. So the whole set is recomputed and re-armed, and this
 * function is the only thing that decides what belongs in it.
 */

import { translate } from '../i18n/copy';
import { fromDayKey, todayKey } from './dates';
import { minutesIntoDay, type ReminderSettings } from './reminderSettings';
import type { DayKey, Language, PlannedSession } from './types';

/**
 * How far ahead to arm anything.
 *
 * iOS keeps at most sixty-four pending local notifications per app and silently drops the
 * rest, so this is a real ceiling rather than a tidiness rule. Well under it, because the rest
 * timer needs room too and a plan three weeks out is going to change anyway.
 */
export const MAX_PENDING = 32;

/** Four weeks is past the point where tomorrow's plan is still the plan. */
export const HORIZON_DAYS = 28;

export interface Reminder {
  /** Stable within a batch. See `data/notifications` for how the ranges are carved up. */
  id: number;
  title: string;
  body: string;
  at: Date;
}

/**
 * One reminder per day, not one per session.
 *
 * Two-a-days exist and are the whole reason the plan supports them, but two notifications at
 * 07:00 naming two workouts is not twice as useful as one. The day is what is being reminded
 * about; what is in it is the body text.
 */
function groupByDate(planned: PlannedSession[]): Map<DayKey, PlannedSession[]> {
  const byDate = new Map<DayKey, PlannedSession[]>();
  for (const slot of planned) {
    const list = byDate.get(slot.date);
    if (list) list.push(slot);
    else byDate.set(slot.date, [slot]);
  }
  return byDate;
}

/**
 * What a day's nudge says.
 *
 * Named rather than counted where there is one thing: "Upper body" tells you whether to pack
 * a bag, where "1 session planned" tells you to open the app to find out, which is a
 * notification that has not finished its job.
 */
function describe(slots: PlannedSession[], lang?: Language): string {
  const names = slots.map((slot) => slot.prescription.name).filter(Boolean);
  if (names.length === 0) return translate('Something is planned for today.', lang);
  // The names themselves are the workout's own, in whatever language it was written in.
  return names.join(' · ');
}

/**
 * The reminders that should be armed, soonest first.
 *
 * Three things are deliberately excluded, each of which was a notification somebody would
 * have resented.
 *
 * **Anything already dealt with.** Completed and skipped days are settled; a slot that moved
 * is reminded about where it went, not where it was.
 *
 * **Anything in the past.** Scheduling a time that has already gone by makes some platforms
 * fire immediately, which turns opening the app after a week away into a burst of alerts
 * about days you already missed.
 *
 * **Today, once the hour has passed.** The commonest case of the above, and the one that
 * would otherwise fire every single time the plan was re-synced during a morning session.
 */
export function dueReminders(
  planned: PlannedSession[],
  settings: ReminderSettings,
  options: { now?: Date; firstId?: number; lang?: Language } = {},
): Reminder[] {
  const { now = new Date(), firstId = 0, lang } = options;
  if (!settings.sessions) return [];

  const minutes = minutesIntoDay(settings.sessionTime);
  if (minutes == null) return [];

  const today = todayKey();
  const open = planned.filter((slot) => slot.status === 'planned' && slot.date >= today);

  return [...groupByDate(open).entries()]
    .map(([date, slots]) => {
      const at = fromDayKey(date);
      at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      return { date, slots, at };
    })
    .filter((day) => day.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_PENDING)
    .map((day, index) => ({
      id: firstId + index,
      title: translate('Training today', lang),
      body: describe(day.slots, lang),
      at: day.at,
    }));
}

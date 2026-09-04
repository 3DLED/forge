/**
 * Placing sessions on real days.
 *
 * Two rules drive everything here:
 *
 * 1. **Availability is a hard constraint.** A day you marked rest, or blacked out for a
 *    holiday, never receives a session. A planner that quietly schedules over your calendar
 *    is a planner you stop trusting by week two.
 *
 * 2. **Spacing is the soft goal.** Three sessions a week means Monday/Wednesday/Friday, not
 *    Monday/Tuesday/Wednesday. Sessions are spread across the eligible days rather than
 *    packed against the front of the week.
 *
 * When a slot cannot be placed the scheduler says so instead of dropping it silently — the
 * caller surfaces that as a conflict the athlete can resolve.
 */

import type {
  AvailabilityRule,
  CalendarException,
  DayKey,
  Modality,
  Weekday,
} from './types';
import { weekdayOf } from './dates';

export interface DayAvailability {
  date: DayKey;
  /** What may be scheduled here, after weekday rules and calendar exceptions. */
  allowedModalities: Modality[];
  /** True when nothing at all may be scheduled. */
  blocked: boolean;
  /**
   * Blocked by a date you blacked out, rather than by your weekday rules.
   *
   * The two are different in kind and only one of them is negotiable. A weekday you usually
   * rest on is a habit, and a plan you laid out by hand may override it. A holiday is a fact
   * about that particular date, and nothing overrides it.
   */
  blackout?: boolean;
  /** Why it is blocked or restricted, for display. */
  reason?: string;
  maxMinutes?: number;
}

function coversDay(exception: CalendarException, date: DayKey): boolean {
  return date >= exception.startDate && date <= exception.endDate;
}

/**
 * What a single day will accept. Weekday rules set the baseline; calendar exceptions
 * narrow it further. Exceptions can only ever subtract — an exception is a constraint you
 * added, so it should never quietly grant training on a day you called a rest day.
 */
export function resolveDayAvailability(
  date: DayKey,
  rules: AvailabilityRule[],
  exceptions: CalendarException[],
): DayAvailability {
  const rule = rules.find((r) => r.weekday === weekdayOf(date));
  let allowed: Modality[] = rule ? [...rule.allowedModalities] : [];
  let reason: string | undefined;

  for (const exception of exceptions) {
    if (!coversDay(exception, date)) continue;

    if (exception.kind === 'blackout') {
      return {
        date,
        allowedModalities: [],
        blocked: true,
        blackout: true,
        reason: exception.reason ?? 'Blocked',
      };
    }

    const permitted = exception.allowedModalities ?? [];
    allowed = allowed.filter((modality) => permitted.includes(modality));
    reason = exception.reason ?? 'Restricted';
  }

  return {
    date,
    allowedModalities: allowed,
    blocked: allowed.length === 0,
    reason: allowed.length === 0 ? reason ?? 'Rest day' : reason,
    maxMinutes: rule?.maxMinutes,
  };
}

export function resolveWeekAvailability(
  days: DayKey[],
  rules: AvailabilityRule[],
  exceptions: CalendarException[],
): DayAvailability[] {
  return days.map((date) => resolveDayAvailability(date, rules, exceptions));
}

/**
 * Indices spread as evenly as possible across `length` positions.
 * 3 of 7 gives [0, 3, 6]; 4 of 7 gives [0, 2, 4, 6].
 */
function spreadIndices(length: number, count: number): number[] {
  if (count <= 0 || length <= 0) return [];
  if (count === 1) return [Math.floor((length - 1) / 2)];
  if (count >= length) return Array.from({ length }, (_, i) => i);

  return Array.from({ length: count }, (_, i) =>
    Math.round((i * (length - 1)) / (count - 1)),
  );
}

export interface PlaceableSlot {
  modality: Modality;
  /** Lower goes earlier in the week. */
  order: number;
  /**
   * Pinned to this weekday, for a plan whose days you chose yourself.
   *
   * A pinned slot is an instruction rather than a preference: it lands on its day even where
   * your weekday rules say you would usually rest, because saying "Wednesday" in a plan you
   * built *is* the decision. What it does not override is a blacked-out date — a holiday is
   * a fact about the calendar, not a habit, and quietly training through one would be wrong.
   */
  weekday?: Weekday;
}

export interface Placement<T extends PlaceableSlot> {
  slot: T;
  date: DayKey | null;
  /** Set when `date` is null. */
  reason?: string;
}

/**
 * Assigns a week's slots to days.
 *
 * Slots are honoured in `order`, each aiming for an evenly spread target day and walking
 * outward to the nearest free day that permits its modality. A strength day therefore does
 * not get stranded because the ideal Wednesday is marked cardio-only.
 *
 * `busy` names days that already hold a session from a plan that is not this one. Those are
 * avoided while anything else is free and used once nothing is — which is what makes running
 * a strength plan and a running plan together land seven sessions across seven days rather
 * than stacking them onto three, while still allowing a two-a-day when the week is tighter
 * than the training. Days this call has already filled stay off limits either way: a plan
 * doubling up on *itself* is a bug, not a two-a-day.
 */
export function placeSlotsInWeek<T extends PlaceableSlot>(
  days: DayAvailability[],
  slots: T[],
  options: { busy?: Set<DayKey> } = {},
): Placement<T>[] {
  const eligible = days.filter((day) => !day.blocked);
  const ordered = [...slots].sort((a, b) => a.order - b.order);

  const placements: Placement<T>[] = [];
  const taken = new Set<string>();

  /*
   * Pinned days are settled first, and they take their day out of circulation before anything
   * is spread. Doing it the other way round lets a floating slot land on Wednesday and push
   * the slot that actually asked for Wednesday somewhere else.
   */
  const pinned = ordered.filter((slot) => slot.weekday != null);
  const floating = ordered.filter((slot) => slot.weekday == null);

  for (const slot of pinned) {
    const day = days.find((candidate) => weekdayOf(candidate.date) === slot.weekday);
    if (!day) {
      // The first week of a plan can start mid-week, so its earlier days do not exist yet.
      placements.push({ slot, date: null, reason: 'That day has already passed this week' });
      continue;
    }
    // Only a blacked-out date refuses a pinned slot; a weekday rule is a habit, not a fact.
    if (day.blackout) {
      placements.push({ slot, date: null, reason: day.reason ?? 'That day is blocked out' });
      continue;
    }
    taken.add(day.date);
    placements.push({ slot, date: day.date });
  }

  if (floating.length === 0) return placements;

  if (eligible.length === 0) {
    return [
      ...placements,
      ...floating.map((slot) => ({ slot, date: null, reason: 'No available days this week' })),
    ];
  }

  const busy = options.busy ?? new Set<DayKey>();
  const targets = spreadIndices(eligible.length, floating.length);

  floating.forEach((slot, index) => {
    const target = targets[index] ?? Math.min(index, eligible.length - 1);

    /*
     * Walk outward from the ideal day: target, target±1, target±2, …
     *
     * Twice, when another plan is already using days this week: once refusing them, then
     * again allowing them. Preferring a free day is what spreads two plans across the week;
     * accepting a busy one on the second pass is what lets them double up rather than one of
     * them simply losing its session.
     */
    const walk = (allowBusy: boolean): DayAvailability | undefined => {
      for (let offset = 0; offset < eligible.length; offset++) {
        for (const candidateIndex of offset === 0 ? [target] : [target - offset, target + offset]) {
          const day = eligible[candidateIndex];
          if (!day || taken.has(day.date)) continue;
          if (!allowBusy && busy.has(day.date)) continue;
          if (!day.allowedModalities.includes(slot.modality)) continue;
          return day;
        }
      }
      return undefined;
    };

    const chosen = walk(false) ?? walk(true);

    if (chosen) {
      taken.add(chosen.date);
      placements.push({ slot, date: chosen.date });
    } else {
      const anyFree = eligible.some((day) => !taken.has(day.date));
      placements.push({
        slot,
        date: null,
        reason: anyFree
          ? `No ${slot.modality} day available this week`
          : 'Not enough training days this week',
      });
    }
  });

  return placements;
}

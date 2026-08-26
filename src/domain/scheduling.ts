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
} from './types';
import { weekdayOf } from './dates';

export interface DayAvailability {
  date: DayKey;
  /** What may be scheduled here, after weekday rules and calendar exceptions. */
  allowedModalities: Modality[];
  /** True when nothing at all may be scheduled. */
  blocked: boolean;
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
      return { date, allowedModalities: [], blocked: true, reason: exception.reason ?? 'Blocked' };
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
 */
export function placeSlotsInWeek<T extends PlaceableSlot>(
  days: DayAvailability[],
  slots: T[],
): Placement<T>[] {
  const eligible = days.filter((day) => !day.blocked);
  const ordered = [...slots].sort((a, b) => a.order - b.order);

  if (eligible.length === 0) {
    return ordered.map((slot) => ({ slot, date: null, reason: 'No available days this week' }));
  }

  const targets = spreadIndices(eligible.length, ordered.length);
  const taken = new Set<string>();
  const placements: Placement<T>[] = [];

  ordered.forEach((slot, index) => {
    const target = targets[index] ?? Math.min(index, eligible.length - 1);

    // Walk outward from the ideal day: target, target±1, target±2, …
    let chosen: DayAvailability | undefined;
    for (let offset = 0; offset < eligible.length && !chosen; offset++) {
      for (const candidateIndex of offset === 0 ? [target] : [target - offset, target + offset]) {
        const day = eligible[candidateIndex];
        if (!day || taken.has(day.date)) continue;
        if (!day.allowedModalities.includes(slot.modality)) continue;
        chosen = day;
        break;
      }
    }

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

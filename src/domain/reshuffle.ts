/**
 * Rearranging a plan after the week it was built for stops being true.
 *
 * Change Wednesday to a rest day and the sessions already sitting on Wednesdays do not move
 * on their own. This works out where they should go instead.
 *
 * Three rules shape it, and each one is a decision rather than a detail:
 *
 * 1. **Sessions move; they are never regenerated.** Every planned session carries a frozen
 *    prescription, deliberately — see the note at the top of `planning.ts`. Rebuilding them
 *    from their template would quietly rewrite what weeks one through five had prescribed,
 *    using whatever equipment you own *now*. So a session keeps everything except its date.
 *
 * 2. **Only what no longer fits is touched.** A session on a day that still works stays
 *    exactly where it is, even where shuffling it would space the week better. The preview
 *    has to be something you can recognise as your own week, and a reshuffle that moves
 *    sessions you never asked about is one you stop trusting.
 *
 * 3. **Displaced work stays inside its own week, or it is dropped.** Cascading into next week
 *    keeps the volume but slides the whole plan away from the date it was counting back to.
 *    Losing a session is the smaller lie, and it is reported rather than done quietly.
 *
 * Nothing here writes. It returns what *would* happen so it can be shown first.
 */

import type {
  AvailabilityRule,
  CalendarException,
  DayKey,
  PlannedSession,
  Weekday,
} from './types';
import { weekDays } from './dates';
import { resolveDayAvailability, type DayAvailability } from './scheduling';

export interface PlannedMove {
  session: PlannedSession;
  from: DayKey;
  to: DayKey;
}

export interface PlannedDrop {
  session: PlannedSession;
  reason: string;
}

export interface ReshufflePlan {
  moves: PlannedMove[];
  drops: PlannedDrop[];
  /** Sessions whose day still works, left untouched. */
  kept: number;
  /** True when nothing needs to happen. */
  settled: boolean;
}

export interface ReshuffleOptions {
  /** Every planned session in range. Anything started, completed or skipped is ignored. */
  sessions: PlannedSession[];
  availability: AvailabilityRule[];
  exceptions: CalendarException[];
  /** Today. Nothing before this is considered, and nothing is ever moved into the past. */
  from: DayKey;
  weekStartsOn: Weekday;
}

/**
 * Whether a day can hold a session.
 *
 * Every modality the session needs has to be allowed. A day you marked cardio-only cannot
 * take a session that also lifts — it is half a contradiction of the constraint you set, and
 * accepting it would make availability advisory rather than real. A session carrying no
 * modalities at all was added by hand, so any open day will do.
 */
function dayFits(day: DayAvailability, session: PlannedSession): boolean {
  if (day.blocked) return false;
  const needed = session.prescription?.modalities ?? [];
  return needed.every((modality) => day.allowedModalities.includes(modality));
}

/**
 * Days of `date`'s own week that are not in the past, nearest to `date` first.
 *
 * Ties go to the later day. Thursday and Tuesday are both one day from Wednesday, but moving
 * work *earlier* than it was planned can land it on today with no notice, or on a day you
 * have already trained. Moving it later only ever asks you to wait.
 */
function candidateDays(date: DayKey, from: DayKey, weekStartsOn: Weekday): DayKey[] {
  return weekDays(date, weekStartsOn)
    .filter((day) => day >= from && day !== date)
    .sort((a, b) => {
      const byDistance = Math.abs(dayGap(a, date)) - Math.abs(dayGap(b, date));
      return byDistance !== 0 ? byDistance : dayGap(b, a);
    });
}

/** Signed difference in days, using the sortable key rather than parsing dates. */
function dayGap(a: DayKey, b: DayKey): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

export function planReshuffle(options: ReshuffleOptions): ReshufflePlan {
  const { availability, exceptions, from, weekStartsOn } = options;

  const upcoming = options.sessions
    .filter((session) => session.status === 'planned' && session.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date));

  /*
   * Which days are spoken for. Seeded with every session in range — including the ones that
   * will not move — so a displaced session is never dropped on top of one that was already
   * fine, and updated as the plan is built so two displaced sessions cannot claim one day.
   */
  const occupied = new Set(upcoming.map((session) => session.date));

  const moves: PlannedMove[] = [];
  const drops: PlannedDrop[] = [];
  let kept = 0;

  for (const session of upcoming) {
    const today = resolveDayAvailability(session.date, availability, exceptions);
    if (dayFits(today, session)) {
      kept++;
      continue;
    }

    // It is leaving this day either way, so the day is free for anything after it.
    occupied.delete(session.date);

    const target = candidateDays(session.date, from, weekStartsOn).find((day) => {
      if (occupied.has(day)) return false;
      return dayFits(resolveDayAvailability(day, availability, exceptions), session);
    });

    if (target) {
      occupied.add(target);
      moves.push({ session, from: session.date, to: target });
    } else {
      drops.push({ session, reason: dropReason(session, from, weekStartsOn, options) });
    }
  }

  return { moves, drops, kept, settled: moves.length === 0 && drops.length === 0 };
}

/** Why a session had nowhere to go — the two cases read very differently to an athlete. */
function dropReason(
  session: PlannedSession,
  from: DayKey,
  weekStartsOn: Weekday,
  options: ReshuffleOptions,
): string {
  const anyDayCouldHoldIt = candidateDays(session.date, from, weekStartsOn).some((day) =>
    dayFits(resolveDayAvailability(day, options.availability, options.exceptions), session),
  );

  return anyDayCouldHoldIt
    ? 'The days that fit are already taken'
    : 'No day left this week takes this kind of session';
}

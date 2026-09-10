/**
 * Calendar-day helpers.
 *
 * Everything date-keyed in this app uses a `DayKey` ("YYYY-MM-DD") in the user's LOCAL
 * timezone, never a `Date` or a UTC instant. A workout done at 9 pm on the 5th belongs to
 * the 5th no matter what UTC thinks, and a plan laid out across a DST boundary must not
 * drift by a day.
 */

import type { DayKey, Weekday } from './types';
import { translate } from '../i18n/copy';
import type { Language } from './types';

const MS_PER_DAY = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midnight local time on the given day. */
export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + days); // handles month/year/DST rollover correctly
  return toDayKey(d);
}

export function addWeeks(key: DayKey, weeks: number): DayKey {
  return addDays(key, weeks * 7);
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetween(a: DayKey, b: DayKey): number {
  // Compare at UTC midnight so DST shifts cannot produce a 23- or 25-hour "day".
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const au = Date.UTC(ay, am - 1, ad);
  const bu = Date.UTC(by, bm - 1, bd);
  return Math.round((bu - au) / MS_PER_DAY);
}

export function weekdayOf(key: DayKey): Weekday {
  return fromDayKey(key).getDay() as Weekday;
}

export function startOfWeek(key: DayKey, weekStartsOn: Weekday = 0): DayKey {
  const diff = (weekdayOf(key) - weekStartsOn + 7) % 7;
  return addDays(key, -diff);
}

/** The seven day keys of the week containing `key`. */
export function weekDays(key: DayKey, weekStartsOn: Weekday = 0): DayKey[] {
  const start = startOfWeek(key, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Inclusive range, for calendar grids and analytics windows. */
export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let d = from; daysBetween(d, to) >= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

export function startOfMonth(key: DayKey): DayKey {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonth(key: DayKey): DayKey {
  const [y, m] = key.split('-').map(Number);
  return toDayKey(new Date(y, m, 0)); // day 0 of next month = last day of this one
}

/**
 * The full calendar grid for a month view: leading and trailing days from the
 * neighbouring months so the grid is always whole weeks.
 */
export function monthGrid(key: DayKey, weekStartsOn: Weekday = 0): DayKey[] {
  const first = startOfWeek(startOfMonth(key), weekStartsOn);
  const lastDay = endOfMonth(key);
  const last = addDays(startOfWeek(lastDay, weekStartsOn), 6);
  return dayRange(first, last);
}

/*
 * Dates are the one piece of copy that is not copy.
 *
 * "Wednesday" translated by a table would still be "Wed, Aug 26" in Spanish, where the day
 * comes before the month and neither is capitalised. `Intl` knows all of that already, and
 * knows it for every locale rather than the two this app currently offers.
 *
 * The language is set once by `AppProvider` rather than threaded through the forty-odd call
 * sites, which is a deliberate exception to how `units` and the run voice are passed. Those
 * two change what is said; this changes only how a number is spelled, no test asserts on it,
 * and a date formatter is the kind of thing that is genuinely ambient.
 */
let locale = 'en-US';

/** Called by `AppProvider` when the profile's language is known, and again when it changes. */
export function setDateLocale(lang: Language | undefined): void {
  locale = lang === 'es' ? 'es-419' : 'en-US';
}

/** A date sitting on the given weekday, for asking Intl what that weekday is called. */
function sample(weekday: Weekday): Date {
  // 2024-01-07 was a Sunday. UTC throughout, so a westward timezone cannot roll it back a day.
  return new Date(Date.UTC(2024, 0, 7 + weekday));
}

export function weekdayName(weekday: Weekday, short = false): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: short ? 'short' : 'long',
    timeZone: 'UTC',
  }).format(sample(weekday));
}

export function monthName(key: DayKey, short = false): string {
  const month = Number(key.slice(5, 7)) - 1;
  return new Intl.DateTimeFormat(locale, {
    month: short ? 'short' : 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2024, month, 1)));
}

/** "Today", "Yesterday", "Tomorrow", or "Wed, Aug 26" — and their Spanish equivalents. */
export function formatDayLabel(key: DayKey, relativeTo: DayKey = todayKey()): string {
  const delta = daysBetween(relativeTo, key);
  if (delta === 0) return translate('Today', language());
  if (delta === -1) return translate('Yesterday', language());
  if (delta === 1) return translate('Tomorrow', language());

  const d = fromDayKey(key);
  // Ordering is the formatter's problem, not ours: "Wed, Aug 26" and "mié, 26 ago" are the
  // same request answered twice.
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === fromDayKey(relativeTo).getFullYear() ? undefined : 'numeric',
  }).format(d);
}

/** The language the locale was set from, for the words Intl has no opinion about. */
function language(): Language {
  return locale.startsWith('es') ? 'es' : 'en';
}

export function isSameMonth(a: DayKey, b: DayKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

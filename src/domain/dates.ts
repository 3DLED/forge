/**
 * Calendar-day helpers.
 *
 * Everything date-keyed in this app uses a `DayKey` ("YYYY-MM-DD") in the user's LOCAL
 * timezone, never a `Date` or a UTC instant. A workout done at 9 pm on the 5th belongs to
 * the 5th no matter what UTC thinks, and a plan laid out across a DST boundary must not
 * drift by a day.
 */

import type { DayKey, Weekday } from './types';

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

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function weekdayName(weekday: Weekday, short = false): string {
  const name = WEEKDAY_NAMES[weekday];
  return short ? name.slice(0, 3) : name;
}

export function monthName(key: DayKey, short = false): string {
  const name = MONTH_NAMES[Number(key.slice(5, 7)) - 1];
  return short ? name.slice(0, 3) : name;
}

/** "Today", "Yesterday", "Tomorrow", or "Wed, Aug 26". */
export function formatDayLabel(key: DayKey, relativeTo: DayKey = todayKey()): string {
  const delta = daysBetween(relativeTo, key);
  if (delta === 0) return 'Today';
  if (delta === -1) return 'Yesterday';
  if (delta === 1) return 'Tomorrow';
  const d = fromDayKey(key);
  const year = d.getFullYear() === fromDayKey(relativeTo).getFullYear() ? '' : `, ${d.getFullYear()}`;
  return `${weekdayName(weekdayOf(key), true)}, ${monthName(key, true)} ${d.getDate()}${year}`;
}

export function isSameMonth(a: DayKey, b: DayKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

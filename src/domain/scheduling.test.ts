import { describe, expect, it } from 'vitest';
import { placeSlotsInWeek, resolveDayAvailability, resolveWeekAvailability } from './scheduling';
import type { AvailabilityRule, CalendarException, Modality, Weekday } from './types';

/** Sunday 4 Jan 2026 through Saturday 10 Jan. */
const WEEK = [
  '2026-01-04',
  '2026-01-05',
  '2026-01-06',
  '2026-01-07',
  '2026-01-08',
  '2026-01-09',
  '2026-01-10',
];

const MONDAY = WEEK[1];

/** Every weekday open to everything, unless overridden. */
function openWeek(over: Partial<Record<Weekday, Modality[]>> = {}): AvailabilityRule[] {
  const all: Modality[] = ['strength', 'cardio', 'mobility', 'skill'];
  return Array.from({ length: 7 }, (_, i) => ({
    weekday: i as Weekday,
    allowedModalities: over[i as Weekday] ?? all,
  }));
}

const blackout = (startDate: string, endDate = startDate): CalendarException =>
  ({ id: 'x', kind: 'blackout', startDate, endDate }) as CalendarException;

describe('resolveDayAvailability', () => {
  it('takes the weekday rule as the baseline', () => {
    const day = resolveDayAvailability(MONDAY, openWeek({ 1: ['strength'] }), []);
    expect(day.allowedModalities).toEqual(['strength']);
    expect(day.blocked).toBe(false);
  });

  it('calls a weekday with nothing selected a rest day', () => {
    const day = resolveDayAvailability(MONDAY, openWeek({ 1: [] }), []);
    expect(day.blocked).toBe(true);
    expect(day.reason).toBe('Rest day');
  });

  it('blocks a day inside a blackout', () => {
    const day = resolveDayAvailability(MONDAY, openWeek(), [blackout(MONDAY)]);
    expect(day.blocked).toBe(true);
  });

  it('blocks every day of a multi-day blackout, and nothing outside it', () => {
    const holiday = blackout(WEEK[1], WEEK[3]);
    const inside = WEEK.slice(1, 4).map((d) => resolveDayAvailability(d, openWeek(), [holiday]));
    const after = resolveDayAvailability(WEEK[4], openWeek(), [holiday]);

    expect(inside.every((d) => d.blocked)).toBe(true);
    expect(after.blocked).toBe(false);
  });

  it('narrows a day to the overlap when an exception restricts it', () => {
    const restricted = {
      id: 'x',
      kind: 'restricted',
      startDate: MONDAY,
      endDate: MONDAY,
      allowedModalities: ['cardio', 'mobility'],
    } as CalendarException;

    const day = resolveDayAvailability(MONDAY, openWeek({ 1: ['strength', 'cardio'] }), [restricted]);
    expect(day.allowedModalities).toEqual(['cardio']);
  });

  /**
   * An exception is a constraint you added, so it can only ever subtract. Letting one widen a
   * day would mean a "travelling, cardio only" note quietly granting strength training on a
   * day marked rest.
   */
  it('never lets an exception grant training the weekday rule did not', () => {
    const restricted = {
      id: 'x',
      kind: 'restricted',
      startDate: MONDAY,
      endDate: MONDAY,
      allowedModalities: ['strength', 'cardio'],
    } as CalendarException;

    const day = resolveDayAvailability(MONDAY, openWeek({ 1: [] }), [restricted]);
    expect(day.allowedModalities).toEqual([]);
    expect(day.blocked).toBe(true);
  });
});

describe('placeSlotsInWeek', () => {
  const days = (rules: AvailabilityRule[], exceptions: CalendarException[] = []) =>
    resolveWeekAvailability(WEEK, rules, exceptions);

  it('spreads sessions across the week instead of packing the front', () => {
    const placements = placeSlotsInWeek(days(openWeek()), [
      { modality: 'strength', order: 1 },
      { modality: 'strength', order: 2 },
      { modality: 'strength', order: 3 },
    ]);

    const dates = placements.map((p) => p.date);
    expect(dates).toEqual([WEEK[0], WEEK[3], WEEK[6]]);
  });

  it('never puts two sessions on the same day', () => {
    const placements = placeSlotsInWeek(days(openWeek()), [
      { modality: 'strength', order: 1 },
      { modality: 'cardio', order: 2 },
      { modality: 'strength', order: 3 },
      { modality: 'cardio', order: 4 },
    ]);

    const dates = placements.map((p) => p.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('walks past a day that does not accept the slot', () => {
    // Only Monday and Thursday take strength.
    const rules = openWeek({ 0: ['cardio'], 2: ['cardio'], 3: ['cardio'], 5: ['cardio'], 6: ['cardio'] });
    const placements = placeSlotsInWeek(days(rules), [
      { modality: 'strength', order: 1 },
      { modality: 'strength', order: 2 },
    ]);

    expect(placements.every((p) => p.date !== null)).toBe(true);
    expect(placements.map((p) => p.date).sort()).toEqual([WEEK[1], WEEK[4]]);
  });

  it('reports a slot it cannot place rather than dropping it silently', () => {
    const rules = openWeek(
      Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, ['cardio']])) as Partial<
        Record<Weekday, Modality[]>
      >,
    );

    const placements = placeSlotsInWeek(days(rules), [{ modality: 'strength', order: 1 }]);

    expect(placements[0].date).toBeNull();
    expect(placements[0].reason).toContain('strength');
  });

  it('reports every slot when the whole week is blocked out', () => {
    const placements = placeSlotsInWeek(days(openWeek(), [blackout(WEEK[0], WEEK[6])]), [
      { modality: 'strength', order: 1 },
      { modality: 'cardio', order: 2 },
    ]);

    expect(placements.every((p) => p.date === null)).toBe(true);
    expect(placements[0].reason).toBe('No available days this week');
  });

  it('places what it can and flags the overflow when days run out', () => {
    const rules = openWeek({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] });
    const placements = placeSlotsInWeek(days(rules), [
      { modality: 'strength', order: 1 },
      { modality: 'strength', order: 2 },
    ]);

    expect(placements.filter((p) => p.date !== null)).toHaveLength(1);
    expect(placements.filter((p) => p.date === null)).toHaveLength(1);
  });

  it('honours slot order rather than the order it was handed them', () => {
    const placements = placeSlotsInWeek(days(openWeek()), [
      { modality: 'cardio', order: 9 },
      { modality: 'strength', order: 1 },
    ]);

    expect(placements[0].slot.modality).toBe('strength');
    expect(placements[0].date! < placements[1].date!).toBe(true);
  });
});

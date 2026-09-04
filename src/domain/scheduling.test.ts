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

/**
 * Days you pinned yourself, for a plan you laid out rather than one the app fitted in.
 *
 * The difference from a floating slot is that a pinned one is an instruction. Saying
 * "Wednesday" in a plan you built is the decision — it should not be talked out of it by the
 * weekday rules, which describe your habits rather than this plan.
 */
describe('pinned weekdays', () => {
  const days = (rules: AvailabilityRule[], exceptions: CalendarException[] = []) =>
    resolveWeekAvailability(WEEK, rules, exceptions);

  // WEEK starts Sunday 2026-01-04, so weekday 1 is Monday the 5th and 3 is Wednesday the 7th.
  const MONDAY = '2026-01-05';
  const WEDNESDAY = '2026-01-07';

  it('puts a pinned slot on its day', () => {
    const [placement] = placeSlotsInWeek(days(openWeek()), [
      { modality: 'strength', order: 1, weekday: 3 as Weekday },
    ]);

    expect(placement.date).toBe(WEDNESDAY);
  });

  it('honours the day even where the weekday rules say you rest', () => {
    const rules = openWeek({ 3: [] });
    const [placement] = placeSlotsInWeek(days(rules), [
      { modality: 'strength', order: 1, weekday: 3 as Weekday },
    ]);

    expect(placement.date).toBe(WEDNESDAY);
  });

  /* A holiday is a fact about the calendar, not a habit — training through one would be wrong. */
  it('will not schedule through a blacked-out day', () => {
    const [placement] = placeSlotsInWeek(days(openWeek(), [blackout(WEDNESDAY, WEDNESDAY)]), [
      { modality: 'strength', order: 1, weekday: 3 as Weekday },
    ]);

    expect(placement.date).toBeNull();
    expect(placement.reason).toBeTruthy();
  });

  /* The first week of a plan can begin mid-week, and its earlier days simply are not there. */
  it('reports a day that is not in this week at all', () => {
    const partial = resolveWeekAvailability(WEEK.slice(4), openWeek(), []);
    const [placement] = placeSlotsInWeek(partial, [
      { modality: 'strength', order: 1, weekday: 1 as Weekday },
    ]);

    expect(placement.date).toBeNull();
  });

  it('keeps a floating slot off a day something is pinned to', () => {
    const placements = placeSlotsInWeek(days(openWeek()), [
      { modality: 'strength', order: 1, weekday: 3 as Weekday },
      { modality: 'cardio', order: 2 },
      { modality: 'cardio', order: 3 },
    ]);

    const floating = placements.filter((p) => p.slot.weekday == null).map((p) => p.date);
    expect(floating).not.toContain(WEDNESDAY);
    expect(new Set(placements.map((p) => p.date)).size).toBe(3);
  });

  it('settles pinned days before spreading, whatever order they arrive in', () => {
    const placements = placeSlotsInWeek(days(openWeek()), [
      { modality: 'cardio', order: 1 },
      { modality: 'strength', order: 2, weekday: 1 as Weekday },
    ]);

    expect(placements.find((p) => p.slot.weekday === 1)?.date).toBe(MONDAY);
  });

  it('places a whole week you laid out by hand exactly as written', () => {
    const placements = placeSlotsInWeek(days(openWeek()), [
      { modality: 'strength', order: 1, weekday: 1 as Weekday },
      { modality: 'cardio', order: 2, weekday: 3 as Weekday },
      { modality: 'strength', order: 3, weekday: 5 as Weekday },
    ]);

    expect(placements.map((p) => p.date)).toEqual([MONDAY, WEDNESDAY, '2026-01-09']);
  });
});

/**
 * Running two plans at once.
 *
 * Three strength days and four runs is seven sessions, not a choice between them. The rule is
 * to spread around what another plan already booked while anything is free, and to double up
 * once nothing is — so a full week comes out one-a-day, and a narrower one produces the
 * two-a-days deliberately rather than dropping sessions on the floor.
 */
describe('a second plan on the same calendar', () => {
  const days = (rules: AvailabilityRule[], exceptions: CalendarException[] = []) =>
    resolveWeekAvailability(WEEK, rules, exceptions);

  const strength = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ modality: 'strength' as const, order: i + 1 }));

  it('avoids the days the other plan is using while any are free', () => {
    const busy = new Set([WEEK[0], WEEK[2], WEEK[4]]);
    const placements = placeSlotsInWeek(days(openWeek()), strength(3), { busy });

    expect(placements.every((p) => p.date && !busy.has(p.date))).toBe(true);
  });

  /* Seven sessions, seven days: nobody has to double up. */
  it('fits three plus four across a full week without doubling', () => {
    const first = placeSlotsInWeek(days(openWeek()), strength(3));
    const busy = new Set(first.map((p) => p.date!).filter(Boolean));
    const second = placeSlotsInWeek(days(openWeek()), strength(4), { busy });

    const all = [...first, ...second].map((p) => p.date);
    expect(all.every(Boolean)).toBe(true);
    expect(new Set(all).size).toBe(7);
  });

  /* A four-day week with five sessions has to double once, and should — not drop one. */
  it('doubles up rather than dropping a session when the week runs out', () => {
    const rules = openWeek({ 0: [], 6: [] });
    const first = placeSlotsInWeek(days(rules), strength(3));
    const busy = new Set(first.map((p) => p.date!).filter(Boolean));
    const second = placeSlotsInWeek(days(rules), strength(3), { busy });

    expect(second.every((p) => p.date)).toBe(true);
    const doubled = second.filter((p) => busy.has(p.date!));
    expect(doubled.length).toBe(1);
  });

  /* A plan doubling up on itself is a bug, not a two-a-day. */
  it('never puts two of the same plan on one day', () => {
    const rules = openWeek({ 0: [], 1: [], 2: [], 3: [], 4: [] });
    const placements = placeSlotsInWeek(days(rules), strength(3));

    const placed = placements.map((p) => p.date).filter(Boolean);
    expect(new Set(placed).size).toBe(placed.length);
  });

  it('places nothing differently when no other plan is running', () => {
    const withEmpty = placeSlotsInWeek(days(openWeek()), strength(3), { busy: new Set() });
    const without = placeSlotsInWeek(days(openWeek()), strength(3));

    expect(withEmpty.map((p) => p.date)).toEqual(without.map((p) => p.date));
  });

  /* A day you chose yourself outranks tidiness — that is what pinning it meant. */
  it('still honours a pinned day even when the other plan is already there', () => {
    const busy = new Set([WEEK[3]]);
    const [placement] = placeSlotsInWeek(
      days(openWeek()),
      [{ modality: 'strength', order: 1, weekday: 3 as Weekday }],
      { busy },
    );

    expect(placement.date).toBe(WEEK[3]);
  });
});

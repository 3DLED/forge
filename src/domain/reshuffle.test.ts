import { describe, expect, it } from 'vitest';
import { planReshuffle } from './reshuffle';
import type {
  AvailabilityRule,
  CalendarException,
  Modality,
  PlannedSession,
  PlannedStatus,
  Weekday,
} from './types';

/** Sunday 4 Jan 2026 through Saturday 10 Jan. */
const SUN = '2026-01-04';
const MON = '2026-01-05';
const TUE = '2026-01-06';
const WED = '2026-01-07';
const THU = '2026-01-08';
const FRI = '2026-01-09';
const SAT = '2026-01-10';

const ALL: Modality[] = ['strength', 'cardio', 'mobility', 'skill'];

function week(over: Partial<Record<Weekday, Modality[]>> = {}): AvailabilityRule[] {
  return Array.from({ length: 7 }, (_, i) => ({
    weekday: i as Weekday,
    allowedModalities: over[i as Weekday] ?? ALL,
  }));
}

function planned(
  id: string,
  date: string,
  modalities: Modality[] = ['strength'],
  status: PlannedStatus = 'planned',
): PlannedSession {
  return {
    id,
    date,
    status,
    prescription: { name: `Session ${id}`, modalities, blocks: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as PlannedSession;
}

const run = (
  sessions: PlannedSession[],
  availability: AvailabilityRule[],
  extra: { from?: string; exceptions?: CalendarException[] } = {},
) =>
  planReshuffle({
    sessions,
    availability,
    exceptions: extra.exceptions ?? [],
    from: extra.from ?? SUN,
    weekStartsOn: 0,
  });

describe('planReshuffle', () => {
  it('does nothing when every session still fits', () => {
    const result = run([planned('a', MON), planned('b', WED)], week());

    expect(result.settled).toBe(true);
    expect(result.kept).toBe(2);
    expect(result.moves).toEqual([]);
    expect(result.drops).toEqual([]);
  });

  it('moves a session off a day that just became a rest day', () => {
    // Wednesday closed.
    const result = run([planned('a', WED)], week({ 3: [] }));

    expect(result.moves).toHaveLength(1);
    expect(result.moves[0]).toMatchObject({ from: WED, to: THU });
    expect(result.drops).toEqual([]);
  });

  it('moves it to the nearest day that works, in either direction', () => {
    // Wednesday and Thursday closed, so Tuesday is nearer than Friday.
    const result = run([planned('a', WED)], week({ 3: [], 4: [] }));

    expect(result.moves[0].to).toBe(TUE);
  });

  /** Rule two: a session on a day that still works is not touched, ever. */
  it('leaves sessions that still fit exactly where they are', () => {
    const result = run([planned('a', MON), planned('b', WED)], week({ 3: [] }));

    expect(result.kept).toBe(1);
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0].session.id).toBe('b');
  });

  it('never lands a displaced session on a day already holding one', () => {
    // Wednesday closed; Thursday is nearest but taken, so Tuesday.
    const result = run([planned('a', WED), planned('b', THU)], week({ 3: [] }));

    expect(result.moves).toHaveLength(1);
    expect(result.moves[0]).toMatchObject({ session: expect.objectContaining({ id: 'a' }), to: TUE });
  });

  it('does not let two displaced sessions claim the same day', () => {
    // Tuesday and Wednesday both closed.
    const result = run([planned('a', TUE), planned('b', WED)], week({ 2: [], 3: [] }));

    const targets = result.moves.map((m) => m.to);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('respects the kind of training a day accepts', () => {
    // Wednesday closed; Thursday is cardio-only, so a strength session skips it.
    const result = run([planned('a', WED, ['strength'])], week({ 3: [], 4: ['cardio'] }));

    expect(result.moves[0].to).toBe(TUE);
  });

  it('needs every modality a hybrid session asks for', () => {
    // Wednesday closed. Thursday runs but does not lift, so a session doing both cannot go.
    const result = run(
      [planned('a', WED, ['strength', 'cardio'])],
      week({ 3: [], 4: ['cardio'] }),
    );

    expect(result.moves[0].to).toBe(TUE);
  });

  it('treats a session added by hand as fitting any open day', () => {
    const result = run([planned('a', WED, [])], week({ 3: [], 4: ['cardio'] }));

    expect(result.moves[0].to).toBe(THU);
  });

  it('drops a session when nothing in its week takes that kind of training', () => {
    const cardioOnly = Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [i, ['cardio']]),
    ) as Partial<Record<Weekday, Modality[]>>;

    const result = run([planned('a', WED, ['strength'])], week(cardioOnly));

    expect(result.moves).toEqual([]);
    expect(result.drops).toHaveLength(1);
    expect(result.drops[0].reason).toMatch(/no day left this week/i);
  });

  it('drops the overflow when the week has fewer days than sessions', () => {
    // Only Monday and Tuesday train; four sessions want a home.
    const rules = week({ 0: [], 3: [], 4: [], 5: [], 6: [] });
    const result = run(
      [planned('a', WED), planned('b', THU), planned('c', FRI), planned('d', SAT)],
      rules,
    );

    expect(result.moves).toHaveLength(2);
    expect(result.drops).toHaveLength(2);
    expect(result.drops[0].reason).toMatch(/already taken/i);
  });

  /** Rule three: displaced work stays in its own week rather than sliding the plan forward. */
  it('never pushes a session into another week', () => {
    const rules = week({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] });
    const result = run([planned('a', WED), planned('b', THU)], rules);

    for (const move of result.moves) {
      expect(move.to >= SUN && move.to <= SAT).toBe(true);
    }
    expect(result.moves.length + result.drops.length).toBe(2);
  });

  it('never moves a session into the past', () => {
    // Today is Thursday; Friday is closed, so the only way back is Saturday.
    const result = run([planned('a', FRI)], week({ 5: [] }), { from: THU });

    expect(result.moves[0].to).toBe(SAT);
  });

  /**
   * The case that tells the rule apart from the tie-break. Where a nearer day exists in both
   * directions, preferring the later one already avoids the past; here every day that would
   * fit has already gone, and the only honest answer is to drop the session rather than
   * schedule it for last Tuesday.
   */
  it('drops a session rather than moving it backwards when only past days fit', () => {
    // Today is Friday. Friday and Saturday are closed; the open days are all behind us.
    const result = run([planned('a', FRI)], week({ 5: [], 6: [] }), { from: FRI });

    expect(result.moves).toEqual([]);
    expect(result.drops).toHaveLength(1);
  });

  it('ignores days already behind us when deciding what is taken', () => {
    const result = run([planned('a', MON), planned('b', FRI)], week({ 5: [] }), { from: THU });

    // Monday is in the past and not this reshuffle's business.
    expect(result.kept).toBe(0);
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0].session.id).toBe('b');
  });

  it('leaves completed, skipped and started sessions alone', () => {
    const result = run(
      [
        planned('done', WED, ['strength'], 'completed'),
        planned('skipped', WED, ['strength'], 'skipped'),
        planned('moved', WED, ['strength'], 'moved'),
      ],
      week({ 3: [] }),
    );

    expect(result.settled).toBe(true);
    expect(result.moves).toEqual([]);
    expect(result.drops).toEqual([]);
  });

  it('treats a blackout the same as a closed day', () => {
    const holiday = {
      id: 'x',
      kind: 'blackout',
      startDate: WED,
      endDate: WED,
    } as CalendarException;

    const result = run([planned('a', WED)], week(), { exceptions: [holiday] });

    // Thursday, not Tuesday: equal distance, and a tie never moves work earlier.
    expect(result.moves[0]).toMatchObject({ from: WED, to: THU });
  });

  it('moves a session out of a multi-day blackout to the far side of it', () => {
    const trip = {
      id: 'x',
      kind: 'blackout',
      startDate: MON,
      endDate: THU,
    } as CalendarException;

    const result = run([planned('a', TUE)], week(), { exceptions: [trip] });

    expect([FRI, SUN]).toContain(result.moves[0].to);
  });

  it('reports a settled plan as settled, whatever else is in range', () => {
    const result = run([], week({ 3: [] }));
    expect(result.settled).toBe(true);
    expect(result.kept).toBe(0);
  });
});

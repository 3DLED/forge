import { describe, expect, it } from 'vitest';
import {
  acuteChronicRatio,
  consistency,
  effortBand,
  effortMinutes,
  estimate1RM,
  personalRecords,
  prEventsBySession,
  pushPullRatio,
  scanRecords,
  sessionDistanceM,
  sessionLoad,
  sessionVolumeKg,
  setVolumeKg,
  volumeByPattern,
  workoutKey,
} from './training';
import type { Exercise, LoggedSession, LoggedSet, PlannedSession } from './types';

/**
 * Fixtures are built by hand rather than imported from the seed library: a test that breaks
 * because someone edited an exercise's muscle list is a test that gets deleted.
 */
function set(exerciseSlug: string, values: LoggedSet['values'], completed = true): LoggedSet {
  return { id: `${exerciseSlug}-${JSON.stringify(values)}`, exerciseSlug, setIndex: 0, values, completed };
}

function session(id: string, date: string, sets: LoggedSet[]): LoggedSession {
  return {
    id,
    date,
    name: id,
    sets,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
    endedAt: `${date}T11:00:00.000Z`,
  } as LoggedSession;
}

const exercise = (over: Partial<Exercise> = {}): Exercise =>
  ({ bodyweightFactor: 0, unilateral: false, ...over }) as Exercise;

describe('estimate1RM', () => {
  it('refuses rep counts where the formula stops meaning anything', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 1);
    expect(estimate1RM(100, 12)).not.toBeNull();
    expect(estimate1RM(100, 13)).toBeNull();
    expect(estimate1RM(100, 30)).toBeNull();
  });

  it('rejects nonsense input rather than returning it', () => {
    expect(estimate1RM(0, 5)).toBeNull();
    expect(estimate1RM(100, 0)).toBeNull();
  });
});

describe('setVolumeKg', () => {
  it('counts bodyweight for movements that carry it', () => {
    const pushUp = exercise({ bodyweightFactor: 0.65 });
    // 0.65 x 80kg x 10 reps
    expect(setVolumeKg(set('push-up', { reps: 10 }), pushUp, 80)).toBeCloseTo(520);
  });

  it('stacks added load on top of bodyweight rather than replacing it', () => {
    const pullUp = exercise({ bodyweightFactor: 1 });
    // (80 + 20) x 5
    expect(setVolumeKg(set('pull-up', { reps: 5, weightKg: 20 }), pullUp, 80)).toBeCloseTo(500);
  });

  it('doubles one-sided work that did not say which side', () => {
    const carry = exercise({ unilateral: true });
    expect(setVolumeKg(set('carry', { reps: 10, weightKg: 24 }), carry)).toBeCloseTo(480);
  });

  it('counts one side when the set names one', () => {
    const carry = exercise({ unilateral: true });
    const oneSided = { ...set('carry', { reps: 10, weightKg: 24 }), side: 'left' as const };
    expect(setVolumeKg(oneSided, carry)).toBeCloseTo(240);
  });

  it('ignores sets that were never completed', () => {
    const squat = exercise();
    const bySlug = new Map([['squat', squat]]);
    const s = session('a', '2026-01-01', [
      set('squat', { reps: 5, weightKg: 100 }),
      set('squat', { reps: 5, weightKg: 100 }, false),
    ]);
    expect(sessionVolumeKg(s, bySlug)).toBeCloseTo(500);
  });
});

/*
 * Inside a timed block a set is the recipe for one round, not one performance of it, and the
 * block's round count is the record that it happened. Both halves of that matter: counting
 * the recipe once undercounts an AMRAP by however many rounds were done, and waiting for a
 * tick that the block flow never applies counts it as nothing at all.
 */
describe('sessionVolumeKg inside a timed block', () => {
  const bySlug = new Map([['kb-swing', exercise()]]);

  function amrap(rounds: number | undefined, sets: LoggedSet[]): LoggedSession {
    return {
      ...session('a', '2026-01-01', sets),
      blocks: [{ id: 'b1', style: 'amrap', rounds }],
    } as LoggedSession;
  }

  const inBlock = (values: LoggedSet['values'], completed = false): LoggedSet => ({
    ...set('kb-swing', values, completed),
    blockId: 'b1',
  });

  it('counts every round, not just the one the set describes', () => {
    // Seven rounds of ten swings with a 12 kg bell.
    const s = amrap(7, [inBlock({ reps: 10, weightKg: 12 })]);
    expect(sessionVolumeKg(s, bySlug)).toBeCloseTo(840);
  });

  it('counts the work even though nothing inside the block was ticked', () => {
    const s = amrap(3, [inBlock({ reps: 5, weightKg: 20 })]);
    expect(sessionVolumeKg(s, bySlug)).toBeCloseTo(300);
  });

  it('counts nothing for a block that was never run', () => {
    const s = amrap(undefined, [inBlock({ reps: 10, weightKg: 12 })]);
    expect(sessionVolumeKg(s, bySlug)).toBe(0);
  });

  /*
   * A set ticked by hand is a fact about one performance, and `convertSessionToBlock` keeps
   * those when it folds a workout into a block. Multiplying them by the rounds would invent
   * work that was recorded precisely because it was not part of the recipe.
   */
  it('counts a hand-ticked set once rather than once per round', () => {
    const s = amrap(7, [inBlock({ reps: 10, weightKg: 12 }, true)]);
    expect(sessionVolumeKg(s, bySlug)).toBeCloseTo(120);
  });

  it('counts the distance in every round too', () => {
    // A 200 m shuttle inside each of five rounds is a kilometre.
    const s = amrap(5, [inBlock({ distanceM: 200 })]);
    expect(sessionDistanceM(s)).toBeCloseTo(1000);
  });
});

describe('sessionLoad', () => {
  it('is effort times minutes', () => {
    const s = { ...session('a', '2026-01-01', []), sessionRpe: 7, durationMin: 60 };
    expect(sessionLoad(s)).toBe(420);
  });

  it('falls back to the average per-set effort when the session was never rated', () => {
    const s = {
      ...session('a', '2026-01-01', [
        set('squat', { reps: 5, rpe: 6 }),
        set('squat', { reps: 5, rpe: 8 }),
      ]),
      durationMin: 60,
    };
    expect(sessionLoad(s)).toBe(420);
  });

  it('is zero when nothing rated the effort at all', () => {
    const s = { ...session('a', '2026-01-01', [set('squat', { reps: 5 })]), durationMin: 60 };
    expect(sessionLoad(s)).toBe(0);
  });
});

describe('effortMinutes', () => {
  const rated = (rpe: number, durationMin: number): LoggedSession => ({
    ...session(`s${rpe}-${durationMin}`, '2026-01-01', []),
    sessionRpe: rpe,
    durationMin,
  });

  it('splits the week by how hard the work was', () => {
    const out = effortMinutes([rated(3, 60), rated(6, 45), rated(9, 30)]);
    expect(out).toEqual({ easy: 60, moderate: 45, hard: 30 });
  });

  /*
   * The boundaries themselves, because they are a judgement rather than a fact and a silent
   * change to one would move every chart in the app without failing anything.
   */
  it('puts the boundaries at 4 and 7', () => {
    expect(effortBand(4)).toBe('easy');
    expect(effortBand(5)).toBe('moderate');
    expect(effortBand(7)).toBe('moderate');
    expect(effortBand(8)).toBe('hard');
  });

  it('weights by minutes rather than counting sessions', () => {
    // One long easy run outweighs two short hard ones, which is the point of the chart.
    const out = effortMinutes([rated(3, 120), rated(9, 20), rated(9, 20)]);
    expect(out.easy).toBe(120);
    expect(out.hard).toBe(40);
  });

  it('falls back to the average set effort when the session was never rated', () => {
    const s = {
      ...session('a', '2026-01-01', [set('squat', { reps: 5, rpe: 9 })]),
      durationMin: 30,
    };
    expect(effortMinutes([s]).hard).toBe(30);
  });

  /*
   * Counting an unrated session as easy would flatter the ratio in exactly the direction
   * that makes it useless: the sessions people forget to rate are rarely the gentle ones.
   */
  it('ignores a session nobody rated rather than assuming it was easy', () => {
    const s = { ...session('a', '2026-01-01', [set('squat', { reps: 5 })]), durationMin: 60 };
    expect(effortMinutes([s])).toEqual({ easy: 0, moderate: 0, hard: 0 });
  });
});

describe('consistency', () => {
  const slot = (date: string, status: string): PlannedSession =>
    ({ id: `${date}-${status}`, date, status, prescription: {} }) as PlannedSession;

  const done = (date: string, plannedSessionId?: string): LoggedSession => ({
    ...session(`log-${date}-${plannedSessionId ?? 'free'}`, date, []),
    plannedSessionId,
  });

  it('splits what was due into done, skipped and missed', () => {
    const out = consistency(
      [
        slot('2026-01-01', 'completed'),
        slot('2026-01-02', 'skipped'),
        slot('2026-01-03', 'planned'),
      ],
      [],
      '2026-01-05',
    );
    expect(out).toMatchObject({ due: 3, done: 1, skipped: 1, missed: 1 });
  });

  /*
   * A week still running is counted to today. Otherwise every current week opens at nought
   * and climbs, which reads as failure until Sunday.
   */
  it('does not count days that have not happened yet', () => {
    const out = consistency(
      [slot('2026-01-01', 'completed'), slot('2026-01-09', 'planned')],
      [],
      '2026-01-05',
    );
    expect(out.due).toBe(1);
    expect(out.missed).toBe(0);
  });

  /*
   * Otherwise shifting a session from Tuesday to Thursday scores worse than not training:
   * a miss where it left and a bonus where it landed.
   */
  it('ignores a slot that moved, since it counts where it went', () => {
    const out = consistency([slot('2026-01-01', 'moved')], [], '2026-01-05');
    expect(out).toMatchObject({ due: 0, missed: 0 });
  });

  it('counts a session no plan asked for as extra rather than adherence', () => {
    const out = consistency([slot('2026-01-01', 'completed')], [done('2026-01-02')], '2026-01-05');
    expect(out.done).toBe(1);
    expect(out.extra).toBe(1);
    expect(out.due).toBe(1);
  });

  it('does not count a planned session twice by also calling it extra', () => {
    const out = consistency(
      [slot('2026-01-01', 'completed')],
      [done('2026-01-01', '2026-01-01-completed')],
      '2026-01-05',
    );
    expect(out.extra).toBe(0);
  });
});

describe('volumeByPattern', () => {
  const bySlug = new Map<string, Exercise>([
    ['bench', exercise({ pattern: 'pushHorizontal' })],
    ['press', exercise({ pattern: 'pushVertical' })],
    ['row', exercise({ pattern: 'pullHorizontal' })],
    ['squat', exercise({ pattern: 'squat' })],
    ['push-up', exercise({ pattern: 'pushHorizontal', bodyweightFactor: 0.65 })],
  ]);

  const find = (rows: ReturnType<typeof volumeByPattern>, pattern: string) =>
    rows.find((row) => row.pattern === pattern)!;

  it('adds sets and tonnage into the pattern the movement belongs to', () => {
    const rows = volumeByPattern(
      [
        session('a', '2026-01-01', [
          set('bench', { reps: 5, weightKg: 60 }),
          set('press', { reps: 5, weightKg: 40 }),
        ]),
      ],
      bySlug,
    );
    expect(find(rows, 'pushHorizontal')).toMatchObject({ sets: 1, volumeKg: 300 });
    expect(find(rows, 'pushVertical')).toMatchObject({ sets: 1, volumeKg: 200 });
  });

  /*
   * The point of the chart is the rows with nothing in them. Dropping them would answer what
   * was trained while hiding what was not, which is the question worth opening the page for.
   */
  it('reports every pattern, including the ones with no work in them', () => {
    const rows = volumeByPattern([session('a', '2026-01-01', [set('squat', { reps: 5 })])], bySlug);
    expect(rows).toHaveLength(11);
    expect(find(rows, 'pullVertical')).toMatchObject({ sets: 0, volumeKg: 0 });
  });

  it('puts the most-trained pattern first, so the tail is what is being neglected', () => {
    const rows = volumeByPattern(
      [
        session('a', '2026-01-01', [
          set('bench', { reps: 5, weightKg: 60 }),
          set('bench', { reps: 5, weightKg: 60 }),
          set('row', { reps: 5, weightKg: 50 }),
        ]),
      ],
      bySlug,
    );
    expect(rows[0].pattern).toBe('pushHorizontal');
    expect(rows.at(-1)!.sets).toBe(0);
  });

  it('counts each round of a timed block, the way volume does', () => {
    const amrap = {
      ...session('a', '2026-01-01', [
        { ...set('row', { reps: 10, weightKg: 20 }, false), blockId: 'b1' },
      ]),
      blocks: [{ id: 'b1', style: 'amrap' as const, rounds: 6 }],
    } as LoggedSession;
    expect(find(volumeByPattern([amrap], bySlug), 'pullHorizontal')).toMatchObject({
      sets: 6,
      volumeKg: 1200,
    });
  });

  it('leaves an unticked set out entirely, rather than counting it as a set of nothing', () => {
    const rows = volumeByPattern(
      [session('a', '2026-01-01', [set('squat', { reps: 5, weightKg: 100 }, false)])],
      bySlug,
    );
    expect(find(rows, 'squat')).toMatchObject({ sets: 0, volumeKg: 0 });
  });

  it('values a bodyweight set at what was weighed that day', () => {
    const lookup = {
      entries: [],
      latest: 90,
      latestDate: undefined,
      at: (date: string) => (date < '2026-06-01' ? 80 : 90),
    };
    const rows = volumeByPattern(
      [
        session('a', '2026-01-01', [set('push-up', { reps: 10 })]),
        session('b', '2026-07-01', [set('push-up', { reps: 10 })]),
      ],
      bySlug,
      lookup,
    );
    // 0.65 x 80 x 10, then 0.65 x 90 x 10.
    expect(find(rows, 'pushHorizontal').volumeKg).toBeCloseTo(520 + 585);
  });

  it('ignores a set whose movement is not in the library', () => {
    const rows = volumeByPattern(
      [session('a', '2026-01-01', [set('mystery', { reps: 5, weightKg: 50 })])],
      bySlug,
    );
    expect(rows.every((row) => row.sets === 0)).toBe(true);
  });
});

describe('pushPullRatio', () => {
  const rows = (over: Record<string, number>) =>
    Object.entries(over).map(([pattern, sets]) => ({
      pattern,
      sets,
      volumeKg: 0,
    })) as ReturnType<typeof volumeByPattern>;

  it('folds horizontal and vertical into one figure on each side', () => {
    expect(
      pushPullRatio(
        rows({ pushHorizontal: 6, pushVertical: 4, pullHorizontal: 3, pullVertical: 2 }),
      ),
    ).toBeCloseTo(2);
  });

  /*
   * Zero pulling is the case the number exists to catch, and it is the one case a ratio cannot
   * state. The chart says it instead, with two empty rows at the bottom of the list.
   */
  it('declines to report a ratio when one side has nothing in it', () => {
    expect(pushPullRatio(rows({ pushHorizontal: 10, pullHorizontal: 0 }))).toBeNull();
    expect(pushPullRatio(rows({ pushHorizontal: 0, pullHorizontal: 10 }))).toBeNull();
  });

  it('ignores everything that is neither a push nor a pull', () => {
    expect(pushPullRatio(rows({ pushHorizontal: 5, pullHorizontal: 5, squat: 40 }))).toBeCloseTo(1);
  });
});

describe('acuteChronicRatio', () => {
  /*
   * The trailing average *includes* the week being measured, which is the classic
   * formulation. Worth pinning down: excluding it is the other common convention, and
   * switching between them silently moves where the 1.5 warning fires.
   */
  it('measures the latest week against a four-week average that includes it', () => {
    // (100 + 100 + 100 + 150) / 4 = 112.5, and 150 / 112.5 = 1.33.
    expect(acuteChronicRatio([100, 100, 100, 100, 150])).toBeCloseTo(1.333, 2);
  });

  it('reads a flat block as exactly maintenance', () => {
    expect(acuteChronicRatio([100, 100, 100, 100])).toBeCloseTo(1);
  });

  it('looks no further back than four weeks', () => {
    // The 1000-load week is outside the window and must not soften the ratio.
    expect(acuteChronicRatio([1000, 100, 100, 100, 100])).toBeCloseTo(1);
  });

  /*
   * Against a mostly-empty history the arithmetic screams danger at someone whose crime was
   * starting to train, so it declines to answer instead.
   */
  it('declines to answer without enough weeks that had training in them', () => {
    expect(acuteChronicRatio([100])).toBeNull();
    expect(acuteChronicRatio([0, 0, 0, 400])).toBeNull();
  });
});

describe('scanRecords', () => {
  it('does not call a first-ever mark a personal record', () => {
    const { events, records } = scanRecords([
      session('a', '2026-01-01', [set('kb-swing', { weightKg: 50, reps: 5 })]),
    ]);

    expect(events).toEqual([]);
    expect(records.get('kb-swing')?.best1RMKg).toBeGreaterThan(0);
  });

  it('records an event when a later session beats it', () => {
    const { events } = scanRecords([
      session('a', '2026-01-01', [set('kb-swing', { weightKg: 50, reps: 5 })]),
      session('b', '2026-01-08', [set('kb-swing', { weightKg: 60, reps: 5 })]),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ sessionId: 'b', exerciseSlug: 'kb-swing', kind: 'oneRm' });
    expect(events[0].value).toBeGreaterThan(events[0].previous);
  });

  it('stays quiet when a session falls short of the standing best', () => {
    const { events } = scanRecords([
      session('a', '2026-01-01', [set('kb-swing', { weightKg: 50, reps: 5 })]),
      session('b', '2026-01-08', [set('kb-swing', { weightKg: 60, reps: 5 })]),
      session('c', '2026-01-15', [set('kb-swing', { weightKg: 55, reps: 5 })]),
    ]);

    expect(events.map((e) => e.sessionId)).toEqual(['b']);
  });

  /**
   * The rule that stops a warm-up reading as a PR session. Judging each set against the
   * running best would call 60 a record over 40, then 80 a record over 60 — two personal
   * bests on the way to one working set, in a movement never performed before.
   */
  it('judges a session against history, not against its own earlier sets', () => {
    const { events } = scanRecords([
      session('ramp', '2026-01-01', [
        set('goblet-squat', { weightKg: 40, reps: 5 }),
        set('goblet-squat', { weightKg: 60, reps: 5 }),
        set('goblet-squat', { weightKg: 80, reps: 5 }),
      ]),
    ]);

    expect(events).toEqual([]);
  });

  it('compares against the best of the previous session, not its first set', () => {
    const { events } = scanRecords([
      session('ramp', '2026-01-01', [
        set('goblet-squat', { weightKg: 40, reps: 5 }),
        set('goblet-squat', { weightKg: 80, reps: 5 }),
      ]),
      session('next', '2026-01-08', [set('goblet-squat', { weightKg: 90, reps: 5 })]),
    ]);

    expect(events).toHaveLength(1);
    // 80kg x 5, not 40kg x 5, is what 90 had to beat.
    expect(events[0].previous).toBeCloseTo(estimate1RM(80, 5)!);
  });

  /**
   * A back-off set means the heaviest set is not the last one. Taking whichever set came last
   * as the session's mark reads identically to taking the best on an ascending ramp, so this
   * is the ordering that tells the two apart.
   */
  it('takes the best set of a session, not the last one', () => {
    const { events } = scanRecords([
      session('backoff', '2026-01-01', [
        set('goblet-squat', { weightKg: 80, reps: 5 }),
        set('goblet-squat', { weightKg: 40, reps: 5 }),
      ]),
      session('next', '2026-01-08', [set('goblet-squat', { weightKg: 90, reps: 5 })]),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0].previous).toBeCloseTo(estimate1RM(80, 5)!);
  });

  it('does not flag a session whose best only beats its own back-off set', () => {
    const { events } = scanRecords([
      session('a', '2026-01-01', [set('goblet-squat', { weightKg: 80, reps: 5 })]),
      session('b', '2026-01-08', [
        set('goblet-squat', { weightKg: 75, reps: 5 }),
        set('goblet-squat', { weightKg: 40, reps: 5 }),
      ]),
    ]);

    expect(events).toEqual([]);
  });

  it('emits at most one event per movement per session', () => {
    const { events } = scanRecords([
      session('a', '2026-01-01', [set('kb-swing', { weightKg: 50, reps: 5 })]),
      session('b', '2026-01-08', [
        set('kb-swing', { weightKg: 60, reps: 5 }),
        set('kb-swing', { weightKg: 70, reps: 5 }),
      ]),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0].value).toBeCloseTo(estimate1RM(70, 5)!);
  });

  it('reads sessions in date order however they arrive', () => {
    const newest = session('b', '2026-01-08', [set('kb-swing', { weightKg: 60, reps: 5 })]);
    const oldest = session('a', '2026-01-01', [set('kb-swing', { weightKg: 50, reps: 5 })]);

    // Handed over newest-first, the order the History query returns.
    const { events } = scanRecords([newest, oldest]);

    expect(events.map((e) => e.sessionId)).toEqual(['b']);
  });

  it('treats a faster pace as better and a slower one as not', () => {
    const run = (id: string, date: string, timeSec: number) =>
      session(id, date, [set('run', { distanceM: 5000, timeSec })]);

    const { events } = scanRecords([
      run('a', '2026-01-01', 1500),
      run('b', '2026-01-08', 1400), // faster
      run('c', '2026-01-15', 1600), // slower
    ]);

    const paceEvents = events.filter((e) => e.kind === 'pace');
    expect(paceEvents.map((e) => e.sessionId)).toEqual(['b']);
  });

  it('does not score pace on efforts under a kilometre', () => {
    const { records } = scanRecords([
      session('a', '2026-01-01', [set('run', { distanceM: 400, timeSec: 80 })]),
    ]);
    expect(records.get('run')?.bestPaceSecPerKm).toBeUndefined();
  });

  it('counts reps as a mark only when nothing was loaded', () => {
    const { records } = scanRecords([
      session('a', '2026-01-01', [set('push-up', { reps: 30 })]),
      session('b', '2026-01-08', [set('bench', { reps: 30, weightKg: 60 })]),
    ]);

    expect(records.get('push-up')?.bestReps).toBe(30);
    expect(records.get('bench')?.bestReps).toBeUndefined();
  });

  it('remembers which workout each mark came from, per kind', () => {
    const { records } = scanRecords([
      session('lift-day', '2026-01-01', [set('kb-swing', { weightKg: 50, reps: 5 })]),
      session('rep-day', '2026-01-08', [set('push-up', { reps: 40 })]),
    ]);

    expect(records.get('kb-swing')?.sources.oneRm?.sessionId).toBe('lift-day');
    expect(records.get('push-up')?.sources.reps?.sessionId).toBe('rep-day');
  });

  it('takes rounds off the block, keyed by the workout they belong to', () => {
    const run = (id: string, date: string, rounds: number) => ({
      ...session(id, date, []),
      blocks: [
        { id: `${id}-b`, style: 'amrap' as const, capSec: 1200, rounds, sourceTemplateId: 'cindy' },
      ],
    });

    const { records, events } = scanRecords([run('a', '2026-01-01', 9), run('b', '2026-01-08', 11)]);

    expect(records.get(workoutKey('cindy'))?.bestRounds).toBe(11);
    expect(records.get(workoutKey('cindy'))?.bestRoundsTimeSec).toBe(1200);
    expect(events.map((e) => e.sessionId)).toEqual(['b']);
  });

  /**
   * Nine rounds of one AMRAP and nine of another are not comparable results, so a single
   * "best AMRAP" was a number nobody could honestly beat. Naming the workout is what makes
   * its score a score.
   */
  it('records nothing for a timed block that was never named', () => {
    const anonymous = {
      ...session('a', '2026-01-01', []),
      blocks: [{ id: 'b1', style: 'amrap' as const, capSec: 1200, rounds: 9 }],
    };

    const { records } = scanRecords([anonymous]);

    expect(records.get('amrap')).toBeUndefined();
    expect([...records.keys()]).toEqual([]);
  });

  it('keeps two named workouts entirely separate', () => {
    const withTemplate = (id: string, templateId: string, rounds: number) => ({
      ...session(id, '2026-01-01', []),
      blocks: [
        { id: `${id}-b`, style: 'amrap' as const, capSec: 1200, rounds, sourceTemplateId: templateId },
      ],
    });

    const { records } = scanRecords([withTemplate('a', 'cindy', 9), withTemplate('b', 'murph', 3)]);

    expect(records.get(workoutKey('cindy'))?.bestRounds).toBe(9);
    expect(records.get(workoutKey('murph'))?.bestRounds).toBe(3);
  });

  it('values a 1RM against the bodyweight of the day it was set', () => {
    const { records } = scanRecords(
      [session('a', '2026-01-01', [set('kb-swing', { weightKg: 80, reps: 1 })])],
      { at: () => 80, latest: 80, latestDate: '2026-01-01', entries: [] },
    );

    expect(records.get('kb-swing')?.best1RMxBw).toBeCloseTo(1.03, 2);
  });

  it('ignores sets that were never ticked off', () => {
    const { records, events } = scanRecords([
      session('a', '2026-01-01', [set('kb-swing', { weightKg: 500, reps: 1 }, false)]),
    ]);

    expect(records.get('kb-swing')).toBeUndefined();
    expect(events).toEqual([]);
  });

  it('exposes the same records through the personalRecords wrapper', () => {
    const sessions = [session('a', '2026-01-01', [set('kb-swing', { weightKg: 50, reps: 5 })])];
    expect(personalRecords(sessions)).toEqual(scanRecords(sessions).records);
  });
});

describe('prEventsBySession', () => {
  it('groups every mark a single workout beat', () => {
    const { events } = scanRecords([
      session('a', '2026-01-01', [
        set('kb-swing', { weightKg: 50, reps: 5 }),
        set('push-up', { reps: 20 }),
      ]),
      session('b', '2026-01-08', [
        set('kb-swing', { weightKg: 60, reps: 5 }),
        set('push-up', { reps: 30 }),
      ]),
    ]);

    const grouped = prEventsBySession(events);
    expect(grouped.get('a')).toBeUndefined();
    expect(grouped.get('b')).toHaveLength(2);
  });
});

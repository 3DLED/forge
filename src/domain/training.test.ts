import { describe, expect, it } from 'vitest';
import {
  acuteChronicRatio,
  estimate1RM,
  personalRecords,
  prEventsBySession,
  scanRecords,
  sessionLoad,
  sessionVolumeKg,
  setVolumeKg,
} from './training';
import type { Exercise, LoggedSession, LoggedSet } from './types';

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

  it('takes rounds off the block, and keeps the window they were scored against', () => {
    const amrap = {
      ...session('a', '2026-01-01', []),
      blocks: [{ id: 'b1', style: 'amrap' as const, capSec: 1200, rounds: 9 }],
    };
    const better = {
      ...session('b', '2026-01-08', []),
      blocks: [{ id: 'b2', style: 'amrap' as const, capSec: 1200, rounds: 11 }],
    };

    const { records, events } = scanRecords([amrap, better]);

    expect(records.get('amrap')?.bestRounds).toBe(11);
    expect(records.get('amrap')?.bestRoundsTimeSec).toBe(1200);
    expect(events.map((e) => e.sessionId)).toEqual(['b']);
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

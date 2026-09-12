/**
 * The backfill, against a stubbed bridge and a real database.
 *
 * Two promises worth holding. That it never writes over a figure it already has, since it runs
 * on every app open and a repeat must be free. And that a session with no matching workout is
 * left alone rather than stamped with something — the ordinary case is training without a
 * watch, and that has to stay visibly empty.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const supported = vi.fn(() => true);
const workouts = vi.fn(async () => [] as { startedAt: number; endedAt: number; heartRate: number[] }[]);

vi.mock('./healthSource', () => ({
  healthSupported: () => supported(),
  healthWorkoutsBetween: () => workouts(),
}));

const { syncHeartRates } = await import('./healthSync');
const { db } = await import('../db/db');
const { todayKey } = await import('../domain/dates');

const today = todayKey();
const at = (hhmm: string) => `${today}T${hhmm}:00.000Z`;

async function logged(id: string, over: Record<string, unknown> = {}) {
  await db.loggedSessions.put({
    id,
    date: today,
    name: id,
    sets: [],
    startedAt: at('09:00'),
    endedAt: at('10:00'),
    createdAt: at('09:00'),
    updatedAt: at('09:00'),
    ...over,
  } as never);
}

const watchRan = () => [
  { startedAt: Date.parse(at('09:00')), endedAt: Date.parse(at('10:00')), heartRate: [140, 160] },
];

beforeEach(async () => {
  await db.loggedSessions.clear();
  supported.mockReturnValue(true);
  workouts.mockClear();
  workouts.mockResolvedValue([]);
});

describe('syncHeartRates', () => {
  it('attaches the average and peak from a matching workout', async () => {
    await logged('a');
    workouts.mockResolvedValue(watchRan());

    expect(await syncHeartRates()).toEqual({ filled: 1, unmatched: 0 });
    const saved = await db.loggedSessions.get('a');
    expect(saved?.avgHrBpm).toBe(150);
    expect(saved?.maxHrBpm).toBe(160);
  });

  /* It runs on every app open, so a second pass has to be free. */
  it('leaves a session that already has a figure alone', async () => {
    await logged('a', { avgHrBpm: 99, maxHrBpm: 101 });
    workouts.mockResolvedValue(watchRan());

    expect(await syncHeartRates()).toEqual({ filled: 0, unmatched: 0 });
    expect((await db.loggedSessions.get('a'))?.avgHrBpm).toBe(99);
  });

  /* Training without a watch is the ordinary case, and has to stay visibly empty. */
  it('leaves an unmatched session empty rather than stamping it', async () => {
    await logged('a');
    workouts.mockResolvedValue([
      { startedAt: Date.parse(at('14:00')), endedAt: Date.parse(at('15:00')), heartRate: [150] },
    ]);

    expect(await syncHeartRates()).toEqual({ filled: 0, unmatched: 1 });
    expect((await db.loggedSessions.get('a'))?.avgHrBpm).toBeUndefined();
  });

  it('ignores a session that was never finished', async () => {
    await logged('a', { endedAt: undefined });
    workouts.mockResolvedValue(watchRan());
    expect(await syncHeartRates()).toEqual({ filled: 0, unmatched: 0 });
  });

  it('asks Health nothing at all off a phone', async () => {
    supported.mockReturnValue(false);
    await logged('a');
    expect(await syncHeartRates()).toEqual({ filled: 0, unmatched: 0 });
    expect(workouts).not.toHaveBeenCalled();
  });

  it('does not query when there is nothing left to fill', async () => {
    await logged('a', { avgHrBpm: 140 });
    await syncHeartRates();
    expect(workouts).not.toHaveBeenCalled();
  });
});

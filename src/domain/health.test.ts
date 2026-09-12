/**
 * Tying a watch recording to a logged session.
 *
 * This is the part of Apple Health that can be wrong without anything failing. A mismatch does
 * not throw: it writes a plausible-looking heart rate onto the wrong session, where it would
 * sit on a chart for months looking like data. So the cases below are mostly about refusing.
 */

import { describe, expect, it } from 'vitest';
import { heartRateForSession, heartRateOf, matchWorkout, sessionWindow } from './health';
import type { HealthWorkout } from './health';
import type { LoggedSession } from './types';

const at = (hhmm: string) => `2026-09-12T${hhmm}:00.000Z`;

const session = (startedAt?: string, endedAt?: string): LoggedSession =>
  ({
    id: 's',
    date: '2026-09-12',
    name: 's',
    sets: [],
    startedAt,
    endedAt,
    createdAt: at('09:00'),
    updatedAt: at('09:00'),
  }) as LoggedSession;

const workout = (from: string, to: string, heartRate: number[] = [140]): HealthWorkout => ({
  startedAt: Date.parse(at(from)),
  endedAt: Date.parse(at(to)),
  heartRate,
});

describe('sessionWindow', () => {
  it('refuses a session that was never properly started and finished', () => {
    expect(sessionWindow(session(undefined, at('10:00')))).toBeNull();
    expect(sessionWindow(session(at('09:00'), undefined))).toBeNull();
    expect(sessionWindow(session('not a date', at('10:00')))).toBeNull();
  });

  it('refuses a window that ends before it starts', () => {
    expect(sessionWindow(session(at('10:00'), at('09:00')))).toBeNull();
  });
});

describe('matchWorkout', () => {
  /*
   * You start the watch in the doorway and the app when you have found the first bell, or the
   * other way round. The two records routinely disagree by several minutes at both ends, and
   * demanding a tight overlap would reject the ordinary case.
   */
  it('matches records that start and end a few minutes apart', () => {
    const found = matchWorkout(session(at('09:00'), at('10:00')), [workout('08:55', '09:58')]);
    expect(found).not.toBeNull();
  });

  it('ignores a workout that does not overlap at all', () => {
    expect(matchWorkout(session(at('09:00'), at('10:00')), [workout('14:00', '15:00')])).toBeNull();
  });

  /*
   * The dangerous case. A long ride that happens to contain the half hour you lifted would
   * otherwise hand the lift a heart rate from the bike.
   */
  it('refuses a brief brush against a much longer recording', () => {
    // Ten minutes of a thirty-minute session inside a four-hour ride: a third, under the bar.
    const found = matchWorkout(session(at('09:00'), at('09:30')), [workout('09:20', '13:00')]);
    expect(found).toBeNull();
  });

  /*
   * Two-a-days are why the plan supports them, and why first-match would be wrong: a morning
   * run and an evening lift would hand the lift the run's heart rate on nothing better than
   * the order the list came back in.
   */
  it('takes the best overlap rather than the first', () => {
    const found = matchWorkout(session(at('17:00'), at('18:00')), [
      workout('17:30', '18:00', [111]),
      workout('17:00', '18:05', [155]),
    ]);
    expect(found?.heartRate).toEqual([155]);
  });

  it('matches nothing when the session has no window', () => {
    expect(matchWorkout(session(), [workout('09:00', '10:00')])).toBeNull();
  });
});

describe('heartRateOf', () => {
  it('averages the samples and keeps the peak', () => {
    expect(heartRateOf(workout('09:00', '10:00', [120, 140, 160]))).toEqual({
      avgBpm: 140,
      maxBpm: 160,
    });
  });

  /*
   * A zero is a lost signal, not a resting moment. Averaging those in drags every figure
   * toward a number nobody ran at.
   */
  it('drops lost samples rather than averaging them in', () => {
    expect(heartRateOf(workout('09:00', '10:00', [0, 150, 0, 150]))).toEqual({
      avgBpm: 150,
      maxBpm: 150,
    });
  });

  it('reports nothing at all when the watch recorded no beats', () => {
    expect(heartRateOf(workout('09:00', '10:00', []))).toBeNull();
    expect(heartRateOf(workout('09:00', '10:00', [0, 0]))).toBeNull();
  });

  it('rounds, because a heart rate with a decimal claims a precision nothing has', () => {
    expect(heartRateOf(workout('09:00', '10:00', [140, 141]))?.avgBpm).toBe(141);
  });
});

describe('heartRateForSession', () => {
  it('reports nothing rather than a wrong figure when nothing lines up', () => {
    expect(heartRateForSession(session(at('09:00'), at('10:00')), [])).toBeNull();
    expect(
      heartRateForSession(session(at('09:00'), at('10:00')), [workout('14:00', '15:00')]),
    ).toBeNull();
  });

  it('reports the matched workout when one does', () => {
    expect(
      heartRateForSession(session(at('09:00'), at('10:00')), [
        workout('09:02', '09:58', [130, 170]),
      ]),
    ).toEqual({ avgBpm: 150, maxBpm: 170 });
  });

  /* A session done without a watch is the ordinary case, not a failure. */
  it('reports nothing when the matched workout carried no beats', () => {
    expect(
      heartRateForSession(session(at('09:00'), at('10:00')), [workout('09:00', '10:00', [])]),
    ).toBeNull();
  });
});

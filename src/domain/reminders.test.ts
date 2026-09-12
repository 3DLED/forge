/**
 * Which reminders are armed, which is the half of this feature a laptop can check.
 *
 * Every case here is a notification somebody would have resented receiving, or one they would
 * have been annoyed to miss. The plugin call is four lines and does what it is told; the
 * decisions are all here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dueReminders, MAX_PENDING } from './reminders';
import { reminderSettingsFor } from './reminderSettings';
import type { PlannedSession } from './types';

/** Local noon on the day the fake clock sits at, so nothing here depends on a timezone. */
const NOW = new Date(2026, 8, 12, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const on = reminderSettingsFor({ sessions: true, sessionTime: '07:00', rest: true });

const slot = (date: string, name = 'Upper body', status = 'planned'): PlannedSession =>
  ({ id: `${date}-${name}`, date, status, prescription: { name } }) as PlannedSession;

describe('dueReminders', () => {
  it('arms one reminder per planned day, at the chosen hour', () => {
    const out = dueReminders([slot('2026-09-14'), slot('2026-09-16')], on);
    expect(out).toHaveLength(2);
    expect(out[0].at.getHours()).toBe(7);
    expect(out[0].at.getMinutes()).toBe(0);
    expect(out[0].body).toBe('Upper body');
  });

  /*
   * A two-a-day is one day. Two banners at seven in the morning naming two workouts is not
   * twice as useful as one naming both.
   */
  it('folds a two-a-day into a single notification', () => {
    const out = dueReminders([slot('2026-09-14', 'Run'), slot('2026-09-14', 'Kettlebells')], on);
    expect(out).toHaveLength(1);
    expect(out[0].body).toBe('Run · Kettlebells');
  });

  it('says nothing about days that are already settled', () => {
    const out = dueReminders(
      [
        slot('2026-09-14', 'Done', 'completed'),
        slot('2026-09-15', 'Skipped', 'skipped'),
        slot('2026-09-16', 'Moved', 'moved'),
        slot('2026-09-17', 'Real'),
      ],
      on,
    );
    expect(out.map((r) => r.body)).toEqual(['Real']);
  });

  /*
   * Some platforms fire a past-dated notification the moment it is scheduled, which would
   * turn opening the app after a week away into a burst of alerts about days already missed.
   */
  it('never arms a time that has already gone', () => {
    expect(dueReminders([slot('2026-09-10'), slot('2026-09-11')], on)).toHaveLength(0);
  });

  /*
   * The commonest case of the above, and the one that would otherwise fire on every re-sync
   * during a morning session.
   */
  it('skips today once the hour has passed', () => {
    expect(dueReminders([slot('2026-09-12')], on)).toHaveLength(0);
  });

  it('still arms today when the hour is yet to come', () => {
    const evening = reminderSettingsFor({ sessions: true, sessionTime: '18:00', rest: true });
    const out = dueReminders([slot('2026-09-12')], evening);
    expect(out).toHaveLength(1);
    expect(out[0].at.getHours()).toBe(18);
  });

  it('arms nothing at all when the switch is off', () => {
    const off = reminderSettingsFor({ sessions: false, sessionTime: '07:00', rest: true });
    expect(dueReminders([slot('2026-09-14')], off)).toHaveLength(0);
  });

  /*
   * iOS keeps sixty-four pending notifications and silently drops the rest, so this is a real
   * ceiling. Soonest first, because the ones that would be dropped are the ones furthest out
   * and least likely to still be true.
   */
  it('caps the batch and keeps the nearest days', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      slot(`2026-${String(10 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`),
    );
    const out = dueReminders(many, on);
    expect(out).toHaveLength(MAX_PENDING);
    expect(out[0].at.getTime()).toBeLessThan(out.at(-1)!.at.getTime());
  });

  it('numbers ids from where the caller asked, so a batch can be cancelled as a range', () => {
    const out = dueReminders([slot('2026-09-14'), slot('2026-09-16')], on, { firstId: 1000 });
    expect(out.map((r) => r.id)).toEqual([1000, 1001]);
  });

  it('falls back to a general line when the plan named nothing', () => {
    const out = dueReminders([slot('2026-09-14', '')], on);
    expect(out[0].body).toBe('Something is planned for today.');
  });

  it('refuses a time it cannot read rather than guessing midnight', () => {
    const broken = reminderSettingsFor({ sessions: true, sessionTime: '25:00', rest: true });
    expect(dueReminders([slot('2026-09-14')], broken)).toHaveLength(0);
  });
});

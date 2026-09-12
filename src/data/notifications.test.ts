/**
 * @vitest-environment jsdom
 *
 * The adapter, against a stubbed plugin.
 *
 * Two things here are worth a test rather than a read. That a browser is left entirely alone,
 * because the settings screen promises that and a stray call would prompt somebody in a tab.
 * And that arming a batch cancels the previous one by range — getting that wrong does not
 * fail, it quietly accumulates notifications until the phone starts dropping them.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const isNative = vi.fn(() => true);
const schedule = vi.fn(async () => ({}));
const cancel = vi.fn(async () => {});
const getPending = vi.fn(async () => ({ notifications: [] as { id: number }[] }));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNative() } }));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    schedule: (...a: unknown[]) => schedule(...(a as [])),
    cancel: (...a: unknown[]) => cancel(...(a as [])),
    getPending: () => getPending(),
    requestPermissions: async () => ({ display: 'granted' }),
    checkPermissions: async () => ({ display: 'granted' }),
  },
}));

const { armRestCue, armSessionReminders, cancelRestCue, notificationsAvailable, REST_TIMER_ID } =
  await import('./notifications');

const later = () => new Date(Date.now() + 90_000);

beforeEach(() => {
  isNative.mockReturnValue(true);
  schedule.mockClear();
  cancel.mockClear();
  getPending.mockClear();
  getPending.mockResolvedValue({ notifications: [] });
});

describe('in a browser', () => {
  beforeEach(() => isNative.mockReturnValue(false));

  it('does nothing at all, which is what the settings screen promises', async () => {
    expect(notificationsAvailable()).toBe(false);
    await armSessionReminders([{ id: 1000, title: 'a', body: 'b', at: later() }]);
    await armRestCue(later(), 'Rest done', 'Back to it.');
    await cancelRestCue();
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe('session reminders', () => {
  /*
   * The previous batch was scheduled by an earlier run of the app, so the pending list the
   * system holds is the only record of it. Cancelling by range is what makes a re-sync a
   * replacement rather than an addition.
   */
  it('clears the previous batch before arming the new one', async () => {
    getPending.mockResolvedValue({ notifications: [{ id: 1000 }, { id: 1001 }, { id: 1 }] });
    await armSessionReminders([{ id: 1000, title: 'Training today', body: 'Run', at: later() }]);

    expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: 1000 }, { id: 1001 }] });
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  /* The rest cue lives below the range, and must survive a plan re-sync mid-session. */
  it('leaves the rest cue alone', async () => {
    getPending.mockResolvedValue({ notifications: [{ id: REST_TIMER_ID }] });
    await armSessionReminders([]);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('treats an empty batch as a cancel, so switching off reaches the phone', async () => {
    getPending.mockResolvedValue({ notifications: [{ id: 1000 }] });
    await armSessionReminders([]);
    expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: 1000 }] });
    expect(schedule).not.toHaveBeenCalled();
  });

  /* Permission revoked in Settings throws. The app works without reminders; a dialog about
     it would be a worse interruption than the one that failed to arrive. */
  it('swallows a plugin failure rather than surfacing it mid-session', async () => {
    getPending.mockRejectedValue(new Error('not permitted'));
    await expect(armSessionReminders([])).resolves.toBeUndefined();
  });
});

describe('the rest cue', () => {
  it('replaces whatever was armed, so +30s moves the cue', async () => {
    await armRestCue(later(), 'Rest done', 'Back to it.');
    expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: REST_TIMER_ID }] });
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it('cancels without arming anything when the deadline has already gone', async () => {
    await armRestCue(new Date(Date.now() - 1000), 'Rest done', 'Back to it.');
    expect(cancel).toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });
});

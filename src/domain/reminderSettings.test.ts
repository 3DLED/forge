/**
 * Defaults and the one-line summary. Small, but the defaults are a decision about whether an
 * app that has just been installed is allowed to interrupt you, which is worth pinning down.
 */

import { describe, expect, it } from 'vitest';
import {
  describeReminders,
  minutesIntoDay,
  reminderSettingsFor,
} from './reminderSettings';

describe('reminderSettingsFor', () => {
  /*
   * An app gets one credible chance at the notification prompt. Arriving with session
   * reminders already on would spend it before anybody asked for anything — including for the
   * rest cue, which is the half people actually miss.
   */
  it('leaves session reminders off until somebody asks', () => {
    expect(reminderSettingsFor().sessions).toBe(false);
  });

  /*
   * The rest cue is not an interruption in any meaningful sense: it is the answer to a
   * countdown you started, arriving when you asked for it.
   */
  it('has the rest cue on, because it answers a question you asked', () => {
    expect(reminderSettingsFor().rest).toBe(true);
  });

  it('keeps what was stored, including a switch turned off', () => {
    const stored = { sessions: true, sessionTime: '18:30', rest: false };
    expect(reminderSettingsFor(stored)).toEqual(stored);
  });
});

describe('minutesIntoDay', () => {
  it('reads a time', () => {
    expect(minutesIntoDay('07:00')).toBe(420);
    expect(minutesIntoDay('00:00')).toBe(0);
    expect(minutesIntoDay('23:59')).toBe(1439);
  });

  it('refuses anything that is not one, rather than landing on midnight', () => {
    for (const bad of ['', '7', '24:00', '07:60', 'morning', '07:0']) {
      expect(minutesIntoDay(bad)).toBeNull();
    }
  });
});

describe('describeReminders', () => {
  it('says what is on', () => {
    expect(describeReminders({ sessions: true, sessionTime: '07:00', rest: true }))
      .toBe('Planned sessions at 07:00 · rest timer');
  });

  it('says so when nothing is', () => {
    expect(describeReminders({ sessions: false, sessionTime: '07:00', rest: false }))
      .toBe('Nothing');
  });
});

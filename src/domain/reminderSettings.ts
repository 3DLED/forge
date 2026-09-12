/**
 * Whether the app is allowed to interrupt you, and about what.
 *
 * Two switches rather than one, for the same reason the run alerts are three: they interrupt
 * on completely different timescales and the people who want one often do not want the other.
 * A session reminder is a nudge in the morning about a day you are free to rearrange. A rest
 * cue is the app finishing a job you asked it to start ninety seconds ago. Lumping them under
 * "notifications" means somebody who is sick of being told to train also loses the timer they
 * rely on between sets.
 *
 * Lives on the profile beside the run settings, and travels in a backup for the same reason:
 * it is a standing preference, not a property of any one session.
 */

import { translate } from '../i18n/copy';
import type { Language } from './types';

export interface ReminderSettings {
  /**
   * A nudge on the morning of a day something is planned.
   *
   * Off until asked for. Notification permission is the one prompt an app gets to ask once,
   * and spending it at launch on a feature nobody requested is how the answer becomes no
   * forever — including for the rest cue, which is the half people actually miss.
   */
  sessions: boolean;
  /** When that nudge lands, as `HH:MM` on a 24-hour clock in whatever zone the phone is in. */
  sessionTime: string;
  /**
   * Tell you the rest is over when the screen is off.
   *
   * On by default, because it is not an interruption in any meaningful sense — it is the
   * answer to a countdown you started, arriving at the moment you asked for it.
   */
  rest: boolean;
}

/** Early enough to change the day's plan, late enough not to be the thing that wakes you. */
export const DEFAULT_SESSION_TIME = '07:00';

export function reminderSettingsFor(stored?: ReminderSettings): ReminderSettings {
  return {
    sessions: stored?.sessions ?? false,
    sessionTime: stored?.sessionTime ?? DEFAULT_SESSION_TIME,
    rest: stored?.rest ?? true,
  };
}

/** `HH:MM` to minutes since midnight, or null if it is not a time. */
export function minutesIntoDay(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** One line for the row that opens this screen. */
export function describeReminders(settings: ReminderSettings, lang?: Language): string {
  const say = (english: string) => translate(english, lang);
  const parts: string[] = [];
  if (settings.sessions) parts.push(`${say('Planned sessions at')} ${settings.sessionTime}`);
  if (settings.rest) parts.push(say('rest timer'));
  if (parts.length === 0) return say('Nothing');
  return parts.join(' · ');
}

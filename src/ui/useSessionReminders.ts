/**
 * Keeps what the phone will say in step with what the plan says.
 *
 * Mounted once, near the top of the app. It watches the planned sessions inside the horizon
 * and re-arms the whole batch whenever they change — which is the only approach that holds
 * up, because plans change from a dozen places. Applying a plan, skipping a day, moving one,
 * finishing a session, deleting a plan and importing someone else's all rewrite the calendar,
 * and asking each of those to remember to update the notifications is asking to be told to
 * train on a day that was cancelled a month ago.
 *
 * A live query is what makes that free: Dexie already tells us when the table changed, so the
 * sync is driven by the data rather than by remembering to call it.
 */

import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { plannedBetween } from '../data/sessions';
import { armSessionReminders, SESSION_REMINDER_BASE } from '../data/notifications';
import { addDays, todayKey } from '../domain/dates';
import { dueReminders, HORIZON_DAYS } from '../domain/reminders';
import { reminderSettingsFor } from '../domain/reminderSettings';
import { useApp } from './AppProvider';

/**
 * Long enough to collect a burst of writes into one re-arm, short enough that turning the
 * switch on feels like it did something. Applying a plan writes several weeks of rows one
 * after another, and re-scheduling thirty notifications on each of them would be work nobody
 * asked for on the slowest device in the room.
 */
const SETTLE_MS = 800;

export function useSessionReminders(): void {
  const { profile, lang } = useApp();
  const settings = reminderSettingsFor(profile.reminders);

  const today = todayKey();
  const planned = useLiveQuery(
    () => plannedBetween(today, addDays(today, HORIZON_DAYS)),
    [today],
  );

  useEffect(() => {
    if (!planned) return;

    const timer = setTimeout(() => {
      void armSessionReminders(
        dueReminders(planned, settings, { firstId: SESSION_REMINDER_BASE, lang }),
      );
    }, SETTLE_MS);

    return () => clearTimeout(timer);
    // Switching the setting off has to reach the phone too: `dueReminders` returns nothing,
    // and arming nothing is what cancels the batch.
  }, [planned, settings.sessions, settings.sessionTime, lang]);
}

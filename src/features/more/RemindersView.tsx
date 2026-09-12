/**
 * Whether the phone is allowed to speak up, and about what.
 *
 * Two switches that look alike and are not. One is the app volunteering an opinion about your
 * day; the other is the app finishing a job you started ninety seconds ago. Somebody who is
 * tired of being told to train should be able to say so without losing the rest timer, which
 * is the half that actually goes wrong when it is missing.
 *
 * Permission is asked when a switch goes on, never on the way in. An app gets one credible
 * chance at that prompt, and a screen that fires it just for being opened spends it on
 * somebody who had not decided yet.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../ui/PageHeader';
import { useApp } from '../../ui/AppProvider';
import { profileRepo } from '../../data/repos';
import {
  notificationPermission,
  notificationsAvailable,
  requestNotificationPermission,
} from '../../data/notifications';
import { reminderSettingsFor, type ReminderSettings } from '../../domain/reminderSettings';
import { useT } from '../../i18n/useT';

/** The hours somebody would plausibly want to hear about today. */
const TIMES = ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '09:00', '17:00', '18:00'];

export default function RemindersView() {
  const t = useT();
  const { profile } = useApp();
  const settings = reminderSettingsFor(profile.reminders);

  const supported = notificationsAvailable();
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    void notificationPermission().then(setGranted);
  }, []);

  const save = (change: Partial<ReminderSettings>) =>
    void profileRepo.update(profile.id, { reminders: { ...settings, ...change } });

  /*
   * Asked on the way on, and only then. Refused is stored rather than retried: iOS shows the
   * system prompt once and answers silently ever after, so a switch that kept flipping itself
   * back on would be a switch that never works and never says why.
   */
  const enable = async (change: Partial<ReminderSettings>) => {
    const allowed = granted || (await requestNotificationPermission());
    setGranted(allowed);
    if (allowed) save(change);
  };

  return (
    <>
      <PageHeader
        title={t('Reminders')}
        action={<Link to="/more" className="btn ghost sm">{t('Back')}</Link>}
      />

      {!supported && (
        <div className="card tight">
          <p className="small">
            {t('Reminders need the installed app. A browser can only notify you while it is open, which is the one time you do not need telling.')}
          </p>
        </div>
      )}

      {supported && granted === false && (
        <div className="card tight">
          <p className="small">
            {t('Notifications are switched off for Hybrid Forge. Turn them back on in your phone settings and these will start working.')}
          </p>
        </div>
      )}

      <div className="section-title">{t('Planned sessions')}</div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button
          className={`btn grow${settings.sessions ? ' primary' : ''}`}
          disabled={!supported}
          onClick={() => void enable({ sessions: true })}
        >
          {t('Remind me')}
        </button>
        <button
          className={`btn grow${settings.sessions ? '' : ' primary'}`}
          disabled={!supported}
          onClick={() => save({ sessions: false })}
        >
          {t('No reminder')}
        </button>
      </div>
      <p className="tiny faint">
        {t('One notification on the morning of any day with something planned, naming the session. Days you have already finished or skipped say nothing.')}
      </p>

      {settings.sessions && (
        <>
          <div className="section-title">{t('At')}</div>
          <div className="row wrap" style={{ gap: '0.4rem' }}>
            {TIMES.map((time) => (
              <button
                key={time}
                className={`btn sm mono${settings.sessionTime === time ? ' primary' : ''}`}
                onClick={() => save({ sessionTime: time })}
              >
                {time}
              </button>
            ))}
          </div>
          <p className="tiny faint">
            {t('Early enough to change the shape of the day, rather than to tell you what you have already missed.')}
          </p>
        </>
      )}

      <div className="section-title">{t('Rest timer')}</div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button
          className={`btn grow${settings.rest ? ' primary' : ''}`}
          disabled={!supported}
          onClick={() => void enable({ rest: true })}
        >
          {t('Tell me')}
        </button>
        <button
          className={`btn grow${settings.rest ? '' : ' primary'}`}
          disabled={!supported}
          onClick={() => save({ rest: false })}
        >
          {t('Stay quiet')}
        </button>
      </div>
      <p className="tiny faint">
        {t('The beep needs the screen awake and the app in front of you, which between sets it usually is not. This is the same cue, delivered by the phone instead.')}
      </p>
    </>
  );
}

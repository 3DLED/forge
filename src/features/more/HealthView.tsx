/**
 * Letting the watch tell Forge what your heart was doing.
 *
 * One switch and one button, because there is genuinely only one decision here and one thing
 * to do when it goes wrong. The button exists because the common failure has nothing to do
 * with this app: the watch had not synced when you tapped Finish, and the fix is to ask again
 * a few minutes later.
 *
 * Read only, and the screen says so. Forge learns what the watch recorded; it writes nothing
 * back, and implying otherwise would be a promise about somebody's health record.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../ui/PageHeader';
import { useApp } from '../../ui/AppProvider';
import { profileRepo } from '../../data/repos';
import { healthAvailable, healthSupported, requestHealthAccess } from '../../data/healthSource';
import { syncHeartRates } from '../../data/healthSync';
import { useT } from '../../i18n/useT';

export default function HealthView() {
  const t = useT();
  const { profile } = useApp();
  const on = profile.appleHealth ?? false;

  const supported = healthSupported();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void healthAvailable().then(setAvailable);
  }, []);

  const enable = async () => {
    const asked = await requestHealthAccess();
    if (!asked) return;
    await profileRepo.update(profile.id, { appleHealth: true });
    void pull();
  };

  const pull = async () => {
    setBusy(true);
    setStatus(t('Checking…'));
    const result = await syncHeartRates();
    setBusy(false);
    setStatus(
      result.filled > 0
        ? `${t.count(result.filled, 'session')} ${t('matched to a workout on your watch.')}`
        : t('Nothing new lined up. A workout has to have been recorded on the watch at the same time.'),
    );
  };

  return (
    <>
      <PageHeader
        title={t('Apple Health')}
        action={<Link to="/more" className="btn ghost sm">{t('Back')}</Link>}
      />

      {!supported && (
        <div className="card tight">
          <p className="small">
            {t('Apple Health needs the installed app on an iPhone. A browser cannot reach it.')}
          </p>
        </div>
      )}

      {supported && available === false && (
        <div className="card tight">
          <p className="small">{t('This device has no Health store to read from.')}</p>
        </div>
      )}

      <div className="section-title">{t('Heart rate')}</div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button
          className={`btn grow${on ? ' primary' : ''}`}
          disabled={!supported || available === false}
          onClick={() => void enable()}
        >
          {t('Read from Health')}
        </button>
        <button
          className={`btn grow${on ? '' : ' primary'}`}
          disabled={!supported}
          onClick={() => void profileRepo.update(profile.id, { appleHealth: false })}
        >
          {t('Leave it alone')}
        </button>
      </div>
      <p className="tiny faint">
        {t('Forge matches each session you log against the workouts your watch recorded, and takes the average and peak heart rate from whichever one covers the same stretch of time. It reads only, and writes nothing back to Health.')}
      </p>

      {on && (
        <>
          <div className="section-title">{t('Catch up')}</div>
          <button className="btn block" disabled={busy} onClick={() => void pull()}>
            {t('Check for new workouts')}
          </button>
          {status && <p className="tiny faint">{status}</p>}
          <p className="tiny faint">
            {t('A watch usually syncs a few minutes after you finish, so a session logged just now often has no heart rate yet. This looks again over the last fortnight and fills in what it finds.')}
          </p>
        </>
      )}
    </>
  );
}

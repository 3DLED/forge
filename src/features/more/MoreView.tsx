import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import { useApp } from '../../ui/AppProvider';
import Sheet from '../../ui/Sheet';
import AskSheet from '../../ui/AskSheet';
import { DEFAULT_THEME, THEMES } from '../../ui/themes';
import { reminderSettingsFor, describeReminders } from '../../domain/reminderSettings';
import { exportBackup, restoreBackup, wipeAllData } from '../../data/backup';
import { db } from '../../db/db';
import { displayWeight, weightLabel } from '../../domain/units';
import { allInjuries } from '../../data/injuries';
import { allTestResults } from '../../data/fitnessTests';
import { allCustomPlans } from '../../data/customPlans';
import { savedWorkouts } from '../../data/namedWorkouts';
import { testTiming } from '../../domain/fitnessTests';
import { activeInjuries } from '../../domain/injuries';
import { todayKey } from '../../domain/dates';
import { describeRunSettings, runSettingsFor } from '../../domain/runSettings';
import { useT } from '../../i18n/useT';

export default function MoreView() {
  const t = useT();
  const { activeEquipment, exercises, profile, units, lang } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const today = todayKey();
  const customCount = exercises.filter((exercise) => exercise.isCustom).length;

  const customPlans = useLiveQuery(() => allCustomPlans(), []);
  const planCount = customPlans?.length ?? 0;
  const workouts = useLiveQuery(() => savedWorkouts(), []);
  const workoutCount = workouts?.length ?? 0;  const injuries = useLiveQuery(() => allInjuries(), []);
  const currentInjuries = activeInjuries(injuries ?? [], today);
  const testResults = useLiveQuery(() => allTestResults(), []);
  const dueTests = [...new Set((testResults ?? []).map((r) => r.exerciseSlug))].filter(
    (slug) => testTiming(testResults ?? [], slug, today).state === 'due',
  ).length;
  const [erasing, setErasing] = useState(false);
  // Restore is a two-way choice, so the file waits here until the mode is picked.
  const [pendingRestore, setPendingRestore] = useState<File | null>(null);

  const counts = useLiveQuery(async () => ({
    sessions: await db.loggedSessions.count(),
    planned: await db.plannedSessions.count(),
  }), []);

  const onFile = async (file: File, mode: 'merge' | 'replace') => {
    try {
      const result = await restoreBackup(await file.text(), mode);
      const total = Object.values(result.imported).reduce((a, b) => a + b, 0);
      setStatus(`Restored ${total} records (${mode}).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not read that file.');
    }
  };

  return (
    <>
      <PageHeader title={t('More')} subtitle={profile.displayName} />

      <Link to="/more/equipment" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Equipment')}</strong>
          <br />
          <span className="tiny faint">
            {activeEquipment?.name ?? t('Not set')} · {t.count(activeEquipment?.items.length ?? 0, 'item')}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/run" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Run alerts')}</strong>
          <br />
          <span className="tiny faint">{describeRunSettings(runSettingsFor(units, profile.run), lang)}</span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/reminders" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Reminders')}</strong>
          <br />
          <span className="tiny faint">
            {describeReminders(reminderSettingsFor(profile.reminders), lang)}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/health" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Apple Health')}</strong>
          <br />
          <span className="tiny faint">
            {profile.appleHealth ? t('Heart rate from your watch') : t('Not connected')}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/settings" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Settings')}</strong>
          <br />
          <span className="tiny faint">
            {profile.units === 'imperial' ? t('Pounds and miles') : t('Kilograms and kilometres')}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/appearance" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Appearance')}</strong>
          <br />
          <span className="tiny faint">
            {THEMES.find((t) => t.id === (profile.theme ?? DEFAULT_THEME))?.name ?? 'Forge'} · {t('try the other directions')}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/movements" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Movements')}</strong>
          <br />
          <span className="tiny faint">
            {customCount > 0
              ? `${t.count(exercises.length, 'movement')}, ${customCount} ${t('of them yours')}`
              : `${t.count(exercises.length, 'movement')} — ${t('add your own')}`}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/plans" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Plans')}</strong>
          <br />
          <span className="tiny faint">
            {planCount > 0
              ? `${t.count(planCount, 'plan')} ${t('of your own — build, share, import')}`
              : t('Build your own week, or open a plan someone sent')}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/workouts" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Saved workouts')}</strong>
          <br />
          <span className="tiny faint">
            {workoutCount > 0
              ? `${t.count(workoutCount, 'workout')} — ${t('share, import, tidy up')}`
              : t('Workouts you have named come back here')}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/tests" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Tests')}</strong>
          <br />
          <span className="tiny faint">
            {dueTests > 0
              ? `${t.count(dueTests, 'movement')} ${t('due a retest')}`
              : t('Measure a max, and program from a number instead of a guess')}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/injuries" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Injuries')}</strong>
          <br />
          <span className="tiny faint">
            {currentInjuries.length > 0
              ? `${currentInjuries.map((i) => i.label).join(', ')} — ${t('resting')}`
              : t('Log something that hurts and the sessions that load it step aside')}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/body" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>{t('Bodyweight')}</strong>
          <br />
          <span className="tiny faint">
            {profile.bodyweightKg
              ? `${Math.round(displayWeight(profile.bodyweightKg, profile.units))} ${weightLabel(profile.units)} · ${t('the load in every push-up')}`
              : t('Not set — bodyweight sets count as no work without it')}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <div className="section-title">{t('Your data')}</div>
      <div className="card">
        <p className="small muted">
          {/* One line on purpose: the copy checker reads `t('...')` as a whole call. */}
          {t('Everything lives in this browser on this device. Nothing is uploaded, and no account exists — which also means a cleared browser takes your history with it. Export regularly and keep the file somewhere that syncs.')}
        </p>
        <div className="small mono faint" style={{ marginBottom: '0.75rem' }}>
          {t.count(counts?.sessions ?? 0, 'session')} · {counts?.planned ?? 0} {t('planned')} ·{' '}
          {t.count(exercises.length, 'movement')}
        </div>

        <button
          className="btn block"
          onClick={async () => {
            const result = await exportBackup();
            // Dismissing the share sheet is a decision, not an error. Saying nothing is the
            // only reply that does not read as a complaint about it.
            if (result.outcome === 'cancelled') return;
            setStatus(
              result.outcome === 'saved'
                ? `${t('Saved')} ${result.filename}`
                : (result.reason ?? t('Could not save the file.')),
            );
          }}
        >
          {t('Export backup')}
        </button>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setPendingRestore(file);
            event.target.value = '';
          }}
        />
        <button
          className="btn block"
          style={{ marginTop: '0.5rem' }}
          onClick={() => fileInput.current?.click()}
        >
          {t('Restore from backup')}
        </button>

        {status && <p className="small" style={{ marginTop: '0.75rem', marginBottom: 0 }}>{status}</p>}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '0.4rem' }}>{t('Start over')}</h3>
        <p className="small muted">
          {t('Erases every session, plan, and setting on this device and reseeds the movement library from scratch. Export a backup first if there is anything you want.')}
        </p>
        <button
          className="btn ghost danger block"
          onClick={() => setErasing(true)}
        >
          {t('Erase all data')}
        </button>
      </div>

      <p className="tiny faint" style={{ textAlign: 'center' }}>
        {t('Hybrid Forge · offline training tracker')}
      </p>

      {pendingRestore && (
        <Sheet title={t('Restore backup')} onClose={() => setPendingRestore(null)}>
          <p className="small muted">
            {t('Restoring')} <strong>{pendingRestore.name}</strong>. Merging keeps what is already on
            this device and lets the newer copy of each record win — the right choice when you
            have trained since the export. Replacing wipes first, for moving to a new phone.
          </p>
          <div className="stack">
            <button
              className="btn primary block"
              onClick={async () => {
                const file = pendingRestore;
                setPendingRestore(null);
                await onFile(file, 'merge');
              }}
            >
              {t('Merge (recommended)')}
            </button>
            <button
              className="btn danger block"
              onClick={async () => {
                const file = pendingRestore;
                setPendingRestore(null);
                await onFile(file, 'replace');
              }}
            >
              {t('Replace everything')}
            </button>
          </div>
        </Sheet>
      )}

      {erasing && (
        <AskSheet
          title={t('Erase all data')}
          message="Every session, plan, and setting on this device is deleted. There is no undo without a backup file."
          input={{ label: 'Type ERASE to confirm', placeholder: 'ERASE', mustEqual: 'ERASE' }}
          confirmLabel="Erase everything"
          danger
          onCancel={() => setErasing(false)}
          onConfirm={async () => {
            await wipeAllData();
            location.reload();
          }}
        />
      )}
    </>
  );
}

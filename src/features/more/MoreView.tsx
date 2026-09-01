import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import { useApp } from '../../ui/AppProvider';
import { plural } from '../../ui/text';
import Sheet from '../../ui/Sheet';
import AskSheet from '../../ui/AskSheet';
import { DEFAULT_THEME, THEMES } from '../../ui/themes';
import { downloadBackup, restoreBackup, wipeAllData } from '../../data/backup';
import { db } from '../../db/db';
import { displayWeight, weightLabel } from '../../domain/units';
import { allInjuries } from '../../data/injuries';
import { activeInjuries } from '../../domain/injuries';
import { todayKey } from '../../domain/dates';

export default function MoreView() {
  const { activeEquipment, exercises, profile } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const today = todayKey();
  const injuries = useLiveQuery(() => allInjuries(), []);
  const currentInjuries = activeInjuries(injuries ?? [], today);
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
      <PageHeader title="More" subtitle={profile.displayName} />

      <Link to="/more/equipment" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>Equipment</strong>
          <br />
          <span className="tiny faint">
            {activeEquipment?.name ?? 'Not set'} · {activeEquipment?.items.length ?? 0} items
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/settings" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>Settings</strong>
          <br />
          <span className="tiny faint">
            {profile.units === 'imperial' ? 'Pounds and miles' : 'Kilograms and kilometres'}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/appearance" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>Appearance</strong>
          <br />
          <span className="tiny faint">
            {THEMES.find((t) => t.id === (profile.theme ?? DEFAULT_THEME))?.name ?? 'Forge'} · try the other directions
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/injuries" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>Injuries</strong>
          <br />
          <span className="tiny faint">
            {currentInjuries.length > 0
              ? `${currentInjuries.map((i) => i.label).join(', ')} — resting`
              : 'Log something that hurts and the sessions that load it step aside'}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <Link to="/more/body" className="pick" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">
          <strong>Bodyweight</strong>
          <br />
          <span className="tiny faint">
            {profile.bodyweightKg
              ? `${Math.round(displayWeight(profile.bodyweightKg, profile.units))} ${weightLabel(profile.units)} · the load in every push-up`
              : 'Not set — bodyweight sets count as no work without it'}
          </span>
        </span>
        <span className="faint">›</span>
      </Link>

      <div className="section-title">Your data</div>
      <div className="card">
        <p className="small muted">
          Everything lives in this browser on this device. Nothing is uploaded, and no account
          exists — which also means a cleared browser takes your history with it. Export
          regularly and keep the file somewhere that syncs.
        </p>
        <div className="small mono faint" style={{ marginBottom: '0.75rem' }}>
          {plural(counts?.sessions ?? 0, 'session')} · {counts?.planned ?? 0} planned ·{' '}
          {plural(exercises.length, 'movement')}
        </div>

        <button
          className="btn block"
          onClick={async () => setStatus(`Saved ${await downloadBackup()}`)}
        >
          Export backup
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
          Restore from backup
        </button>

        {status && <p className="small" style={{ marginTop: '0.75rem', marginBottom: 0 }}>{status}</p>}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '0.4rem' }}>Start over</h3>
        <p className="small muted">
          Erases every session, plan, and setting on this device and reseeds the movement
          library from scratch. Export a backup first if there is anything you want.
        </p>
        <button
          className="btn ghost danger block"
          onClick={() => setErasing(true)}
        >
          Erase all data
        </button>
      </div>

      <p className="tiny faint" style={{ textAlign: 'center' }}>
        Forge · offline training tracker
      </p>

      {pendingRestore && (
        <Sheet title="Restore backup" onClose={() => setPendingRestore(null)}>
          <p className="small muted">
            Restoring <strong>{pendingRestore.name}</strong>. Merging keeps what is already on
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
              Merge (recommended)
            </button>
            <button
              className="btn danger block"
              onClick={async () => {
                const file = pendingRestore;
                setPendingRestore(null);
                await onFile(file, 'replace');
              }}
            >
              Replace everything
            </button>
          </div>
        </Sheet>
      )}

      {erasing && (
        <AskSheet
          title="Erase all data"
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

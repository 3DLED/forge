/**
 * The injury log.
 *
 * Current ones first, because the only reason to open this screen is either to add one or to
 * say one is better. Healed ones stay below as a record — "how many times has this shoulder
 * gone" is the question a log exists to answer.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import AskSheet from '../../ui/AskSheet';
import InjurySheet from './InjurySheet';
import { plural } from '../../ui/text';
import { allInjuries, deleteInjury, recoverableSessions, resolveInjury } from '../../data/injuries';
import { SEVERITIES, activeInjuries, isActive } from '../../domain/injuries';
import type { Injury } from '../../domain/injuries';
import { REGION_LABELS } from '../../domain/regions';
import { daysBetween, formatDayLabel, todayKey } from '../../domain/dates';

export default function InjuryView() {
  const today = todayKey();
  const injuries = useLiveQuery(() => allInjuries(), []);
  const [logging, setLogging] = useState(false);
  const [healing, setHealing] = useState<Injury | null>(null);
  const [deleting, setDeleting] = useState<Injury | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** How many sessions healing this one would hand back, so the prompt can say so. */
  const recoverable = useLiveQuery(
    async () => (healing ? (await recoverableSessions(healing, today)).length : 0),
    [healing?.id, today],
  );

  const list = injuries ?? [];
  const current = activeInjuries(list, today);
  const past = list.filter((injury) => !isActive(injury, today));

  return (
    <>
      <PageHeader
        title="Injuries"
        subtitle={current.length > 0 ? `${plural(current.length, 'current')}` : undefined}
        action={<Link to="/more" className="btn ghost sm">Back</Link>}
      />

      {notice && <p className="tiny faint">{notice}</p>}

      {list.length === 0 && (
        <div className="empty">
          <span className="glyph">🩹</span>
          <p>Nothing logged.</p>
          <p className="small faint">
            Log something that hurts and the sessions that load it step aside — the rest of your
            training carries on.
          </p>
        </div>
      )}

      {current.length > 0 && <div className="section-title">Current</div>}
      {current.map((injury) => (
        <div className="card" key={injury.id}>
          <div className="card-head" style={{ marginBottom: '0.35rem' }}>
            <h3 className="truncate grow">{injury.label}</h3>
            <span className="pill warn">{SEVERITIES[injury.severity].label}</span>
          </div>
          <div className="small muted">
            {REGION_LABELS[injury.region]} · resting{' '}
            {plural(Math.max(0, daysBetween(today, injury.restUntil) + 1), 'more day')}
          </div>
          <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
            Since {formatDayLabel(injury.startDate).toLowerCase()}
            {injury.cause ? ` · ${injury.cause}` : ''}
          </div>
          <button
            className="btn primary block"
            style={{ marginTop: '0.6rem' }}
            onClick={() => setHealing(injury)}
          >
            Mark it healed
          </button>
        </div>
      ))}

      {past.length > 0 && <div className="section-title">Healed</div>}
      {past.map((injury) => (
        <div className="card tight" key={injury.id}>
          <div className="row between">
            <span className="grow truncate">{injury.label}</span>
            <span className="small mono muted">{REGION_LABELS[injury.region]}</span>
          </div>
          <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
            {formatDayLabel(injury.startDate).toLowerCase()}
            {injury.resolvedDate
              ? ` — healed ${formatDayLabel(injury.resolvedDate).toLowerCase()}`
              : ' — rest period ended'}
            {injury.cause ? ` · ${injury.cause}` : ''}
          </div>
          <button
            className="btn ghost sm block danger"
            style={{ marginTop: '0.4rem' }}
            onClick={() => setDeleting(injury)}
          >
            Remove from the log
          </button>
        </div>
      ))}

      <button
        className="btn primary block"
        style={{ marginTop: '1rem' }}
        onClick={() => setLogging(true)}
      >
        Log an injury
      </button>

      {logging && (
        <InjurySheet
          onClose={() => setLogging(false)}
          onLogged={({ skipped }) => {
            setLogging(false);
            setNotice(
              skipped > 0
                ? `${plural(skipped, 'session')} skipped while it heals.`
                : 'Logged. Nothing planned needed to move.',
            );
          }}
        />
      )}

      {healing && (
        <AskSheet
          title="Healed already?"
          message={
            recoverable && recoverable > 0
              ? `${plural(recoverable, 'session')} were skipped for this and are still ahead of you. Putting them back returns them to your calendar as planned.`
              : 'Nothing skipped for this is still ahead of you, so your calendar stays as it is.'
          }
          confirmLabel={recoverable && recoverable > 0 ? 'Heal and put them back' : 'Mark it healed'}
          onCancel={() => setHealing(null)}
          onConfirm={async () => {
            const { restored } = await resolveInjury(healing, { restoreSessions: true }, today);
            setHealing(null);
            setNotice(
              restored > 0
                ? `Healed. ${plural(restored, 'session')} back on the calendar.`
                : 'Healed.',
            );
          }}
        />
      )}

      {deleting && (
        <AskSheet
          title="Remove this from the log?"
          message="It stops counting toward how often this has happened. Sessions it skipped stay as they are."
          confirmLabel="Remove"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteInjury(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}

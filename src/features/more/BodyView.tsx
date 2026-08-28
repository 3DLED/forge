/**
 * Bodyweight, logged over time.
 *
 * More than a vanity number here: it is the load in every push-up, pull-up and lunge you do,
 * so without it half the library reports no work done. The copy says so, because "why is this
 * app asking my weight" deserves an answer better than "for your profile".
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import BarChart from '../../ui/BarChart';
import AskSheet from '../../ui/AskSheet';
import { useApp } from '../../ui/AppProvider';
import { bodyweightEntries, deleteBodyweight, logBodyweight } from '../../data/body';
import { formatDayLabel, todayKey } from '../../domain/dates';
import { displayWeight, inputWeightToKg, weightLabel } from '../../domain/units';
import type { Id } from '../../domain/types';

export default function BodyView() {
  const { profile, units } = useApp();
  const entries = useLiveQuery(() => bodyweightEntries(), [], undefined);

  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Id | null>(null);

  const latest = entries?.at(-1);
  const parsed = Number(value);
  const canSave = Number.isFinite(parsed) && parsed > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    await logBodyweight(inputWeightToKg(parsed, units), todayKey(), profile.id);
    setValue('');
    setSaving(false);
  };

  // Oldest first, capped — a year of daily weigh-ins is not readable as bars.
  const recent = (entries ?? []).slice(-30);
  const bars = recent.map((entry) => ({
    label: entry.date.slice(5),
    value: displayWeight(entry.value, units),
  }));

  /*
   * A weight chart starting at zero is a flat line with a rounding error on top, since nobody's
   * weight varies by more than a few percent. The bars are drawn against a floor just below the
   * lowest reading so the change is actually visible.
   */
  const floor = bars.length > 1 ? Math.min(...bars.map((b) => b.value)) * 0.97 : 0;
  const scaled = bars.map((bar) => ({ ...bar, value: bar.value - floor }));

  return (
    <>
      <PageHeader
        title="Bodyweight"
        action={<Link to="/more" className="btn ghost sm">Back</Link>}
      />

      <p className="small muted">
        This is the load in every push-up, pull-up and lunge you do. Without it those sets show
        as no work at all on your volume chart. Sessions are valued at what you weighed that
        week, so logging it today does not rewrite last spring.
      </p>

      <div className="section-title">Log today</div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <input
          type="text"
          inputMode="decimal"
          placeholder={latest ? String(Math.round(displayWeight(latest.value, units))) : '180'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          style={{ flex: 1 }}
        />
        <span className="muted small" style={{ alignSelf: 'center' }}>{weightLabel(units)}</span>
        <button className="btn primary" disabled={!canSave || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Log'}
        </button>
      </div>

      {latest && (
        <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
          Last logged {formatDayLabel(latest.date).toLowerCase()} at{' '}
          {Math.round(displayWeight(latest.value, units))} {weightLabel(units)}.
        </p>
      )}

      {scaled.length > 1 && (
        <>
          <div className="section-title">Trend</div>
          <BarChart
            bars={scaled}
            formatValue={(v) => `${Math.round(v + floor)} ${weightLabel(units)}`}
          />
        </>
      )}

      {entries && entries.length > 0 && (
        <>
          <div className="section-title">History</div>
          {[...entries].reverse().slice(0, 40).map((entry) => (
            <div className="suggest-row" key={entry.id}>
              <span className="grow">
                <strong>{Math.round(displayWeight(entry.value, units))} {weightLabel(units)}</strong>
                <br />
                <span className="tiny faint">{formatDayLabel(entry.date)}</span>
              </span>
              <button className="btn ghost sm danger" onClick={() => setDeleting(entry.id)}>
                ✕
              </button>
            </div>
          ))}
        </>
      )}

      {entries?.length === 0 && (
        <div className="empty">
          <span className="glyph">⚖️</span>
          <p className="small">No weigh-ins yet.</p>
          <p className="tiny faint">Once a week is plenty. Daily readings mostly measure lunch.</p>
        </div>
      )}

      {deleting && (
        <AskSheet
          title="Delete this weigh-in?"
          message="Volume for any session valued against it will be recalculated."
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteBodyweight(deleting);
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}

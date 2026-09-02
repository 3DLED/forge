/**
 * Telling the app a max you already know.
 *
 * This is a notebook before it is a coach. Most people arrive knowing what they can lift, and
 * an app that insisted on measuring everything itself before it would suggest a weight is one
 * they would work around rather than use.
 *
 * The rep count is asked for rather than assumed, because people know their maxes in different
 * currencies — a single, a triple, a five. Whatever you give it converts through the same
 * formula the rest of the app uses, so an entered max and a tested one mean the same thing
 * downstream.
 */

import { useState } from 'react';
import Sheet from '../../ui/Sheet';
import { recordTestResult } from '../../data/fitnessTests';
import { estimate1RM } from '../../domain/training';
import { MAX_CHART_REPS } from '../../domain/loading';
import { formatWeight, inputWeightToKg, weightLabel } from '../../domain/units';
import { todayKey } from '../../domain/dates';
import type { Exercise, UnitSystem } from '../../domain/types';

export default function KnownMaxSheet({
  exercise,
  units,
  onClose,
  onSaved,
}: {
  exercise: Exercise;
  units: UnitSystem;
  onClose: () => void;
  onSaved: (loadKg: number) => void;
}) {
  const [load, setLoad] = useState('');
  const [reps, setReps] = useState('1');
  const [date, setDate] = useState(todayKey());
  const [saving, setSaving] = useState(false);

  const loadKg = load ? inputWeightToKg(Number(load), units) : 0;
  const repCount = Number(reps) || 0;
  const oneRepMax = loadKg > 0 ? estimate1RM(loadKg, repCount) : null;

  /* Above twelve reps the conversion stops meaning anything — see estimate1RM. */
  const usable = loadKg > 0 && repCount >= 1 && repCount <= MAX_CHART_REPS && oneRepMax != null;

  return (
    <Sheet
      title={`Known max · ${exercise.name}`}
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          disabled={!usable || saving}
          onClick={async () => {
            setSaving(true);
            await recordTestResult({
              exerciseSlug: exercise.slug,
              kind: 'maxLoad',
              value: loadKg,
              reps: repCount,
              date,
              entry: 'manual',
            });
            onSaved(loadKg);
          }}
        >
          {saving ? 'Saving…' : 'Save it'}
        </button>
      }
    >
      <p className="small muted">
        What you already know you can lift. Used exactly like a tested max until you test it,
        and it ages the same way.
      </p>

      <div className="section-title">The lift</div>
      <div className="row">
        <input
          type="number"
          inputMode="decimal"
          value={load}
          placeholder="60"
          aria-label={`Load in ${weightLabel(units)}`}
          onChange={(event) => setLoad(event.target.value)}
          style={{ maxWidth: '7rem' }}
        />
        <span className="muted small">{weightLabel(units)} for</span>
        <input
          type="number"
          inputMode="numeric"
          value={reps}
          aria-label="Reps"
          onChange={(event) => setReps(event.target.value)}
          style={{ maxWidth: '5rem' }}
        />
        <span className="muted small">reps</span>
      </div>
      <p className="tiny faint">
        A single, a triple, whatever you know it as. One rep means you are giving a true max.
      </p>

      <div className="section-title">When</div>
      <input
        type="date"
        value={date}
        max={todayKey()}
        aria-label="When you lifted it"
        onChange={(event) => setDate(event.target.value)}
      />
      <p className="tiny faint">
        Dating it honestly matters — an old max is still used, and the app says when it is
        getting stale rather than quietly trusting it forever.
      </p>

      {loadKg > 0 && repCount > MAX_CHART_REPS && (
        <p className="tiny" style={{ color: 'var(--warn)' }}>
          Above {MAX_CHART_REPS} reps the conversion to a one-rep max stops meaning anything, so
          this will not be stored as a max. Enter a heavier set for fewer reps.
        </p>
      )}

      {usable && (
        <div className="card tight">
          <div className="row between">
            <span className="grow">Works out at</span>
            <span className="mono">
              <strong>{formatWeight(oneRepMax!, units)}</strong> for one
            </span>
          </div>
          <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
            {repCount === 1
              ? 'Taken as given.'
              : `Converted from ${repCount} reps, the same way the rest of the app converts.`}
          </div>
        </div>
      )}
    </Sheet>
  );
}

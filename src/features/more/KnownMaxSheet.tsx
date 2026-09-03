/**
 * Telling the app a best you already know.
 *
 * This is a notebook before it is a coach. Most people arrive knowing what they can do, and an
 * app that insisted on measuring everything itself before it would suggest a weight is one
 * they would work around rather than use.
 *
 * What "a max" means depends on the movement, so the form follows `testKindFor` — the same
 * function that decides which test the movement takes. A bench press max is a weight; a
 * push-up max is a number of reps; a plank max is a duration. Asking every movement for a
 * weight makes the whole sheet unusable for the bodyweight half of the library, which is most
 * of what this app is for.
 *
 * The rep count is asked for rather than assumed on a lift, because people know their maxes in
 * different currencies — a single, a triple, a five. Whatever you give it converts through the
 * same formula the rest of the app uses, so an entered max and a tested one mean the same
 * thing downstream.
 */

import { useState } from 'react';
import Sheet from '../../ui/Sheet';
import { recordTestResult } from '../../data/fitnessTests';
import { estimate1RM } from '../../domain/training';
import { MAX_CHART_REPS } from '../../domain/loading';
import { testKindFor } from '../../domain/fitnessTests';
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
  /** What was saved, already worded — the sheet knows which currency it was in. */
  onSaved: (summary: string) => void;
}) {
  const kind = testKindFor(exercise);
  const loaded = kind === 'threeRepMax' || kind === 'maxLoad';

  const [load, setLoad] = useState('');
  const [reps, setReps] = useState(loaded ? '1' : '');
  const [seconds, setSeconds] = useState('');
  const [date, setDate] = useState(todayKey());
  const [saving, setSaving] = useState(false);

  const loadKg = load ? inputWeightToKg(Number(load), units) : 0;
  const repCount = Number(reps) || 0;
  const holdSec = Number(seconds) || 0;
  const oneRepMax = loadKg > 0 ? estimate1RM(loadKg, repCount) : null;

  /* Above twelve reps the conversion stops meaning anything — see estimate1RM. */
  const usable = loaded
    ? loadKg > 0 && repCount >= 1 && repCount <= MAX_CHART_REPS && oneRepMax != null
    : kind === 'hold'
      ? holdSec > 0
      : repCount > 0;

  const save = async () => {
    setSaving(true);

    if (loaded) {
      await recordTestResult({
        exerciseSlug: exercise.slug,
        kind: 'maxLoad',
        value: loadKg,
        reps: repCount,
        date,
        entry: 'manual',
      });
      onSaved(`${formatWeight(loadKg, units)} for ${repCount}`);
      return;
    }

    if (kind === 'hold') {
      await recordTestResult({
        exerciseSlug: exercise.slug,
        kind: 'hold',
        value: holdSec,
        date,
        entry: 'manual',
      });
      onSaved(`${holdSec}s`);
      return;
    }

    await recordTestResult({
      exerciseSlug: exercise.slug,
      kind: 'reps',
      value: repCount,
      date,
      entry: 'manual',
    });
    onSaved(`${repCount} reps`);
  };

  return (
    <Sheet
      title={`${loaded ? 'Known max' : 'Known best'} · ${exercise.name}`}
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          disabled={!usable || saving}
          onClick={() => void save()}
        >
          {saving ? 'Saving…' : 'Save it'}
        </button>
      }
    >
      <p className="small muted">
        {loaded
          ? 'What you already know you can lift. Used exactly like a tested max until you test it, and it ages the same way.'
          : 'What you already know you can do. Used exactly like a tested result until you test it, and it ages the same way.'}
      </p>

      {loaded && (
        <>
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
        </>
      )}

      {kind === 'reps' && (
        <>
          <div className="section-title">Your best set</div>
          <div className="row">
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              placeholder="30"
              aria-label="Reps"
              onChange={(event) => setReps(event.target.value)}
              style={{ maxWidth: '6rem' }}
            />
            <span className="muted small">reps, unbroken</span>
          </div>
          <p className="tiny faint">
            The most you can do in one set with good form, stopping when the form goes — not a
            total across a session.
          </p>
        </>
      )}

      {kind === 'hold' && (
        <>
          <div className="section-title">Your best hold</div>
          <div className="row">
            <input
              type="number"
              inputMode="numeric"
              value={seconds}
              placeholder="60"
              aria-label="Seconds"
              onChange={(event) => setSeconds(event.target.value)}
              style={{ maxWidth: '6rem' }}
            />
            <span className="muted small">seconds</span>
          </div>
          <p className="tiny faint">
            The longest you can hold the position before it breaks down.
          </p>
        </>
      )}

      <div className="section-title">When</div>
      <input
        type="date"
        value={date}
        max={todayKey()}
        aria-label={loaded ? 'When you lifted it' : 'When you did it'}
        onChange={(event) => setDate(event.target.value)}
      />
      <p className="tiny faint">
        Dating it honestly matters — an old result is still used, and the app says when it is
        getting stale rather than quietly trusting it forever.
      </p>

      {loaded && loadKg > 0 && repCount > MAX_CHART_REPS && (
        <p className="tiny" style={{ color: 'var(--warn)' }}>
          Above {MAX_CHART_REPS} reps the conversion to a one-rep max stops meaning anything, so
          this will not be stored as a max. Enter a heavier set for fewer reps.
        </p>
      )}

      {loaded && usable && (
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

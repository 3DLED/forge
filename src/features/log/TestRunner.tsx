/**
 * Running a benchmark test, step by step.
 *
 * The app runs the protocol rather than describing it because that is the entire value of a
 * test: maximal strength testing is reliable when standardised and not otherwise, so a test
 * you improvise is a number you cannot compare to the last one. Loads, rest and the attempt
 * cap all come from the protocol; the only things you supply are the estimate it starts from
 * and whether each attempt was good.
 *
 * The result is the last attempt you completed with good form — not the last one you tried,
 * and not what the estimate predicted.
 */

import { useMemo, useState } from 'react';
import Sheet from '../../ui/Sheet';
import RestTimer from './RestTimer';
import HoldTimer from './HoldTimer';
import { useApp } from '../../ui/AppProvider';
import { unlockAudio } from '../../ui/beep';
import { plural } from '../../ui/text';
import { recordTestResult } from '../../data/fitnessTests';
import {
  TEST_KINDS,
  buildProtocol,
  oneRepMaxFromThree,
  testKindFor,
  testTiming,
} from '../../domain/fitnessTests';
import type { TestKind, TestResult } from '../../domain/fitnessTests';
import { loadsForExercise } from '../../domain/equipment';
import { displayWeight, formatWeight, inputWeightToKg, weightLabel } from '../../domain/units';
import { formatDayLabel, todayKey } from '../../domain/dates';
import type { Exercise } from '../../domain/types';

export default function TestRunner({
  exercise,
  history,
  onClose,
  onRecorded,
}: {
  exercise: Exercise;
  /** Past results, for the retest warning and for showing what you are chasing. */
  history: TestResult[];
  onClose: () => void;
  onRecorded: (result: TestResult) => void;
}) {
  const { units, activeEquipment } = useApp();
  const today = todayKey();
  const kind: TestKind = testKindFor(exercise);
  const spec = TEST_KINDS[kind];
  const timing = testTiming(history, exercise.slug, today);

  /** The starting guess for a 3RM, in display units so the box reads naturally. */
  const [estimate, setEstimate] = useState('');
  const [started, setStarted] = useState(kind !== 'threeRepMax');
  const [stepIndex, setStepIndex] = useState(0);
  const [resting, setResting] = useState<number | null>(null);
  const [holding, setHolding] = useState(false);
  const [openResult, setOpenResult] = useState('');
  /** The heaviest attempt completed with good form. */
  const [bestKg, setBestKg] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loads = useMemo(
    () => loadsForExercise(exercise, activeEquipment?.availableWeightsKg),
    [exercise, activeEquipment],
  );

  const estimateKg = estimate ? inputWeightToKg(Number(estimate), units) : undefined;

  const steps = useMemo(
    () => buildProtocol({ exercise, kind, estimateKg, loads }),
    [exercise, kind, estimateKg, loads],
  );

  const step = steps[stepIndex];
  const done = stepIndex >= steps.length;

  const finish = async (value: number) => {
    setSaving(true);
    const result = await recordTestResult({
      exerciseSlug: exercise.slug,
      kind,
      value,
      reps: kind === 'threeRepMax' ? 3 : undefined,
    });
    onRecorded(result);
  };

  /** An attempt completed cleanly: bank it and offer the next load. */
  const attemptGood = () => {
    if (step?.loadKg != null) setBestKg(step.loadKg);
    unlockAudio();
    if (step?.restSec) setResting(Date.now() + step.restSec * 1000);
    setStepIndex((i) => i + 1);
  };

  /** A failed attempt ends the test — everything after it would be measuring fatigue. */
  const attemptFailed = () => setStepIndex(steps.length);

  const previous = timing.state === 'never' ? undefined : timing.last;

  return (
    <Sheet
      title={`${spec.label} · ${exercise.name}`}
      onClose={onClose}
      footer={
        done && kind === 'threeRepMax' ? (
          <button
            className="btn primary block"
            disabled={saving || bestKg == null}
            onClick={() => bestKg != null && void finish(bestKg)}
          >
            {bestKg == null
              ? 'No completed attempt to record'
              : `Record ${formatWeight(bestKg, units)}`}
          </button>
        ) : undefined
      }
    >
      {/* Reported, never enforced: a redo after a bad attempt is legitimate. */}
      {timing.state === 'tooSoon' && (
        <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
          <span className="pill warn">Recently tested</span>
          <p className="small" style={{ margin: '0.5rem 0 0' }}>
            You tested this{' '}
            {timing.daysSince === 0 ? 'today' : `${plural(timing.daysSince, 'day')} ago`}. Inside a
            week the number reads fatigue as much as strength —{' '}
            {plural(timing.waitDays, 'more day')} would make it comparable. You can go ahead
            anyway.
          </p>
        </div>
      )}

      {previous && (
        <p className="small muted">
          Last time, {formatDayLabel(previous.date).toLowerCase()}:{' '}
          <strong>
            {kind === 'threeRepMax'
              ? formatWeight(previous.value, units)
              : `${previous.value} ${spec.unit}`}
          </strong>
        </p>
      )}

      <p className="small muted">{spec.protocol}</p>

      {/* A 3RM cannot lay out loads until it knows roughly where you are. */}
      {!started && (
        <>
          <div className="section-title">What can you do for three?</div>
          <div className="row">
            <input
              type="number"
              inputMode="decimal"
              value={estimate}
              placeholder={
                previous ? String(Math.round(displayWeight(previous.value, units))) : '60'
              }
              aria-label={`Estimated three rep max in ${weightLabel(units)}`}
              onChange={(event) => setEstimate(event.target.value)}
              style={{ maxWidth: '8rem' }}
            />
            <span className="muted small">{weightLabel(units)}</span>
          </div>
          <p className="tiny faint">
            A rough guess is fine. Everything is worked out from it, and a wrong one costs an
            extra attempt rather than the result — what gets recorded is the heaviest set you
            actually finish.
          </p>
          <button
            className="btn primary block"
            style={{ marginTop: '0.75rem' }}
            disabled={!estimateKg || estimateKg <= 0}
            onClick={() => setStarted(true)}
          >
            Lay out the test
          </button>
        </>
      )}

      {started && !done && step && (
        <>
          <div className="section-title">
            {step.label}
            {step.role === 'attempt' && bestKg != null && ` · best so far ${formatWeight(bestKg, units)}`}
          </div>

          <div className="card">
            <div className="row between">
              <strong>
                {step.loadKg != null && `${formatWeight(step.loadKg, units)} · `}
                {step.reps != null
                  ? plural(step.reps, 'rep')
                  : step.holdSec != null
                    ? `${step.holdSec}s hold`
                    : kind === 'hold'
                      ? 'Hold to form failure'
                      : 'As many as form allows'}
              </strong>
              <span className="pill">{step.role === 'attempt' ? 'Attempt' : 'Warm-up'}</span>
            </div>
            {step.note && (
              <p className="tiny faint" style={{ margin: '0.4rem 0 0' }}>
                {step.note}
              </p>
            )}
          </div>

          {/*
            Every control below is dead while the rest overlay is up.

            The overlay covers this area but does not capture taps through it, so the hold
            button underneath stayed live: a thumb landing there started the attempt and threw
            the rest away, mid-countdown, with nothing said. Rest between attempts is part of
            the protocol — an attempt taken early is not comparable to the one it is being
            measured against.
          */}
          {/* An open set — the count or the clock is the result. */}
          {step.role === 'attempt' && kind === 'reps' && (
            <>
              <div className="section-title">How many did you get?</div>
              <div className="row">
                <input
                  type="number"
                  inputMode="numeric"
                  value={openResult}
                  aria-label="Reps completed"
                  onChange={(event) => setOpenResult(event.target.value)}
                  style={{ maxWidth: '8rem' }}
                />
                <span className="muted small">reps</span>
              </div>
              <button
                className="btn primary block"
                style={{ marginTop: '0.75rem' }}
                disabled={saving || resting != null || !Number(openResult)}
                onClick={() => void finish(Number(openResult))}
              >
                Record it
              </button>
            </>
          )}

          {step.role === 'attempt' && kind === 'hold' && (
            <button
              className="btn primary block"
              style={{ marginTop: '0.5rem' }}
              disabled={resting != null}
              onClick={() => {
                unlockAudio();
                setHolding(true);
              }}
            >
              ▶ Start the hold
            </button>
          )}

          {step.role === 'attempt' && kind === 'threeRepMax' && (
            <div className="stack" style={{ marginTop: '0.5rem' }}>
              <button
                className="btn primary block"
                disabled={resting != null}
                onClick={attemptGood}
              >
                Made it — three good reps
              </button>
              <button className="btn block" disabled={resting != null} onClick={attemptFailed}>
                Failed it — stop the test
              </button>
            </div>
          )}

          {step.role === 'warmup' && (
            <button
              className="btn primary block"
              style={{ marginTop: '0.5rem' }}
              disabled={resting != null}
              onClick={() => {
                unlockAudio();
                if (step.restSec) setResting(Date.now() + step.restSec * 1000);
                setStepIndex((i) => i + 1);
              }}
            >
              {step.holdSec != null ? 'Held it' : 'Done'}
            </button>
          )}
        </>
      )}

      {done && kind === 'threeRepMax' && (
        <div className="card">
          {bestKg != null ? (
            <>
              <strong>{formatWeight(bestKg, units)} for three</strong>
              <p className="tiny faint" style={{ margin: '0.3rem 0 0' }}>
                About {formatWeight(oneRepMaxFromThree(bestKg), units)} for one, by Epley. Stored
                as it stands today, so improving the formula later cannot rewrite this.
              </p>
            </>
          ) : (
            <span className="small muted">
              No attempt was completed, so there is nothing to record. Nothing is saved.
            </span>
          )}
        </div>
      )}

      {resting && (
        <RestTimer
          endsAt={resting}
          upNext={
            steps[stepIndex]
              ? { label: steps[stepIndex].label, sameMovement: true }
              : null
          }
          onExtend={(seconds) => setResting((end) => (end ?? Date.now()) + seconds * 1000)}
          onDismiss={() => setResting(null)}
          onJump={() => setResting(null)}
        />
      )}

      {holding && (
        <HoldTimer
          onDone={(elapsedSec) => {
            setHolding(false);
            void finish(elapsedSec);
          }}
          onCancel={() => setHolding(false)}
        />
      )}
    </Sheet>
  );
}

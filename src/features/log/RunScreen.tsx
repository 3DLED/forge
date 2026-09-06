/**
 * The screen you look at while running, which is to say: barely.
 *
 * Everything here is shaped by the fact that it gets read at arm's length, out of breath, in
 * sunlight, for about a second at a time. So one number is enormous and the rest are not, and
 * the enormous one is current pace — the only figure on the screen you can still do something
 * about. Distance and elapsed time are facts; pace is a decision.
 *
 * Below the numbers is the session itself, whole. A structured run is a thing you are partway
 * through, and "what am I doing now" is only half the question — the other half is what is
 * left, which is the difference between pacing the fourth of eight and pacing the fourth of
 * four. So every piece is on screen, the one you are on is lit, the ones behind you carry what
 * they actually cost, and the list scrolls itself so the current piece stays in view.
 *
 * Full screen rather than a sheet. A run is not a thing you do *while* looking at the workout
 * behind it, and the reachable-thumb argument that makes everything else in this app a bottom
 * sheet is beaten here by the fact that the controls are three enormous targets at the bottom
 * anyway.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { lockScroll } from '../../ui/scrollLock';
import { useApp } from '../../ui/AppProvider';
import { useRunTracker } from './useRunTracker';
import { buildRunPlan, describeSegment, type RunKind, type RunPlan } from '../../domain/runPlan';
import { runSettingsFor, describeRunSettings, shapeFor } from '../../domain/runSettings';
import { formatClock, formatDistance, formatPace } from '../../domain/units';

export default function RunScreen({
  title,
  slug,
  runKind,
  /** Prescribed distance from the set, when it had one — a plan for a run nobody structured. */
  plannedDistanceM,
  plannedPaceSecPerKm,
  onSave,
  onClose,
}: {
  title: string;
  /** So the settings screen opens on the right kind of run rather than on a blank one. */
  slug: string;
  runKind: RunKind;
  plannedDistanceM?: number;
  plannedPaceSecPerKm?: number;
  /** Writes the run back onto the set that opened this. */
  onSave: (result: { distanceM: number; timeSec: number }) => void;
  onClose: () => void;
}) {
  const { profile, units } = useApp();
  const navigate = useNavigate();
  const settings = runSettingsFor(units, profile.run);
  const shape = shapeFor(settings, runKind);

  /*
   * The session's own prescription outranks the structure saved for this kind of run.
   *
   * If the workout says "5 km at 5:20" then that is what today is, and having to go and set it
   * up a second time in Run alerts would be asking the same question twice. The saved shape is
   * for runs that came from nowhere — which is most of them. It wins back only where it says
   * something the set cannot: a set carries one distance, so anything with reps in it is a
   * session the prescription could not have expressed.
   */
  const plan = useMemo<RunPlan | null>(() => {
    if (plannedDistanceM != null && plannedDistanceM > 0 && shape.kind !== 'intervals') {
      return buildRunPlan({
        kind: 'steady',
        distanceM: plannedDistanceM,
        targetSecPerKm: plannedPaceSecPerKm ?? settings.targetSecPerKm,
      });
    }
    return buildRunPlan(shape);
  }, [plannedDistanceM, plannedPaceSecPerKm, shape, settings.targetSecPerKm]);

  const run = useRunTracker({ settings, units, plan });

  useEffect(() => lockScroll(), []);

  const pace = run.reading?.paceSecPerKm;
  const index = run.progress?.index ?? 0;
  const done = useMemo(() => new Map(run.finished.map((piece) => [piece.index, piece])), [run.finished]);

  /* Keep the piece you are running in view, so the list never needs a hand to read. */
  const current = useRef<HTMLLIElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [index]);

  /** What is left of the current piece, in the currency it is measured in. */
  const remaining = (() => {
    const progress = run.progress;
    if (!progress) return null;
    if (progress.remainingM != null) return `${formatDistance(progress.remainingM, units)} to go`;
    if (progress.remainingSec != null) return `${formatClock(Math.ceil(progress.remainingSec))} to go`;
    return null;
  })();

  const started = run.status !== 'idle';
  const latest = run.notes[0] ?? null;

  return (
    <div className="run-screen">
      <header className="run-screen-head">
        <div className="grow">
          <strong className="truncate">{plan?.name ?? title}</strong>
          <div className="tiny faint">{describeRunSettings(settings)}</div>
        </div>
        {/*
          Only before the gun. Restructuring a session you are three reps into would either
          throw away the reps or lie about them, and there is no third option worth building.
        */}
        {!started && (
          <button
            className="btn ghost sm"
            onClick={() => navigate(`/more/run?for=${slug}`)}
            aria-label="Run alerts"
          >
            ⚙
          </button>
        )}
        <button className="btn ghost sm" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      {/* The one number worth reading mid-stride. */}
      <div className="run-pace-big">
        <span className="run-pace-value mono">{pace == null ? '—' : formatPace(pace, units).split(' ')[0]}</span>
        <span className="run-pace-unit tiny faint">
          {units === 'imperial' ? 'per mile' : 'per kilometre'}
          {run.reading && !run.reading.moving && started ? ' · stopped' : ''}
        </span>
      </div>

      <div className="run-stats">
        <div>
          <div className="run-stat mono">{formatDistance(run.distanceM, units)}</div>
          <div className="tiny faint">distance</div>
        </div>
        <div>
          <div className="run-stat mono">{formatClock(Math.floor(run.elapsedSec))}</div>
          <div className="tiny faint">time</div>
        </div>
        <div>
          <div className="run-stat mono">
            {run.averageSecPerKm == null ? '—' : formatPace(run.averageSecPerKm, units).split(' ')[0]}
          </div>
          <div className="tiny faint">average</div>
        </div>
      </div>

      {run.error && <div className="card tight run-error small">{run.error}</div>}

      {started && run.reading && run.reading.discarded > 3 && run.distanceM === 0 && (
        <p className="tiny faint">
          Waiting for a decent fix. Under trees or between tall buildings this can take a minute.
        </p>
      )}

      {/*
        The last thing said, held above the list.

        Cues are spoken once, into one earbud, over traffic. Only the newest one, because the
        list below already says everything a history would — where you are and what each piece
        cost — and two scrolling panels on a screen read at arm's length is one too many.
      */}
      {latest && <div className={`run-latest ${latest.kind}`}>{latest.text}</div>}

      {plan ? (
        <ol className="run-pieces">
          {plan.segments.map((segment, position) => {
            const piece = done.get(position);
            const isCurrent = position === index && run.status !== 'finished';
            return (
              <li
                key={position}
                ref={isCurrent ? current : undefined}
                className={`run-piece${isCurrent ? ' current' : piece ? ' done' : ' ahead'}`}
              >
                <span className="run-piece-mark">{piece ? '✓' : isCurrent ? '▶' : position + 1}</span>
                <span className="run-piece-what">{describeSegment(segment, units)}</span>
                <span className="run-piece-note tiny">
                  {piece
                    ? `${formatDistance(piece.distanceM, units)} · ${formatClock(Math.round(piece.seconds))}`
                    : isCurrent
                      ? (remaining ?? '')
                      : ''}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="run-notes">
          {run.notes.length === 0 && started && (
            <p className="tiny faint">Cues will appear here as they are said.</p>
          )}
          {run.notes.map((note) => (
            <div key={`${note.at}-${note.text}`} className={`run-note ${note.kind}`}>
              {note.text}
            </div>
          ))}
        </div>
      )}

      <div className="run-actions">
        {run.status === 'idle' && (
          <button className="btn primary block" onClick={run.start}>
            Start run
          </button>
        )}
        {run.status === 'running' && (
          <>
            <button className="btn block grow" onClick={run.pause}>
              Pause
            </button>
            <button className="btn primary block grow" onClick={run.finish}>
              Finish
            </button>
          </>
        )}
        {run.status === 'paused' && (
          <>
            <button className="btn primary block grow" onClick={run.resume}>
              Resume
            </button>
            <button className="btn block grow" onClick={run.finish}>
              Finish
            </button>
          </>
        )}
        {run.status === 'finished' && (
          <>
            <button className="btn block grow" onClick={onClose}>
              Discard
            </button>
            <button
              className="btn primary block grow"
              onClick={() =>
                onSave({ distanceM: Math.round(run.distanceM), timeSec: Math.round(run.elapsedSec) })
              }
            >
              Save to workout
            </button>
          </>
        )}
      </div>
    </div>
  );
}

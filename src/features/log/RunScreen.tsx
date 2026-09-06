/**
 * The screen you look at while running, which is to say: barely.
 *
 * Everything here is shaped by the fact that it gets read at arm's length, out of breath, in
 * sunlight, for about a second at a time. So one number is enormous and the rest are not, and
 * the enormous one is current pace — the only figure on the screen you can still do something
 * about. Distance and elapsed time are facts; pace is a decision.
 *
 * Full screen rather than a sheet. A run is not a thing you do *while* looking at the workout
 * behind it, and the reachable-thumb argument that makes everything else in this app a bottom
 * sheet is beaten here by the fact that the controls are three enormous targets at the bottom
 * anyway.
 *
 * What was said is also kept on screen. Cues are spoken once, into one earbud, over traffic,
 * and "what did it just say" is otherwise unanswerable.
 */

import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { lockScroll } from '../../ui/scrollLock';
import { useApp } from '../../ui/AppProvider';
import { useRunTracker } from './useRunTracker';
import { buildRunPlan, describeSegment, type RunPlan } from '../../domain/runPlan';
import { runSettingsFor, describeRunSettings } from '../../domain/runSettings';
import { formatClock, formatDistance, formatPace } from '../../domain/units';

export default function RunScreen({
  title,
  /** Prescribed distance from the set, when it had one — a plan for a run nobody structured. */
  plannedDistanceM,
  plannedPaceSecPerKm,
  onSave,
  onClose,
}: {
  title: string;
  plannedDistanceM?: number;
  plannedPaceSecPerKm?: number;
  /** Writes the run back onto the set that opened this. */
  onSave: (result: { distanceM: number; timeSec: number }) => void;
  onClose: () => void;
}) {
  const { profile, units } = useApp();
  const navigate = useNavigate();
  const settings = runSettingsFor(units, profile.run);

  /*
   * The session's own prescription outranks the shape saved on the settings screen.
   *
   * If the workout says "5 km at 5:20" then that is what today is, and having to go and set it
   * up a second time in Run alerts would be asking the same question twice. The saved shape is
   * for runs that came from nowhere — which is most of them.
   */
  const plan = useMemo<RunPlan | null>(() => {
    if (plannedDistanceM != null && plannedDistanceM > 0 && settings.shape?.kind !== 'intervals') {
      return buildRunPlan({
        kind: 'steady',
        distanceM: plannedDistanceM,
        targetSecPerKm: plannedPaceSecPerKm ?? settings.targetSecPerKm,
      });
    }
    return buildRunPlan(settings.shape ?? { kind: 'open' });
  }, [plannedDistanceM, plannedPaceSecPerKm, settings.shape, settings.targetSecPerKm]);

  const run = useRunTracker({ settings, units, plan });

  useEffect(() => lockScroll(), []);

  const pace = run.reading?.paceSecPerKm;
  const segment = run.progress?.segment ?? null;

  /** What is left of the current piece, in the currency it is measured in. */
  const remaining = (() => {
    const progress = run.progress;
    if (!progress) return null;
    if (progress.remainingM != null) return `${formatDistance(progress.remainingM, units)} to go`;
    if (progress.remainingSec != null) return `${formatClock(Math.ceil(progress.remainingSec))} to go`;
    return null;
  })();

  const started = run.status !== 'idle';

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
          <button className="btn ghost sm" onClick={() => navigate('/more/run')} aria-label="Run alerts">
            ⚙
          </button>
        )}
        <button className="btn ghost sm" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      {segment && (
        <div className="run-segment">
          <div className="run-segment-what">{describeSegment(segment, units)}</div>
          {remaining && <div className="tiny faint">{remaining}</div>}
          {run.progress && plan && (
            <div className="tiny faint">
              Piece {Math.min(run.progress.index + 1, plan.segments.length)} of {plan.segments.length}
            </div>
          )}
        </div>
      )}

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

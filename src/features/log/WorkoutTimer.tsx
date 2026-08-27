/**
 * The conditioning timer: stopwatch, EMOM, and AMRAP.
 *
 * Every mode derives its display from wall-clock timestamps rather than counting ticks.
 * Phones sleep, tabs get backgrounded, and `setInterval` is throttled hard in both — a timer
 * that decrements a counter drifts badly under exactly the conditions it is used in. Elapsed
 * time is always `banked + (now - startedAt)`, so it is correct the instant the screen wakes.
 *
 * The same reasoning applies to the beeps: on waking from a throttled background, the timer
 * may have crossed several interval boundaries at once. It fires one cue, not a burst of six.
 */

import { useEffect, useRef, useState } from 'react';
import Sheet from '../../ui/Sheet';
import {
  audioAvailable,
  beepCountdown,
  beepFinish,
  beepInterval,
  beepRound,
  buzz,
  unlockAudio,
} from '../../ui/beep';
import { formatClock, formatDuration } from '../../domain/units';
import { plural } from '../../ui/text';

export type TimerMode = 'stopwatch' | 'emom' | 'amrap';

export interface TimerResult {
  mode: TimerMode;
  /** Total working seconds. */
  timeSec: number;
  rounds?: number;
  roundSplitsSec?: number[];
  notes?: string;
}

const MODES: { value: TimerMode; label: string; blurb: string }[] = [
  { value: 'stopwatch', label: 'Stopwatch', blurb: 'Counts up. Records how long the work took.' },
  { value: 'emom', label: 'EMOM', blurb: 'Every minute on the minute — a cue at each interval.' },
  { value: 'amrap', label: 'AMRAP', blurb: 'As many rounds as possible before the cap.' },
];

/** Keeps the screen awake while the clock runs. Unsupported browsers simply do without. */
function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // Denied or unsupported — not worth surfacing.
      }
    };

    void request();
    // The lock is dropped when the tab is hidden, so it has to be retaken on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !sentinel) void request();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [active]);
}

export default function WorkoutTimer({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (result: TimerResult) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<TimerMode>('amrap');
  const [capMin, setCapMin] = useState(12);
  const [intervalSec, setIntervalSec] = useState(60);
  const [emomRounds, setEmomRounds] = useState(10);
  const [cueOn, setCueOn] = useState(true);

  const [running, setRunning] = useState(false);
  const [bankedMs, setBankedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [splits, setSplits] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [notes, setNotes] = useState('');

  const lastCueRef = useRef(0);

  const elapsedMs = bankedMs + (running && startedAt ? now - startedAt : 0);
  const elapsedSec = elapsedMs / 1000;

  const totalSec =
    mode === 'emom' ? intervalSec * emomRounds : mode === 'amrap' ? capMin * 60 : 0;
  const hasCap = totalSec > 0;
  const remainingSec = hasCap ? Math.max(0, totalSec - elapsedSec) : 0;

  const started = elapsedMs > 0 || running;
  useWakeLock(running);

  // Drive re-renders while running. 200ms keeps the display honest to a tenth without
  // spinning the CPU; the value shown always comes from the clock, not from this counter.
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(tick);
  }, [running]);

  // Interval cues and the automatic finish.
  useEffect(() => {
    if (!running) return;

    const cueEvery = mode === 'emom' ? intervalSec : 60;
    const crossed = Math.floor(elapsedSec / cueEvery);

    if (crossed > lastCueRef.current) {
      lastCueRef.current = crossed;
      const atEnd = hasCap && elapsedSec >= totalSec - 0.5;
      if (cueOn && !atEnd) {
        beepInterval();
        buzz(80);
      }
    }

    if (hasCap && elapsedSec >= totalSec) {
      setBankedMs(totalSec * 1000);
      setRunning(false);
      setStartedAt(null);
      setFinished(true);
      if (cueOn) {
        beepFinish();
        buzz([120, 80, 120]);
      }
    }
  }, [elapsedSec, running, mode, intervalSec, cueOn, hasCap, totalSec]);

  const start = () => {
    // Must happen inside the tap: browsers refuse to start audio any other way.
    if (cueOn) {
      unlockAudio();
      beepCountdown();
    }
    lastCueRef.current = Math.floor(elapsedSec / (mode === 'emom' ? intervalSec : 60));
    setStartedAt(Date.now());
    setNow(Date.now());
    setRunning(true);
    setFinished(false);
  };

  const pause = () => {
    setBankedMs(elapsedMs);
    setStartedAt(null);
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setStartedAt(null);
    setBankedMs(0);
    setSplits([]);
    setFinished(false);
    lastCueRef.current = 0;
  };

  const logRound = () => {
    setSplits((previous) => [...previous, Math.round(elapsedSec)]);
    if (cueOn) {
      beepRound();
      buzz(40);
    }
  };

  const emomRound = Math.min(emomRounds, Math.floor(elapsedSec / intervalSec) + 1);
  const withinInterval = intervalSec - (elapsedSec % intervalSec);
  const rounds = mode === 'amrap' ? splits.length : mode === 'emom' ? emomRound : undefined;

  /** The number the display is actually about, given the mode. */
  const bigValue =
    mode === 'stopwatch'
      ? formatClock(elapsedSec)
      : mode === 'emom'
        ? formatClock(running || started ? withinInterval : intervalSec)
        : formatClock(remainingSec);

  const lastSplit = splits.length > 1 ? splits[splits.length - 1] - splits[splits.length - 2] : splits[0];

  return (
    <Sheet
      title="Timer"
      onClose={onClose}
      footer={
        <div className="row" style={{ gap: '0.5rem' }}>
          {!running && (
            <button className="btn primary grow" onClick={start}>
              {started ? 'Resume' : 'Start'}
            </button>
          )}
          {running && (
            <button className="btn grow" onClick={pause}>
              Pause
            </button>
          )}
          {started && (
            <button className="btn" onClick={reset}>
              Reset
            </button>
          )}
          {started && !running && (
            <button
              className="btn primary grow"
              onClick={() =>
                void onSave({
                  mode,
                  timeSec: Math.round(elapsedSec),
                  rounds,
                  roundSplitsSec: splits.length > 0 ? splits : undefined,
                  notes: notes.trim() || undefined,
                })
              }
            >
              Save
            </button>
          )}
        </div>
      }
    >
      {!started && (
        <>
          <div className="chip-row">
            {MODES.map((option) => (
              <button
                key={option.value}
                className={`chip${mode === option.value ? ' on' : ''}`}
                onClick={() => {
                  setMode(option.value);
                  reset();
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
            {MODES.find((m) => m.value === mode)?.blurb}
          </p>
        </>
      )}

      {/* --- the clock --- */}
      <div className={`timer-face${finished ? ' finished' : ''}`}>
        <div className="timer-big mono">{bigValue}</div>
        <div className="timer-sub">
          {mode === 'emom' && (
            <>
              Round {emomRound} of {emomRounds} · {formatClock(elapsedSec)} elapsed
            </>
          )}
          {mode === 'amrap' && (
            <>
              {plural(splits.length, 'round')} · {formatClock(elapsedSec)} of{' '}
              {formatClock(totalSec)}
            </>
          )}
          {mode === 'stopwatch' && (started ? 'Running' : 'Ready')}
        </div>
      </div>

      {/* The AMRAP round button: the one control used while genuinely out of breath. */}
      {mode === 'amrap' && (
        <>
          <button
            className="round-button"
            onClick={logRound}
            disabled={!running}
            aria-label="Record a completed round"
          >
            <span className="round-count mono">{splits.length}</span>
            <span className="round-label">
              {running ? 'Tap for each round' : 'Start to log rounds'}
            </span>
          </button>

          {splits.length > 0 && (
            <div className="row between small" style={{ marginTop: '0.5rem' }}>
              <span className="muted">Last round {formatDuration(lastSplit ?? 0)}</span>
              <button
                className="btn ghost sm"
                onClick={() => setSplits((s) => s.slice(0, -1))}
              >
                Undo round
              </button>
            </div>
          )}
        </>
      )}

      {/* --- setup --- */}
      {!started && (
        <>
          {mode === 'amrap' && (
            <>
              <div className="section-title">Time cap</div>
              <div className="chip-row">
                {[6, 8, 10, 12, 15, 20, 30].map((minutes) => (
                  <button
                    key={minutes}
                    className={`chip${capMin === minutes ? ' on' : ''}`}
                    onClick={() => setCapMin(minutes)}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === 'emom' && (
            <>
              <div className="section-title">Interval</div>
              <div className="chip-row">
                {[30, 45, 60, 90, 120].map((seconds) => (
                  <button
                    key={seconds}
                    className={`chip${intervalSec === seconds ? ' on' : ''}`}
                    onClick={() => setIntervalSec(seconds)}
                  >
                    {seconds < 60 ? `${seconds}s` : formatDuration(seconds)}
                  </button>
                ))}
              </div>

              <div className="section-title">Rounds</div>
              <div className="chip-row">
                {[5, 8, 10, 12, 15, 20].map((count) => (
                  <button
                    key={count}
                    className={`chip${emomRounds === count ? ' on' : ''}`}
                    onClick={() => setEmomRounds(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
                {formatDuration(intervalSec * emomRounds)} total.
              </p>
            </>
          )}

          <div className="section-title">Sound</div>
          <button
            className={`chip${cueOn ? ' on' : ''}`}
            onClick={() => {
              const next = !cueOn;
              setCueOn(next);
              if (next) {
                unlockAudio();
                beepInterval();
              }
            }}
          >
            {cueOn ? '🔔 Beep every interval' : '🔕 Silent'}
          </button>
          {!audioAvailable() && (
            <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
              This browser has no audio support — the timer still runs, silently.
            </p>
          )}
        </>
      )}

      {started && !running && (
        <>
          <div className="section-title">What was the work?</div>
          <textarea
            rows={2}
            value={notes}
            placeholder="10 burpees + 15 KB swings…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </>
      )}
    </Sheet>
  );
}

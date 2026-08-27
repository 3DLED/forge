/**
 * The running clock for a timed block.
 *
 * Every mode derives its display from wall-clock timestamps rather than counting ticks.
 * Phones sleep, tabs get backgrounded, and `setInterval` is throttled hard in both — a timer
 * that decrements a counter drifts badly under exactly the conditions it is used in. Elapsed
 * time is always `banked + (now - startedAt)`, so it is correct the instant the screen wakes.
 *
 * The same reasoning applies to the cues: on waking from a throttled background the timer may
 * have crossed several interval boundaries at once. It fires one, not a burst of six.
 *
 * What the block *contains* is shown throughout. Reading the round back off the screen is the
 * whole reason to have set it up here rather than run a kitchen timer.
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
import { formatClock } from '../../domain/units';
import { plural } from '../../ui/text';
import type { LoggedBlock } from '../../domain/types';

export interface TimerResult {
  timeSec: number;
  rounds?: number;
  roundSplitsSec?: number[];
}

export default function WorkoutTimer({
  block,
  movements,
  onClose,
  onSave,
  onStart,
}: {
  block: LoggedBlock;
  /** One line per movement in a round, e.g. "10 × Burpee". Display only. */
  movements: string[];
  onClose: () => void;
  onSave: (result: TimerResult) => void | Promise<void>;
  /** Fired when the clock starts, so the session clock can start with it. */
  onStart?: () => void;
}) {
  const style = block.style;
  const intervalSec = block.intervalSec ?? 60;
  const targetRounds = block.targetRounds ?? 10;
  const capSec = block.capSec ?? 0;

  const [cueOn, setCueOn] = useState(true);
  const [running, setRunning] = useState(false);
  const [bankedMs, setBankedMs] = useState((block.timeSec ?? 0) * 1000);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [splits, setSplits] = useState<number[]>(block.roundSplitsSec ?? []);
  const [finished, setFinished] = useState(false);

  const lastCueRef = useRef(0);

  const elapsedMs = bankedMs + (running && startedAt ? now - startedAt : 0);
  const elapsedSec = elapsedMs / 1000;

  const totalSec = style === 'emom' ? intervalSec * targetRounds : capSec;
  const hasCap = totalSec > 0;
  const remainingSec = hasCap ? Math.max(0, totalSec - elapsedSec) : 0;
  const started = elapsedMs > 0 || running;

  useWakeLock(running);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(tick);
  }, [running]);

  useEffect(() => {
    if (!running) return;

    const cueEvery = style === 'emom' ? intervalSec : 60;
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
  }, [elapsedSec, running, style, intervalSec, cueOn, hasCap, totalSec]);

  const start = () => {
    // Must happen inside the tap: browsers refuse to start audio any other way.
    if (cueOn) {
      unlockAudio();
      beepCountdown();
    }
    lastCueRef.current = Math.floor(elapsedSec / (style === 'emom' ? intervalSec : 60));
    setStartedAt(Date.now());
    setNow(Date.now());
    setRunning(true);
    setFinished(false);
    // Starting a block is starting the workout. Requiring a separate tap on the session
    // clock only produces sessions whose recorded duration is zero.
    onStart?.();
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

  const emomRound = Math.min(targetRounds, Math.floor(elapsedSec / intervalSec) + 1);
  const withinInterval = intervalSec - (elapsedSec % intervalSec);
  const rounds = style === 'amrap' ? splits.length : style === 'emom' ? emomRound : undefined;

  const bigValue =
    style === 'forTime'
      ? formatClock(hasCap ? remainingSec : elapsedSec)
      : style === 'emom'
        ? formatClock(started ? withinInterval : intervalSec)
        : formatClock(remainingSec);

  const lastSplit =
    splits.length > 1 ? splits[splits.length - 1] - splits[splits.length - 2] : splits[0];

  return (
    <Sheet
      title={block.label ?? blockTitle(block)}
      onClose={onClose}
      footer={
        <div className="row" style={{ gap: '0.5rem' }}>
          {running ? (
            <button className="btn grow" onClick={pause}>
              Pause
            </button>
          ) : (
            <button className="btn primary grow" onClick={start}>
              {started ? 'Resume' : 'Start'}
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
                  timeSec: Math.round(elapsedSec),
                  rounds,
                  roundSplitsSec: splits.length > 0 ? splits : undefined,
                })
              }
            >
              Save
            </button>
          )}
        </div>
      }
    >
      <div className={`timer-face${finished ? ' finished' : ''}`}>
        <div className="timer-big mono">{bigValue}</div>
        <div className="timer-sub">
          {style === 'emom' && (
            <>
              Round {emomRound} of {targetRounds} · {formatClock(elapsedSec)} elapsed
            </>
          )}
          {style === 'amrap' && (
            <>
              {plural(splits.length, 'round')} · {formatClock(elapsedSec)} of{' '}
              {formatClock(totalSec)}
            </>
          )}
          {style === 'forTime' && (started ? 'Running' : 'Ready')}
        </div>
      </div>

      {/* What one round is. The reason for building the block instead of using any timer. */}
      {movements.length > 0 && (
        <div className="round-recipe">
          <div className="round-recipe-title">Each round</div>
          {movements.map((line, index) => (
            <div className="round-recipe-line" key={index}>
              {line}
            </div>
          ))}
        </div>
      )}

      {style === 'amrap' && (
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
              <span className="muted">Last round {formatClock(lastSplit ?? 0)}</span>
              <button className="btn ghost sm" onClick={() => setSplits((s) => s.slice(0, -1))}>
                Undo round
              </button>
            </div>
          )}
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
        {cueOn
          ? style === 'emom'
            ? '🔔 Beep every interval'
            : '🔔 Beep every minute'
          : '🔕 Silent'}
      </button>
      {!audioAvailable() && (
        <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
          This browser has no audio support — the timer still runs, silently.
        </p>
      )}
    </Sheet>
  );
}

export function blockTitle(block: LoggedBlock): string {
  if (block.style === 'amrap') return `AMRAP ${formatClock(block.capSec ?? 0)}`;
  if (block.style === 'emom') {
    return `EMOM ${formatClock(block.intervalSec ?? 60)} × ${block.targetRounds ?? 10}`;
  }
  return block.capSec ? `For time (cap ${formatClock(block.capSec)})` : 'For time';
}

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

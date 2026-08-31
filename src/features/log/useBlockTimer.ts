/**
 * The running clock for a timed block, as state rather than as a screen.
 *
 * It lives here, above both the pinned strip and the expanded timer, for one reason: the
 * clock has to survive the sheet being closed. Held inside the sheet — as it was — collapsing
 * the timer to get at your log threw away the elapsed time and every logged round.
 *
 * Every mode derives its display from wall-clock timestamps rather than counting ticks.
 * Phones sleep, tabs get backgrounded, and `setInterval` is throttled hard in both — a timer
 * that decrements a counter drifts badly under exactly the conditions it is used in. Elapsed
 * time is always `banked + (now - startedAt)`, so it is correct the instant the screen wakes.
 *
 * The same reasoning applies to the cues: on waking from a throttled background the timer may
 * have crossed several interval boundaries at once. It fires one, not a burst of six.
 */

import { useEffect, useRef, useState } from 'react';
import {
  beepCountdown,
  beepFinish,
  beepInterval,
  beepRound,
  buzz,
  unlockAudio,
} from '../../ui/beep';
import { formatClock } from '../../domain/units';
import type { LoggedBlock } from '../../domain/types';

export interface TimerResult {
  timeSec: number;
  rounds?: number;
  roundSplitsSec?: number[];
}

export interface BlockTimer {
  block: LoggedBlock;
  running: boolean;
  /** The clock reached its cap and stopped itself. */
  finished: boolean;
  /** Anything on the clock at all, banked or running. */
  started: boolean;
  elapsedSec: number;
  /** The headline number, already formatted for whichever mode this is. */
  bigValue: string;
  /** Rounds so far: tapped for an AMRAP, derived from the clock for an EMOM. */
  rounds?: number;
  emomRound: number;
  targetRounds: number;
  splits: number[];
  /** How long the most recent round took. */
  lastSplitSec?: number;
  cueOn: boolean;
  setCueOn: (on: boolean) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  logRound: () => void;
  undoRound: () => void;
  /** What would be written to the block if it were saved right now. */
  result: TimerResult;
}

export function useBlockTimer(
  block: LoggedBlock | null,
  /** Fired when the clock starts, so the session clock can start with it. */
  onStart?: () => void,
): BlockTimer | null {
  const [cueOn, setCueOn] = useState(true);
  const [running, setRunning] = useState(false);
  const [bankedMs, setBankedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [splits, setSplits] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  const lastCueRef = useRef(0);
  const blockId = block?.id ?? null;

  /*
   * Re-seed whenever a different block takes the clock, picking up whatever that block
   * already had recorded so reopening a finished piece shows its result rather than zero.
   *
   * Keyed on the id alone, deliberately. The session is a live query, so the block object is
   * a fresh identity on every write — including the timer's own save — and depending on the
   * object would wipe the clock the moment it recorded anything.
   */
  useEffect(() => {
    setBankedMs((block?.timeSec ?? 0) * 1000);
    setSplits(block?.roundSplitsSec ?? []);
    setRunning(false);
    setStartedAt(null);
    setFinished(false);
    lastCueRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);

  const style = block?.style ?? 'amrap';
  const intervalSec = block?.intervalSec ?? 60;
  const targetRounds = block?.targetRounds ?? 10;
  const capSec = block?.capSec ?? 0;

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

  if (!block) return null;

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

  const undoRound = () => setSplits((previous) => previous.slice(0, -1));

  const emomRound = Math.min(targetRounds, Math.floor(elapsedSec / intervalSec) + 1);
  const withinInterval = intervalSec - (elapsedSec % intervalSec);
  const rounds = style === 'amrap' ? splits.length : style === 'emom' ? emomRound : undefined;

  const bigValue =
    style === 'forTime'
      ? formatClock(hasCap ? remainingSec : elapsedSec)
      : style === 'emom'
        ? formatClock(started ? withinInterval : intervalSec)
        : formatClock(remainingSec);

  return {
    block,
    running,
    finished,
    started,
    elapsedSec,
    bigValue,
    rounds,
    emomRound,
    targetRounds,
    splits,
    lastSplitSec:
      splits.length > 1 ? splits[splits.length - 1] - splits[splits.length - 2] : splits[0],
    cueOn,
    setCueOn,
    start,
    pause,
    reset,
    logRound,
    undoRound,
    result: {
      timeSec: Math.round(elapsedSec),
      rounds,
      roundSplitsSec: splits.length > 0 ? splits : undefined,
    },
  };
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

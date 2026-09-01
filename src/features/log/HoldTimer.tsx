/**
 * The clock for a hold: a plank, a hang, a wall sit.
 *
 * Counts up rather than down, because the target is a floor and not a ceiling — the useful
 * question at 45 seconds is whether you have another ten in you, and a timer that hit zero
 * and stopped would be telling you to quit at exactly the moment worth pushing through. It
 * turns green at the mark and keeps going until you say you are done.
 *
 * Wears the rest panel's clothes deliberately. It appears in the same place, at the same
 * size, doing the same job — a second visual language for "a clock is running, look here"
 * would be one to learn for no reason.
 *
 * Counts from a wall-clock instant like every other timer here, so pocketing the phone
 * mid-hang does not stop it.
 */

import { useEffect, useRef, useState } from 'react';
import { beepFinish, buzz } from '../../ui/beep';
import { formatClock } from '../../domain/units';

export default function HoldTimer({
  targetSec,
  onDone,
  onCancel,
}: {
  /** What the set asked for. Absent when the set never named a time. */
  targetSec?: number;
  /** Records the hold, in whole seconds. */
  onDone: (elapsedSec: number) => void;
  onCancel: () => void;
}) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(tick);
  }, []);

  const elapsedSec = Math.max(0, (now - startedAt) / 1000);
  const reached = targetSec != null && targetSec > 0 && elapsedSec >= targetSec;

  /* One cue at the mark, not one every tick after it. */
  const cued = useRef(false);
  useEffect(() => {
    if (!reached || cued.current) return;
    cued.current = true;
    beepFinish();
    buzz([120, 80, 120]);
  }, [reached]);

  const whole = Math.floor(elapsedSec);

  return (
    <div className={`rest-timer${reached ? ' done' : ''}`}>
      <span className="rest-label">
        {reached
          ? 'Target hit — keep going'
          : targetSec
            ? `Hold · target ${formatClock(targetSec)}`
            : 'Hold'}
      </span>
      <span className="clock">
        {Math.floor(whole / 60)}:{String(whole % 60).padStart(2, '0')}
      </span>
      <div className="rest-actions">
        <button className="btn block on-accent timer-action" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn block on-accent timer-action"
          onClick={() => onDone(Math.round(elapsedSec))}
        >
          Done
        </button>
      </div>
    </div>
  );
}

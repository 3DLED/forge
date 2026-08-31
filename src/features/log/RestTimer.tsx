import { useEffect, useRef, useState } from 'react';
import { beepFinish, buzz } from '../../ui/beep';

/**
 * Counts down to a wall-clock instant rather than decrementing a number, so the timer stays
 * correct when the phone screen sleeps or the tab is backgrounded — which is most of the
 * time it is running.
 *
 * Sized to be read across a room rather than squinted at. The clock is the whole point of the
 * panel, so it gets the space; the two controls sit full-width beneath it because they are hit
 * mid-set, often one-handed, and a shared row makes "skip" a target you can land on by
 * accident when you meant to add thirty seconds.
 *
 * The label and the number are separate lines so nothing reflows at zero. Swapping a big
 * "0:00" for a big "Rest done" would resize the panel at the exact moment you are looking at
 * it, which reads as a glitch.
 */
export default function RestTimer({
  endsAt,
  onExtend,
  onDismiss,
}: {
  endsAt: number;
  onExtend: (seconds: number) => void;
  onDismiss: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  const remaining = Math.max(0, Math.round((endsAt - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const done = remaining === 0;

  /*
   * The cue, once per deadline.
   *
   * Keyed on the deadline itself rather than a boolean: +30s moves the deadline, which has to
   * re-arm the cue, while the 250ms tick must not fire it four times a second once the clock
   * has settled on zero.
   *
   * Audio needs an unlocked AudioContext, which only a real tap can provide — the tap that
   * ticks the set off does it, over in SessionLogger. Without that this is silently a no-op,
   * which is the right failure: the countdown on screen is still correct.
   */
  const cuedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!done || cuedFor.current === endsAt) return;
    cuedFor.current = endsAt;
    beepFinish();
    buzz([120, 80, 120]);
  }, [done, endsAt]);

  return (
    <div className={`rest-timer${done ? ' done' : ''}`}>
      <span className="rest-label">{done ? 'Rest done' : 'Rest'}</span>
      <span className="clock">
        {minutes}:{String(seconds).padStart(2, '0')}
      </span>
      <div className="rest-actions">
        <button className="btn block on-accent timer-action" onClick={() => onExtend(30)}>
          +30s
        </button>
        <button className="btn block on-accent timer-action" onClick={onDismiss}>
          {done ? 'Done' : 'Skip'}
        </button>
      </div>
    </div>
  );
}

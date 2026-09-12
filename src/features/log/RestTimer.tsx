import { useEffect, useRef, useState } from 'react';
import { beepFinish, buzz } from '../../ui/beep';
import { armRestCue, cancelRestCue } from '../../data/notifications';

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
export interface UpNext {
  /** "Set 3 of 4 · Kettlebell Swing", or "Pike Push-Up". */
  label: string;
  /** True while there are sets left on the movement you just finished. */
  sameMovement: boolean;
}

export default function RestTimer({
  endsAt,
  upNext,
  cue,
  onExtend,
  onDismiss,
  onJump,
}: {
  endsAt: number;
  /** What the rest is for. Absent once nothing is left unticked. */
  upNext?: UpNext | null;
  /**
   * Words for the notification that carries this cue past a sleeping screen, or null when
   * that is switched off. Built by the caller, which is where the translator lives.
   */
  cue?: { title: string; body: string } | null;
  onExtend: (seconds: number) => void;
  onDismiss: () => void;
  /** Close the rest and scroll to whatever is next. */
  onJump: () => void;
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

  /*
   * The same cue, delivered by the phone.
   *
   * The beep above needs an unlocked AudioContext and a page that is still running. Between
   * sets the screen is usually off with the phone on the floor, which is to say the cue was
   * missing at exactly the moment it was wanted.
   *
   * Armed from inside the panel because the panel's life already is the rest: it mounts when
   * the rest starts and unmounts when it is skipped or dismissed, so arming and disarming
   * come free rather than having to be remembered at four call sites. A new deadline from
   * +30s re-arms it for the same reason.
   *
   * If it fires while you are watching the countdown you get a banner as well as a beep,
   * which is a nuisance. Arming only once the app is backgrounded would avoid that and lose a
   * race against the phone suspending the page, and a duplicate cue is a far better failure
   * than a missing one.
   */
  useEffect(() => {
    if (!cue) return;
    void armRestCue(new Date(endsAt), cue.title, cue.body);
    return () => void cancelRestCue();
  }, [endsAt, cue?.title, cue?.body]);

  return (
    <div className={`rest-timer${done ? ' done' : ''}`}>
      <span className="rest-label">{done ? 'Rest done' : 'Rest'}</span>
      <span className="clock">
        {minutes}:{String(seconds).padStart(2, '0')}
      </span>
      {/*
        What the rest is for, above the controls.
        
        Resting is the one moment in a session with nothing to do and a question worth
        answering — the phone is already in your hand and you are about to go looking for the
        answer by scrolling anyway. It sits above the buttons rather than below the clock so
        the number keeps the middle of the panel, and it is a button because "what's next" and
        "take me there" are the same thought.
      */}
      {upNext && (
        <button className="rest-next" onClick={onJump}>
          <span className="rest-next-label">
            {upNext.sameMovement ? 'Up next' : 'Then'}
          </span>
          <span className="rest-next-value">{upNext.label}</span>
        </button>
      )}

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

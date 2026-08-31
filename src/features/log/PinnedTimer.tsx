/**
 * The clock that never scrolls away.
 *
 * One strip holding whichever clock matters right now. By default that is the session clock,
 * which used to sit in a card at the top and slide off the screen as soon as you added a
 * third movement. When a timed block is running it takes the strip over, and hands it back
 * when you are done with it.
 *
 * The strip is a summary, not the whole timer. Everything that needs reading rather than
 * glancing — the round recipe, the splits, the sound toggle, reset — lives in the expanded
 * sheet, which this opens. What stays here is what you need mid-effort: the number, and the
 * one button you hit without looking.
 */

import { useEffect, useState } from 'react';
import { blockTitle } from './blockLabels';
import { formatClock } from '../../domain/units';
import { plural } from '../../ui/text';
import {
  isStopwatchRunning,
  pauseStopwatch,
  sessionElapsedSec,
  startStopwatch,
} from '../../data/sessions';
import type { BlockTimer } from './useBlockTimer';
import type { LoggedSession } from '../../domain/types';

export default function PinnedTimer({
  session,
  now,
  timer,
  onExpand,
  onCloseBlock,
}: {
  session: LoggedSession;
  /** Ticked by the owner, so the session clock and the block clock move together. */
  now: number;
  /** Non-null when a block has the strip. */
  timer: BlockTimer | null;
  onExpand: () => void;
  /** Hand the strip back to the session clock. */
  onCloseBlock: () => void;
}) {
  return (
    <div className="pinned-timer">
      <div className="pinned-inner">
        {timer ? (
          <BlockFace timer={timer} onExpand={onExpand} onCloseBlock={onCloseBlock} />
        ) : (
          <SessionFace session={session} now={now} />
        )}
      </div>
    </div>
  );
}

function SessionFace({ session, now }: { session: LoggedSession; now: number }) {
  const running = isStopwatchRunning(session);
  const elapsed = sessionElapsedSec(session, now);
  const started = elapsed > 0 || running;

  return (
    <>
      <div className="grow">
        <div className="pinned-label">Session</div>
        <div className={`pinned-clock mono${started ? '' : ' idle'}`}>{formatClock(elapsed)}</div>
      </div>

      {running ? (
        <button className="btn pinned-action" onClick={() => void pauseStopwatch(session)}>
          Pause
        </button>
      ) : (
        <button
          className="btn primary pinned-action"
          onClick={() => void startStopwatch(session)}
        >
          {started ? 'Resume' : 'Start'}
        </button>
      )}
    </>
  );
}

function BlockFace({
  timer,
  onExpand,
  onCloseBlock,
}: {
  timer: BlockTimer;
  onExpand: () => void;
  onCloseBlock: () => void;
}) {
  const { block, running, finished, started } = timer;
  const isAmrap = block.style === 'amrap';

  /*
   * Dismissing throws away a run that was never saved, and this button sits a thumb's width
   * from the one you hit every round. So it arms first once there is anything to lose — the
   * same two-tap the timer sheet used to guard itself with, moved to where the risk now is.
   *
   * It disarms on its own after eight seconds: long enough to tap, hesitate, and tap again
   * out of breath, short enough that it is not still primed minutes later.
   */
  const atRisk = started || timer.splits.length > 0;
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timeout = setTimeout(() => setArmed(false), 8000);
    return () => clearTimeout(timeout);
  }, [armed]);

  return (
    <>
      {/*
        The name and the number open the full timer; the control beside them does not. Two
        targets, so reaching for "tap round" mid-set cannot collapse the thing you are using.
      */}
      <button className="pinned-open grow" onClick={onExpand} aria-label="Open the full timer">
        <div className="pinned-label">
          {blockTitle(block)}
          {finished ? ' · done' : ''}
        </div>
        <div className={`pinned-clock mono${finished ? ' finished' : ''}`}>{timer.bigValue}</div>
        <div className="pinned-sub">
          {block.style === 'emom' && `Round ${timer.emomRound} of ${timer.targetRounds}`}
          {isAmrap && plural(timer.splits.length, 'round')}
          {block.style === 'forTime' && (started ? 'Running' : 'Ready')}
          {started && ` · ${formatClock(timer.elapsedSec)} elapsed`}
        </div>
      </button>

      {/*
        An AMRAP is scored by tapping, so the tap is the control that belongs on the strip —
        putting Pause here instead would mean opening the sheet for every single round.
      */}
      {isAmrap && running ? (
        <button
          className="pinned-round"
          onClick={timer.logRound}
          aria-label="Record a completed round"
        >
          <span className="pinned-round-count mono">{timer.splits.length}</span>
          <span className="pinned-round-label">Round</span>
        </button>
      ) : running ? (
        <button className="btn pinned-action" onClick={timer.pause}>
          Pause
        </button>
      ) : finished ? (
        <button className="btn primary pinned-action" onClick={onExpand}>
          Save
        </button>
      ) : (
        <button className="btn primary pinned-action" onClick={timer.start}>
          {started ? 'Resume' : 'Start'}
        </button>
      )}

      <button
        className={`btn ghost pinned-dismiss${armed ? ' armed' : ''}`}
        onClick={() => {
          if (!atRisk || armed) onCloseBlock();
          else setArmed(true);
        }}
        aria-label={
          armed ? 'Tap again to discard this run' : 'Put the session clock back'
        }
      >
        {armed ? 'Discard?' : '✕'}
      </button>
    </>
  );
}

/**
 * The timed block, expanded.
 *
 * This is no longer where the clock lives — that moved to useBlockTimer, above both this and
 * the pinned strip, so collapsing the sheet no longer throws the run away. What is left here
 * is everything that wants reading rather than glancing: what one round contains, how the
 * rounds have been paced, the sound toggle, and the controls you only reach for between
 * efforts rather than during one.
 *
 * Closing is an ordinary dismiss now. It used to be a two-tap guard because the sheet *was*
 * the timer and a stray backdrop tap ended the run; the clock now keeps going in the strip,
 * so guarding it would be protecting against nothing.
 */

import Sheet from '../../ui/Sheet';
import { blockTitle } from './blockLabels';
import { audioAvailable, beepInterval, unlockAudio } from '../../ui/beep';
import { formatClock } from '../../domain/units';
import { plural } from '../../ui/text';
import type { BlockTimer, TimerResult } from './useBlockTimer';

export type { TimerResult } from './useBlockTimer';

export default function WorkoutTimer({
  timer,
  movements,
  onClose,
  onSave,
}: {
  timer: BlockTimer;
  /** One line per movement in a round, e.g. "10 × Burpee". Display only. */
  movements: string[];
  onClose: () => void;
  onSave: (result: TimerResult) => void | Promise<void>;
}) {
  const { block, running, finished, started, splits } = timer;

  return (
    <Sheet
      title={blockTitle(block)}
      onClose={onClose}
      footer={
        /*
         * One control per line, each the full width of the sheet. These are hit mid-effort,
         * often without looking straight at the screen; a row of three shared-width buttons
         * turns "pause" into a target you can miss and land on "reset" instead.
         */
        <div className="stack">
          {running ? (
            <button className="btn block timer-action" onClick={timer.pause}>
              Pause
            </button>
          ) : (
            <button className="btn primary block timer-action" onClick={timer.start}>
              {started ? 'Resume' : 'Start'}
            </button>
          )}

          {started && !running && (
            <button
              className="btn primary block timer-action"
              onClick={() => void onSave(timer.result)}
            >
              Save
            </button>
          )}

          {started && (
            <button className="btn block" onClick={timer.reset}>
              Reset
            </button>
          )}
        </div>
      }
    >
      <div className={`timer-face${finished ? ' finished' : ''}`}>
        <div className="timer-big mono">{timer.bigValue}</div>
        <div className="timer-sub">
          {block.style === 'emom' && (
            <>
              Round {timer.emomRound} of {timer.targetRounds} ·{' '}
              {formatClock(timer.elapsedSec)} elapsed
            </>
          )}
          {block.style === 'amrap' && (
            <>
              {plural(splits.length, 'round')} · {formatClock(timer.elapsedSec)} of{' '}
              {formatClock(block.capSec ?? 0)}
            </>
          )}
          {block.style === 'forTime' && (started ? 'Running' : 'Ready')}
        </div>
      </div>

      <p className="tiny faint" style={{ textAlign: 'center' }}>
        The clock keeps running in the strip at the top — closing this does not stop it.
      </p>

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

      {block.style === 'amrap' && (
        <>
          <button
            className="round-button"
            onClick={timer.logRound}
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
              <span className="muted">Last round {formatClock(timer.lastSplitSec ?? 0)}</span>
              <button className="btn ghost sm" onClick={timer.undoRound}>
                Undo round
              </button>
            </div>
          )}
        </>
      )}

      <div className="section-title">Sound</div>
      <button
        className={`chip${timer.cueOn ? ' on' : ''}`}
        onClick={() => {
          const next = !timer.cueOn;
          timer.setCueOn(next);
          if (next) {
            unlockAudio();
            beepInterval();
          }
        }}
      >
        {timer.cueOn
          ? block.style === 'emom'
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

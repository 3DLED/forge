/**
 * The session clock.
 *
 * A session record is created the moment you tap "Start a workout", which is usually well
 * before the first rep — while you are still picking movements or walking to the rack. This
 * is the clock for the work itself, started and paused deliberately, so "how long did that
 * take" answers the training question rather than the how-long-was-the-app-open question.
 */

import { useEffect, useState } from 'react';
import {
  isStopwatchRunning,
  pauseStopwatch,
  resetStopwatch,
  sessionElapsedSec,
  startStopwatch,
} from '../../data/sessions';
import { formatClock } from '../../domain/units';
import type { LoggedSession } from '../../domain/types';

export default function SessionStopwatch({ session }: { session: LoggedSession }) {
  const running = isStopwatchRunning(session);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [running]);

  const elapsed = sessionElapsedSec(session, now);
  const started = elapsed > 0 || running;

  return (
    <div className="stopwatch">
      <span className={`elapsed${started ? '' : ' idle'}`} aria-label="Session time">
        {formatClock(elapsed)}
      </span>

      {running ? (
        <button className="btn sm" onClick={() => void pauseStopwatch(session)}>
          Pause
        </button>
      ) : (
        <button className="btn sm primary" onClick={() => void startStopwatch(session)}>
          {started ? 'Resume' : 'Start time'}
        </button>
      )}

      {started && !running && (
        <button
          className="btn sm ghost"
          aria-label="Reset session time"
          onClick={() => void resetStopwatch(session)}
        >
          Reset
        </button>
      )}
    </div>
  );
}

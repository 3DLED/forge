import { useEffect, useState } from 'react';

/**
 * Counts down to a wall-clock instant rather than decrementing a number, so the timer stays
 * correct when the phone screen sleeps or the tab is backgrounded — which is most of the
 * time it is running.
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

  return (
    <div className={`rest-timer${done ? ' done' : ''}`}>
      <span className="clock">
        {done ? 'Rest done' : `${minutes}:${String(seconds).padStart(2, '0')}`}
      </span>
      <span className="row" style={{ gap: '0.4rem' }}>
        <button className="btn sm on-accent" onClick={() => onExtend(30)}>
          +30s
        </button>
        <button className="btn sm on-accent" onClick={onDismiss}>
          Skip
        </button>
      </span>
    </div>
  );
}

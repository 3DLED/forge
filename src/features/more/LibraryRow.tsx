/**
 * One saved thing, with what you can do to it.
 *
 * Plans and workouts get the same row because they get the same three verbs — use it, hand it
 * to someone, get rid of it — and two screens that do the same job should not diverge into two
 * slightly different sets of buttons.
 *
 * The controls are full-width and stacked rather than a cluster of icons. The icon cluster was
 * how the saved-workout list used to work, and an arrow beside a cross beside a Use button is
 * three targets inside a thumb's width: fine with a mouse, a coin toss on a phone, and the one
 * you hit by accident there is the delete.
 */

import { useEffect, useState } from 'react';

/** Long enough to read the button and decide, short enough not to stay armed. */
const DISARM_MS = 6000;

export default function LibraryRow({
  name,
  subtitle,
  detail,
  onShare,
  onEdit,
  onDelete,
}: {
  name: string;
  subtitle: string;
  /** A second line — what is in it — when there is something worth saying. */
  detail?: string;
  onShare: () => void | Promise<void>;
  /** Only plans are editable; a saved workout is a snapshot of a session you did. */
  onEdit?: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), DISARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div className="card tight">
      <div className="grow">
        <strong>{name}</strong>
        <div className="tiny faint">{subtitle}</div>
      </div>

      {detail && (
        <div className="tiny faint" style={{ marginTop: '0.35rem' }}>
          {detail}
        </div>
      )}

      <div className="row" style={{ gap: '0.5rem', marginTop: '0.6rem' }}>
        <button className="btn sm grow" onClick={() => void onShare()}>
          ↗ Export / Share
        </button>
        {onEdit && (
          <button className="btn sm grow" onClick={onEdit}>
            ✎ Edit
          </button>
        )}
      </div>

      {/*
        Deleting asks twice rather than opening a sheet. The button changes what it says and
        disarms itself, so a stray tap cannot sit there waiting to be completed later.
      */}
      <button
        className={`btn sm ghost danger block${armed ? ' on' : ''}`}
        style={{ marginTop: '0.4rem' }}
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          void onDelete();
          setArmed(false);
        }}
      >
        {armed ? `Delete “${name}”?` : 'Delete'}
      </button>
    </div>
  );
}

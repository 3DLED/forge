/**
 * One saved workout in a list: use it, or get rid of it.
 *
 * Deleting asks twice rather than opening a confirmation sheet. These rows already live
 * inside a sheet, and a sheet on top of a sheet is both awkward to render and a lot of
 * ceremony for removing a workout you saved by accident. The second tap has to be deliberate:
 * the button changes what it says, and it disarms itself after a few seconds so a stray tap
 * cannot sit there waiting to be completed later.
 */

import { useEffect, useState } from 'react';
import type { SessionTemplate } from '../../domain/types';

/** Long enough to read the button and decide; short enough not to stay armed. */
const DISARM_MS = 6000;

export default function SavedWorkoutRow({
  template,
  subtitle,
  onUse,
  onShare,
  onDelete,
}: {
  template: SessionTemplate;
  subtitle: string;
  onUse: () => void | Promise<void>;
  /**
   * Offered where you are browsing your own library, and left off where you are picking a
   * workout to run — mid-session is not the moment to be handing files to people.
   */
  onShare?: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), DISARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div className="suggest-row">
      <span className="grow">
        <strong>{template.name}</strong>
        <br />
        <span className="tiny faint">{subtitle}</span>
      </span>

      <button className="btn sm" onClick={() => void onUse()}>
        Use
      </button>

      {onShare && (
        <button
          className="btn ghost sm"
          aria-label={`Share ${template.name}`}
          onClick={() => void onShare()}
        >
          ↗
        </button>
      )}

      <button
        className={`btn ghost sm danger${armed ? ' on' : ''}`}
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          void onDelete();
        }}
      >
        {armed ? 'Delete?' : '✕'}
      </button>
    </div>
  );
}

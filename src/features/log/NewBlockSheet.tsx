/**
 * Choosing the shape of a timed block.
 *
 * Used for both "add a block" and "turn this whole workout into one" — the settings are
 * identical, only the copy differs, so the two paths share this rather than drifting apart.
 */

import { useState } from 'react';
import Sheet from '../../ui/Sheet';
import { formatClock } from '../../domain/units';
import type { LoggedBlock, LoggedBlockStyle } from '../../domain/types';

const STYLES: { value: LoggedBlockStyle; label: string; blurb: string }[] = [
  {
    value: 'amrap',
    label: 'AMRAP',
    blurb: 'As many rounds as possible before the cap. Tap a big button for each round.',
  },
  {
    value: 'emom',
    label: 'EMOM',
    blurb: 'Every minute on the minute — a cue at each interval, for a set number of rounds.',
  },
  {
    value: 'forTime',
    label: 'For time',
    blurb: 'Fixed work, clock running. The score is how long it took.',
  },
];

export default function NewBlockSheet({
  title,
  confirmLabel,
  message,
  onCreate,
  onClose,
}: {
  title: string;
  confirmLabel: string;
  message?: string;
  onCreate: (block: Omit<LoggedBlock, 'id'>) => void | Promise<void>;
  onClose: () => void;
}) {
  const [style, setStyle] = useState<LoggedBlockStyle>('amrap');
  const [capMin, setCapMin] = useState(12);
  const [intervalSec, setIntervalSec] = useState(60);
  const [targetRounds, setTargetRounds] = useState(10);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    await onCreate({
      style,
      capSec: style === 'amrap' || style === 'forTime' ? capMin * 60 : undefined,
      intervalSec: style === 'emom' ? intervalSec : undefined,
      targetRounds: style === 'emom' ? targetRounds : undefined,
    });
  };

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <button className="btn primary block" disabled={saving} onClick={() => void create()}>
          {saving ? 'Adding…' : confirmLabel}
        </button>
      }
    >
      {message && <p className="small muted">{message}</p>}

      <div className="chip-row">
        {STYLES.map((option) => (
          <button
            key={option.value}
            className={`chip${style === option.value ? ' on' : ''}`}
            onClick={() => setStyle(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        {STYLES.find((s) => s.value === style)?.blurb}
      </p>

      {(style === 'amrap' || style === 'forTime') && (
        <>
          <div className="section-title">{style === 'amrap' ? 'Time cap' : 'Cap (safety net)'}</div>
          <div className="chip-row">
            {[6, 8, 10, 12, 15, 20, 30, 45].map((minutes) => (
              <button
                key={minutes}
                className={`chip${capMin === minutes ? ' on' : ''}`}
                onClick={() => setCapMin(minutes)}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </>
      )}

      {style === 'emom' && (
        <>
          <div className="section-title">Interval</div>
          <div className="chip-row">
            {[30, 45, 60, 90, 120].map((seconds) => (
              <button
                key={seconds}
                className={`chip${intervalSec === seconds ? ' on' : ''}`}
                onClick={() => setIntervalSec(seconds)}
              >
                {seconds < 60 ? `${seconds}s` : formatClock(seconds)}
              </button>
            ))}
          </div>

          <div className="section-title">Rounds</div>
          <div className="chip-row">
            {[5, 8, 10, 12, 15, 20, 30].map((count) => (
              <button
                key={count}
                className={`chip${targetRounds === count ? ' on' : ''}`}
                onClick={() => setTargetRounds(count)}
              >
                {count}
              </button>
            ))}
          </div>
          <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
            {formatClock(intervalSec * targetRounds)} total.
          </p>
        </>
      )}
    </Sheet>
  );
}

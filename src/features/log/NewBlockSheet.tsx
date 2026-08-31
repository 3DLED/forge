/**
 * Choosing the shape of a timed block.
 *
 * Used for "add a block", "turn this whole workout into one", and "change the shape of the
 * one I already have" — the settings are identical in all three, only the copy differs, so
 * they share this rather than drifting apart.
 */

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import { formatClock } from '../../domain/units';
import { deleteSavedWorkout, isTimedWorkout, savedWorkouts } from '../../data/namedWorkouts';
import SavedWorkoutRow from './SavedWorkoutRow';
import { plural } from '../../ui/text';
import type { LoggedBlock, LoggedBlockStyle, SessionTemplate } from '../../domain/types';

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
  onPickSaved,
  initial,
  onClose,
}: {
  title: string;
  confirmLabel: string;
  message?: string;
  onCreate: (block: Omit<LoggedBlock, 'id'>) => void | Promise<void>;
  /** Offered only when creating a fresh block, not when converting an existing workout. */
  onPickSaved?: (template: SessionTemplate) => void | Promise<void>;
  /** The block being edited, so the controls open on what it already is. */
  initial?: Pick<LoggedBlock, 'style' | 'capSec' | 'intervalSec' | 'targetRounds'>;
  onClose: () => void;
}) {
  // Timed only. A saved straight session has no clock and no rounds; offered here it would
  // come back wearing an AMRAP's timer.
  const saved = useLiveQuery(
    async () => (onPickSaved ? (await savedWorkouts()).filter(isTimedWorkout) : []),
    [Boolean(onPickSaved)],
  );
  const [style, setStyle] = useState<LoggedBlockStyle>(initial?.style ?? 'amrap');
  const [capMin, setCapMin] = useState(initial?.capSec ? Math.round(initial.capSec / 60) : 12);
  const [intervalSec, setIntervalSec] = useState(initial?.intervalSec ?? 60);
  const [targetRounds, setTargetRounds] = useState(initial?.targetRounds ?? 10);
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

      {/* Repeating a workout you have already named is the common case, so it comes first. */}
      {onPickSaved && (saved?.length ?? 0) > 0 && (
        <>
          <div className="section-title">Your saved timed workouts</div>
          {saved!.map((template) => (
            <SavedWorkoutRow
              key={template.id}
              template={template}
              subtitle={`${plural(template.blocks[0]?.items.length ?? 0, 'movement')} · run it again`}
              onUse={() => onPickSaved(template)}
              onDelete={() => deleteSavedWorkout(template.id)}
            />
          ))}
          <div className="section-title">Or build a new one</div>
        </>
      )}

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

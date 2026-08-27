/**
 * "Give me an upper body session with what I've got."
 *
 * The suggestion is a *draft*, always. It is shown in full, every movement can be swapped or
 * dropped, and nothing reaches the session until the button at the bottom is pressed. A
 * generator that writes straight into your log is one you stop trusting the first time it
 * picks something you cannot do.
 *
 * Re-running on every control change is deliberate: the settings and the result read as one
 * thing, so you can see what "build strength" actually does to the sets and reps rather than
 * having to commit to find out.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import { useApp } from '../../ui/AppProvider';
import { exerciseUsage } from '../../data/sessions';
import { formatClock } from '../../domain/units';
import { plural } from '../../ui/text';
import {
  GOAL_ORDER,
  GOAL_SCHEMES,
  suggestWorkout,
  type SuggestedItem,
  type TrainingGoal,
} from '../../domain/generator';
import { BUILDABLE_REGIONS, REGION_LABELS, type BodyRegion } from '../../domain/regions';

const MINUTE_OPTIONS = [20, 30, 45, 60];

export default function SuggestWorkoutSheet({
  available,
  existingSlugs,
  onAdd,
  onClose,
}: {
  /** Movements performable with this session's equipment. */
  available: Set<string>;
  /** Already in the workout — never suggested twice. */
  existingSlugs: Set<string>;
  onAdd: (items: SuggestedItem[]) => void | Promise<void>;
  onClose: () => void;
}) {
  const { exercises } = useApp();
  const usage = useLiveQuery(() => exerciseUsage(), [], undefined);

  const [regions, setRegions] = useState<BodyRegion[]>(['upper']);
  const [goal, setGoal] = useState<TrainingGoal>('muscle');
  const [minutes, setMinutes] = useState(45);
  const [variant, setVariant] = useState(0);

  /** Per-movement swap offsets, keyed by pattern, reset whenever the inputs change. */
  const [swaps, setSwaps] = useState<Record<string, number>>({});
  const [dropped, setDropped] = useState<string[]>([]);

  useEffect(() => {
    setSwaps({});
    setDropped([]);
  }, [regions, goal, minutes, variant]);

  const suggestion = useMemo(
    () =>
      suggestWorkout({
        regions,
        goal,
        minutes,
        exercises,
        available,
        usage,
        exclude: existingSlugs,
        variant,
      }),
    [regions, goal, minutes, exercises, available, usage, existingSlugs, variant],
  );

  /** The proposal after the athlete's own swaps and removals. */
  const items = useMemo(() => {
    return suggestion.items
      .filter((item) => !dropped.includes(item.pattern))
      .map((item) => {
        const offset = swaps[item.pattern] ?? 0;
        if (offset === 0 || item.alternatives.length === 0) return item;
        const pool = [item.exercise, ...item.alternatives];
        return { ...item, exercise: pool[offset % pool.length] };
      });
  }, [suggestion, swaps, dropped]);

  const totalMinutes = useMemo(
    () =>
      Math.round(
        items.reduce((sum, item) => {
          const work = item.values.timeSec ?? (item.values.reps ?? 10) * 3;
          return sum + (item.sets * work + (item.sets - 1) * item.restSec) / 60;
        }, 0),
      ),
    [items],
  );

  const toggleRegion = (region: BodyRegion) => {
    setRegions((current) => {
      if (!current.includes(region)) return [...current, region];
      // Turning off the last one would leave nothing to generate from, so it stays on.
      const next = current.filter((r) => r !== region);
      return next.length > 0 ? next : current;
    });
  };

  const scheme = GOAL_SCHEMES[goal];
  const allSelected = BUILDABLE_REGIONS.every((r) => regions.includes(r));

  return (
    <Sheet
      title="Suggest a workout"
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          disabled={items.length === 0}
          onClick={() => void onAdd(items)}
        >
          {items.length === 0
            ? 'Nothing to add'
            : `Add ${plural(items.length, 'movement')} to workout`}
        </button>
      }
    >
      <div className="section-title">Train</div>
      <div className="chip-row">
        {BUILDABLE_REGIONS.map((region) => (
          <button
            key={region}
            className={`chip${regions.includes(region) ? ' on' : ''}`}
            onClick={() => toggleRegion(region)}
          >
            {REGION_LABELS[region]}
          </button>
        ))}
        <button
          className={`chip${allSelected ? ' on' : ''}`}
          onClick={() => setRegions(allSelected ? ['upper'] : [...BUILDABLE_REGIONS])}
        >
          Full body
        </button>
      </div>

      <div className="section-title">Goal</div>
      <div className="chip-row">
        {GOAL_ORDER.map((option) => (
          <button
            key={option}
            className={`chip${goal === option ? ' on' : ''}`}
            onClick={() => setGoal(option)}
          >
            {GOAL_SCHEMES[option].label}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        {scheme.blurb} · {scheme.sets} sets of {scheme.reps[0]}–{scheme.reps[1]} · RPE{' '}
        {scheme.rpe} · rest {formatClock(scheme.restSec)}
      </p>

      <div className="section-title">Time</div>
      <div className="chip-row">
        {MINUTE_OPTIONS.map((option) => (
          <button
            key={option}
            className={`chip${minutes === option ? ' on' : ''}`}
            onClick={() => setMinutes(option)}
          >
            {option} min
          </button>
        ))}
      </div>

      <div className="section-title">
        {items.length > 0 ? `The session · about ${totalMinutes} min` : 'The session'}
      </div>

      {items.length === 0 && (
        <div className="empty">
          <span className="glyph">🤷</span>
          <p className="small">Nothing available for that combination.</p>
          <p className="tiny faint">Try another region, or add equipment for this session.</p>
        </div>
      )}

      {items.map((item) => (
        <div className="suggest-row" key={item.pattern}>
          <span className="grow">
            <strong>{item.exercise.name}</strong>
            <br />
            <span className="tiny faint">
              {item.sets} × {item.target} · rest {formatClock(item.restSec)} · RPE {scheme.rpe}
            </span>
          </span>
          <button
            className="btn ghost sm"
            disabled={item.alternatives.length === 0}
            title="Swap for another movement in this pattern"
            onClick={() =>
              setSwaps((current) => ({
                ...current,
                [item.pattern]: (current[item.pattern] ?? 0) + 1,
              }))
            }
          >
            Swap
          </button>
          <button
            className="btn ghost sm danger"
            title="Drop this movement"
            onClick={() => setDropped((current) => [...current, item.pattern])}
          >
            ✕
          </button>
        </div>
      ))}

      {suggestion.notes.map((note) => (
        <p className="tiny faint" key={note} style={{ marginTop: '0.5rem' }}>
          {note}
        </p>
      ))}

      {items.length > 0 && (
        <button
          className="btn block"
          style={{ marginTop: '0.75rem' }}
          onClick={() => setVariant((v) => v + 1)}
        >
          🎲 Suggest something else
        </button>
      )}
    </Sheet>
  );
}

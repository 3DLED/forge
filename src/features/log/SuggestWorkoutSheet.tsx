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
import { deleteSavedWorkout, isTimedWorkout, savedWorkouts } from '../../data/namedWorkouts';
import SavedWorkoutRow from './SavedWorkoutRow';
import VariationSheet from './VariationSheet';
import { formatClock } from '../../domain/units';
import { plural } from '../../ui/text';
import {
  GOAL_SCHEMES,
  suggestWorkout,
  type SuggestedItem,
} from '../../domain/generator';
import { BUILDABLE_REGIONS, REGION_LABELS, type BodyRegion } from '../../domain/regions';
import {
  PRIMARY_GOALS,
  PRIMARY_GOAL_ORDER,
  conditioningMinutesFor,
} from '../../domain/goals';
import type { PrimaryGoal } from '../../domain/goals';
import type { SuggestSpec } from '../../domain/types';
import type { Exercise, SessionTemplate } from '../../domain/types';

const MINUTE_OPTIONS = [20, 30, 45, 60];

export default function SuggestWorkoutSheet({
  available,
  existingSlugs,
  opening,
  onAdd,
  onUseSaved,
  onClose,
}: {
  /** Movements performable with this session's equipment. */
  available: Set<string>;
  /** Already in the workout — never suggested twice. */
  existingSlugs: Set<string>;
  /**
   * What the plan asked for, when this day was laid out as "decide on the day".
   *
   * A starting point rather than a constraint: the chips still change it. The plan said what
   * it wanted eight weeks ago, and you are the one standing here now.
   */
  opening?: SuggestSpec;
  /**
   * Hand the draft to the session. `timed` asks for it to land as one timed block —
   * an AMRAP, an EMOM, or a for-time piece — rather than as straight sets.
   */
  onAdd: (items: SuggestedItem[], timed?: boolean) => void | Promise<void>;
  /** Re-run a session saved earlier, instead of generating a new one. */
  onUseSaved: (template: SessionTemplate) => void | Promise<void>;
  onClose: () => void;
}) {
  const { exercises, profile } = useApp();
  const usage = useLiveQuery(() => exerciseUsage(), [], undefined);

  // Straight sessions only — timed pieces are added as blocks, from "Add block".
  const saved = useLiveQuery(
    async () => (await savedWorkouts()).filter((t) => !isTimedWorkout(t)),
    [],
  );

  const [regions, setRegions] = useState<BodyRegion[]>(opening?.regions ?? ['upper']);
  /*
   * Opens on whatever you are training for rather than on hypertrophy, which is what it
   * assumed for everyone. Still a starting point: the chips below change it for this workout
   * without touching the standing answer.
   */
  const [goal, setGoal] = useState<PrimaryGoal>(() => profile.primaryGoal ?? 'general');
  const [minutes, setMinutes] = useState(opening?.minutes ?? 45);
  const [variant, setVariant] = useState(0);

  /** Deliberate replacements, keyed by pattern. Reset whenever the inputs change. */
  const [swaps, setSwaps] = useState<Record<string, Exercise>>({});
  /** The row whose ladder is open. */
  const [swapping, setSwapping] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);

  useEffect(() => {
    setSwaps({});
    setDropped([]);
  }, [regions, goal, minutes, variant]);

  const spec = PRIMARY_GOALS[goal];

  const suggestion = useMemo(
    () =>
      suggestWorkout({
        regions,
        goal: spec.lifting,
        conditioningMin: conditioningMinutesFor(goal),
        minutes,
        exercises,
        available,
        usage,
        exclude: existingSlugs,
        variant,
      }),
    [regions, goal, spec.lifting, minutes, exercises, available, usage, existingSlugs, variant],
  );

  /** The proposal after the athlete's own swaps and removals. */
  const items = useMemo(() => {
    return suggestion.items
      .filter((item) => !dropped.includes(item.pattern))
      .map((item) => {
        const replacement = swaps[item.pattern];
        return replacement ? { ...item, exercise: replacement } : item;
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

  const scheme = GOAL_SCHEMES[spec.lifting];
  const allSelected = BUILDABLE_REGIONS.every((r) => regions.includes(r));

  return (
    <Sheet
      title="Suggest a workout"
      onClose={onClose}
      footer={
        <>
          <button
            className="btn primary block"
            disabled={items.length === 0}
            onClick={() => void onAdd(items)}
          >
            {items.length === 0
              ? 'Nothing to add'
              : `Add ${plural(items.length, 'movement')} to workout`}
          </button>

          {/*
            The same movements, scored on a clock instead of ticked off set by set. Offered
            here rather than only after the fact because "today is a twenty-minute AMRAP" is
            a decision you make before you start, not one you reach for once the sets are
            already sitting in the log.
          */}
          {items.length > 0 && (
            <button
              className="btn block"
              style={{ marginTop: '0.5rem' }}
              onClick={() => void onAdd(items, true)}
            >
              ⏱ Add as a timed workout
            </button>
          )}
        </>
      }
    >
      {/* A session you already decided was good beats one generated fresh, so it goes first. */}
      {(saved?.length ?? 0) > 0 && (
        <>
          <div className="section-title">Your saved sessions</div>
          {saved!.map((template) => (
            <SavedWorkoutRow
              key={template.id}
              template={template}
              subtitle={
                plural(template.blocks[0]?.items.length ?? 0, 'movement') +
                (template.estimatedMinutes ? ` · about ${template.estimatedMinutes} min` : '')
              }
              onUse={() => onUseSaved(template)}
              onDelete={() => deleteSavedWorkout(template.id)}
            />
          ))}
          <div className="section-title">Or build a new one</div>
        </>
      )}

      <div className="section-title">Train</div>
      {/* Wrapped for the same reason as the goals: "Full body" was off the right edge. */}
      <div className="row wrap" style={{ gap: '0.4rem' }}>
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

      {/*
        The same five the profile asks for, not the three rep schemes underneath them. Those
        were an implementation detail leaking through a label: Settings offered five goals and
        this offered three differently-named ones, and no screen said how they related.

        Wrapped rather than scrolled — a row you have to drag sideways hides the two options
        at the end, which happened to be the two that were missing here in the first place.
      */}
      <div className="section-title">Goal</div>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {PRIMARY_GOAL_ORDER.map((option) => (
          <button
            key={option}
            className={`chip${goal === option ? ' on' : ''}`}
            aria-pressed={goal === option}
            onClick={() => setGoal(option)}
          >
            {PRIMARY_GOALS[option].short}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        {spec.blurb} · {scheme.sets} sets of {scheme.reps[0]}–{scheme.reps[1]} · effort{' '}
        {scheme.rpe} · rest {formatClock(scheme.restSec)}
        {conditioningMinutesFor(goal) > 0 &&
          `, then ${conditioningMinutesFor(goal)} min of conditioning`}
      </p>
      {/* Said where the choice is made, because heavy triples under "lose fat" look wrong. */}
      {spec.note && (
        <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
          {spec.note}
        </p>
      )}

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
              {item.sets} × {item.target} · rest {formatClock(item.restSec)} · effort {scheme.rpe}
            </span>
          </span>
          <button
            className="btn ghost sm"
            title="Swap for an easier or harder version"
            onClick={() => setSwapping(item.pattern)}
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

      {swapping && (() => {
        const target = items.find((item) => item.pattern === swapping);
        if (!target) return null;
        return (
          <VariationSheet
            exercise={target.exercise}
            available={available}
            onClose={() => setSwapping(null)}
            onPick={(next) => {
              setSwaps((current) => ({ ...current, [swapping]: next }));
              setSwapping(null);
            }}
          />
        );
      })()}
    </Sheet>
  );
}

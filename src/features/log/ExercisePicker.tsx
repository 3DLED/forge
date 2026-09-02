/**
 * Movement picker.
 *
 * Ordering, in priority: what you actually train, then the staples, then everything else
 * alphabetically. A pure alphabetical list buries the bench press between "Bear Crawl" and
 * "Bench Dip", which makes a 230-movement library feel like a filing cabinet.
 *
 * Exercises your equipment does not cover are still listed — dimmed, and annotated with the
 * substitute that would work — rather than hidden. Hiding them makes the library feel broken
 * when you know the movement exists; showing the swap teaches the ladder instead.
 */

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import ExerciseEditorSheet from '../more/ExerciseEditorSheet';
import { useApp } from '../../ui/AppProvider';
import { resolveExercise } from '../../domain/equipment';
import { CATEGORY_LABELS, CATEGORY_ORDER, categoryOf } from '../../domain/categories';
import { exerciseUsage } from '../../data/sessions';
import { CONTAINER_SLUGS } from '../../domain/training';
import type { Exercise } from '../../domain/types';
import type { ExerciseCategory } from '../../domain/categories';

const PATTERN_LABELS: Record<string, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
  lunge: 'Lunge',
  pushHorizontal: 'Push',
  pushVertical: 'Overhead',
  pullHorizontal: 'Row',
  pullVertical: 'Pull-up',
  carry: 'Carry / grip',
  core: 'Core',
  gait: 'Run',
  fullBody: 'Full body',
};

export default function ExercisePicker({
  onPick,
  onClose,
  available: availableOverride,
}: {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
  /** Session-specific equipment, when it differs from the profile default. */
  available?: Set<string>;
}) {
  const app = useApp();
  const available = availableOverride ?? app.available;
  const { exercises, exerciseBySlug } = app;

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');

  const usage = useLiveQuery(() => exerciseUsage(), [], undefined);

  const { used, common, rest, total } = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matches = exercises.filter((exercise) => {
      // AMRAP / EMOM / For Time are containers, not movements — they belong to "Add block".
      if (CONTAINER_SLUGS.has(exercise.slug)) return false;
      if (category !== 'all' && categoryOf(exercise) !== category) return false;
      if (!needle) return true;
      return (
        exercise.name.toLowerCase().includes(needle) ||
        exercise.slug.includes(needle) ||
        exercise.primaryMuscles.some((m) => m.includes(needle)) ||
        (PATTERN_LABELS[exercise.pattern] ?? '').toLowerCase().includes(needle)
      );
    });

    // Things you can do right now come first within every group.
    const byRank = (a: Exercise, b: Exercise) => {
      const usable = Number(available.has(b.slug)) - Number(available.has(a.slug));
      if (usable !== 0) return usable;
      const count = (usage?.get(b.slug) ?? 0) - (usage?.get(a.slug) ?? 0);
      if (count !== 0) return count;
      return a.name.localeCompare(b.name);
    };

    return {
      used: matches.filter((e) => (usage?.get(e.slug) ?? 0) > 0).sort(byRank),
      common: matches.filter((e) => e.common && !(usage?.get(e.slug) ?? 0)).sort(byRank),
      rest: matches.filter((e) => !e.common && !(usage?.get(e.slug) ?? 0)).sort(byRank),
      total: matches.length,
    };
  }, [exercises, query, category, available, usage]);

  const renderRow = (exercise: Exercise) => {
    const usable = available.has(exercise.slug);
    const swap = usable ? null : resolveExercise(exercise.slug, exerciseBySlug, available);
    const swapName = swap ? exerciseBySlug.get(swap.slug)?.name : null;

    return (
      <button
        key={exercise.id}
        className={`pick${usable ? '' : ' unavailable'}`}
        onClick={() => onPick(exercise)}
      >
        <span className="grow">
          <span style={{ fontWeight: 600 }}>{exercise.name}</span>
          <br />
          <span className="tiny faint">
            {PATTERN_LABELS[exercise.pattern] ?? exercise.pattern}
            {exercise.primaryMuscles.length > 0 && ` · ${exercise.primaryMuscles.join(', ')}`}
            {!usable && swapName && ` · try ${swapName} instead`}
            {!usable && !swapName && ' · no equipment for this'}
          </span>
        </span>
        {usable ? <span className="pill accent">Add</span> : <span className="pill">Add anyway</span>}
      </button>
    );
  };

  // While searching, sections get in the way — one ranked list is what you want.
  const searching = query.trim().length > 0;

  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <input
        type="search"
        placeholder="Search movements, muscles, patterns…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />

      <div className="chip-row" style={{ margin: '0.6rem 0 0.75rem' }}>
        <button
          className={`chip${category === 'all' ? ' on' : ''}`}
          onClick={() => setCategory('all')}
        >
          All
        </button>
        {CATEGORY_ORDER.map((value) => (
          <button
            key={value}
            className={`chip${category === value ? ' on' : ''}`}
            onClick={() => setCategory(value)}
          >
            {CATEGORY_LABELS[value]}
          </button>
        ))}
      </div>

      {total === 0 && (
        <div className="empty">
          <span className="glyph">🔍</span>
          <p className="small">No movement matches “{query}”.</p>
          {/*
            Offered exactly where the gap is felt. Searching for something the library does
            not have is the moment you know you need it, and sending you to Settings to add it
            means abandoning the workout you were building.
          */}
          <button className="btn primary block" onClick={() => setCreating(true)}>
            + Add “{query.trim()}” as a movement
          </button>
        </div>
      )}

      {creating && (
        <ExerciseEditorSheet
          onClose={() => setCreating(false)}
          onSaved={(exercise) => {
            setCreating(false);
            onPick(exercise);
          }}
        />
      )}

      {searching ? (
        [...used, ...common, ...rest].map(renderRow)
      ) : (
        <>
          {used.length > 0 && (
            <>
              <div className="section-title">You train these</div>
              {used.map(renderRow)}
            </>
          )}

          {/*
            Grouped by category when nothing is filtered. Seventy-odd staples in one
            alphabetical run still buries the bench press behind Cat-Cow, which is the
            problem this section exists to solve.
          */}
          {common.length > 0 && category === 'all' && (
            <>
              {CATEGORY_ORDER.map((group) => {
                const inGroup = common.filter((e) => categoryOf(e) === group);
                if (inGroup.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="section-title">Common · {CATEGORY_LABELS[group]}</div>
                    {inGroup.map(renderRow)}
                  </div>
                );
              })}
            </>
          )}

          {common.length > 0 && category !== 'all' && (
            <>
              <div className="section-title">Common</div>
              {common.map(renderRow)}
            </>
          )}

          {rest.length > 0 && (
            <>
              <div className="section-title">Everything else</div>
              {rest.map(renderRow)}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

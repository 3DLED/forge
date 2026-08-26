/**
 * Movement picker.
 *
 * Exercises your equipment does not cover are still listed — dimmed, and annotated with the
 * substitute that would work — rather than hidden. Hiding them makes the library feel
 * broken when you know the movement exists; showing the swap teaches the ladder instead.
 */

import { useMemo, useState } from 'react';
import Sheet from '../../ui/Sheet';
import { useApp } from '../../ui/AppProvider';
import { resolveExercise } from '../../domain/equipment';
import type { Exercise, Modality } from '../../domain/types';

const MODALITY_FILTERS: { value: Modality | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'skill', label: 'Skill' },
  { value: 'mobility', label: 'Mobility' },
];

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
}: {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const { exercises, exerciseBySlug, available } = useApp();
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState<Modality | 'all'>('all');

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matches = exercises.filter((exercise) => {
      if (modality !== 'all' && exercise.modality !== modality) return false;
      if (!needle) return true;
      return (
        exercise.name.toLowerCase().includes(needle) ||
        exercise.slug.includes(needle) ||
        exercise.primaryMuscles.some((m) => m.includes(needle)) ||
        (PATTERN_LABELS[exercise.pattern] ?? '').toLowerCase().includes(needle)
      );
    });

    // Things you can do right now come first; the rest stay visible below them.
    return matches.sort((a, b) => {
      const usable = Number(available.has(b.slug)) - Number(available.has(a.slug));
      return usable !== 0 ? usable : a.name.localeCompare(b.name);
    });
  }, [exercises, query, modality, available]);

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
        {MODALITY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            className={`chip${modality === filter.value ? ' on' : ''}`}
            onClick={() => setModality(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {results.length === 0 && (
        <div className="empty">
          <span className="glyph">🔍</span>
          <p className="small">No movement matches “{query}”.</p>
        </div>
      )}

      {results.map((exercise) => {
        const usable = available.has(exercise.slug);
        const swap = usable
          ? null
          : resolveExercise(exercise.slug, exerciseBySlug, available);
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
            {usable ? (
              <span className="pill accent">Add</span>
            ) : (
              <span className="pill">Add anyway</span>
            )}
          </button>
        );
      })}
    </Sheet>
  );
}

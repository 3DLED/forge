/**
 * What a movement is and how to do it.
 *
 * Reached by tapping the movement's name — everywhere it appears, so the gesture is worth
 * learning once. The point is that nobody should have to leave the app mid-set to look up
 * what a Cossack squat is.
 *
 * Ordered the way it gets used standing in front of the equipment: what to do first, then the
 * cues in the order they happen, then the mistake to watch for. Muscles and difficulty come
 * last — useful context, but not what you opened this for.
 */

import Sheet from '../../ui/Sheet';
import { coachingOf } from '../../domain/coaching';
import { BAND_LABELS, bandOf, levelOf, levelPips } from '../../domain/difficulty';
import { CATEGORY_LABELS, categoryOf } from '../../domain/categories';
import { plural } from '../../ui/text';
import type { Exercise } from '../../domain/types';

export default function ExerciseInfoSheet({
  exercise,
  onSwap,
  onClose,
}: {
  exercise: Exercise;
  /** Offered when there is somewhere to swap to — the logger, not the library. */
  onSwap?: () => void;
  onClose: () => void;
}) {
  const coaching = coachingOf(exercise);
  const level = levelOf(exercise);

  return (
    <Sheet
      title={exercise.name}
      onClose={onClose}
      footer={
        onSwap && (
          <button className="btn block" onClick={onSwap}>
            Swap for another version
          </button>
        )
      }
    >
      <p className="small muted">
        {CATEGORY_LABELS[categoryOf(exercise)]} · {BAND_LABELS[bandOf(level)]}{' '}
        <span className="pips">{levelPips(level)}</span>
      </p>

      {coaching ? (
        <>
          <div className="section-title">Set up</div>
          <p className="small">{coaching.setup}</p>

          <div className="section-title">How to do it</div>
          <ol className="cue-list">
            {coaching.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ol>

          <div className="section-title">Watch for</div>
          <p className="small">{coaching.fault}</p>
        </>
      ) : (
        <p className="small faint">
          No write-up for this one yet — it is likely a movement you added yourself.
        </p>
      )}

      {exercise.notes && (
        <>
          <div className="section-title">Note</div>
          <p className="small faint">{exercise.notes}</p>
        </>
      )}

      <div className="section-title">Trains</div>
      <p className="small">
        {exercise.primaryMuscles.join(', ')}
        {exercise.secondaryMuscles.length > 0 && (
          <span className="faint"> · also {exercise.secondaryMuscles.join(', ')}</span>
        )}
      </p>

      {exercise.equipment.length > 0 && (
        <>
          <div className="section-title">Needs</div>
          <p className="small">{exercise.equipment.join(', ')}</p>
        </>
      )}

      {exercise.unilateral && (
        <p className="tiny faint" style={{ marginTop: '0.5rem' }}>
          Trained one side at a time — log both sides, or double the sets.
        </p>
      )}

      {exercise.substitutes.length > 0 && (
        <p className="tiny faint" style={{ marginTop: '0.5rem' }}>
          {plural(exercise.substitutes.length, 'stand-in')} if your equipment changes.
        </p>
      )}
    </Sheet>
  );
}

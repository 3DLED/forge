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
import { exerciseMediaUrl } from '../../data/exerciseMedia';
import { coachingOf } from '../../domain/coaching';
import { BAND_LABELS, bandOf, levelOf, levelPips } from '../../domain/difficulty';
import { CATEGORY_LABELS, categoryOf } from '../../domain/categories';
import { plural } from '../../ui/text';
import type { Exercise } from '../../domain/types';
import { useT } from '../../i18n/useT';
import { useApp } from '../../ui/AppProvider';
import { muscle } from '../../i18n/copy';

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
  const t = useT();
  const { lang } = useApp();
  const coaching = coachingOf(exercise);
  const level = levelOf(exercise);
  const media = exerciseMediaUrl(exercise.slug);

  return (
    <Sheet
      title={exercise.name}
      onClose={onClose}
      footer={
        onSwap && (
          <button className="btn block" onClick={onSwap}>
            {t('Swap for another version')}
          </button>
        )
      }
    >
      {/*
        Above the words, because it answers the question faster than they do.
        
        Absent for most movements and that has to look deliberate rather than broken, so
        nothing is reserved for it — no grey box, no spinner, no "image unavailable". The
        sheet simply starts at the text, exactly as it did before there were pictures.
      */}
      {media && (
        <img
          className="exercise-media"
          src={media}
          alt={`${exercise.name} demonstrated`}
          loading="lazy"
          decoding="async"
          width={180}
          height={180}
        />
      )}

      <p className="small muted">
        {t(CATEGORY_LABELS[categoryOf(exercise)])} · {t(BAND_LABELS[bandOf(level)])}{' '}
        <span className="pips">{levelPips(level)}</span>
      </p>

      {/*
        What the movement is, above how to do it.
        
        Only the imported library carries one — the curated write-ups open with a setup cue
        instead, which does the same job for a movement whose name already tells you what it
        is. This is for the long tail, where the name often does not.
      */}
      {exercise.description && <p className="small">{exercise.description}</p>}

      {coaching ? (
        <>
          <div className="section-title">{t('Set up')}</div>
          <p className="small">{coaching.setup}</p>

          <div className="section-title">{t('How to do it')}</div>
          <ol className="cue-list">
            {coaching.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ol>

          {/*
            Omitted rather than left blank. The authored write-ups all name the way a movement
            goes wrong; the imported ones have no such field, and inventing one would be
            putting words in somebody's mouth about a lift they have never seen.
          */}
          {coaching.fault && (
            <>
              <div className="section-title">{t('Watch for')}</div>
              <p className="small">{coaching.fault}</p>
            </>
          )}
        </>
      ) : (
        <p className="small faint">
          {t('No write-up for this one yet — it is likely a movement you added yourself.')}
        </p>
      )}

      {exercise.notes && (
        <>
          <div className="section-title">{t('Note')}</div>
          <p className="small faint">{exercise.notes}</p>
        </>
      )}

      <div className="section-title">{t('Trains')}</div>
      <p className="small">
        {exercise.primaryMuscles.map((m) => muscle(m, lang)).join(', ')}
        {exercise.secondaryMuscles.length > 0 && (
          <span className="faint">
            {' · '}
            {t('also')} {exercise.secondaryMuscles.map((m) => muscle(m, lang)).join(', ')}
          </span>
        )}
      </p>

      {exercise.equipment.length > 0 && (
        <>
          <div className="section-title">{t('Needs')}</div>
          <p className="small">{exercise.equipment.join(', ')}</p>
        </>
      )}

      {exercise.unilateral && (
        <p className="tiny faint" style={{ marginTop: '0.5rem' }}>
          {t('Trained one side at a time — log both sides, or double the sets.')}
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

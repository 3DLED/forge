/**
 * The movement library, browsable.
 *
 * Until now it could only be reached through a picker in the middle of logging, which is fine
 * for "what goes here" and useless for "what does this app actually know". Yours come first,
 * because they are the ones you might want to change.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../ui/PageHeader';
import AskSheet from '../../ui/AskSheet';
import ExerciseEditorSheet from './ExerciseEditorSheet';
import ExerciseInfoSheet from '../log/ExerciseInfoSheet';
import { useApp } from '../../ui/AppProvider';
import { exerciseRepo } from '../../data/repos';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  categoryOf,
  type ExerciseCategory,
} from '../../domain/categories';
import { CONTAINER_SLUGS } from '../../domain/training';
import type { Exercise } from '../../domain/types';
import { useT } from '../../i18n/useT';

/** As in the picker: about three screens of browsing, then the search box takes over. */
const BROWSE_LIMIT = 60;

export default function ExerciseLibraryView() {
  const t = useT();
  const { exercises } = useApp();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [adding, setAdding] = useState(false);
  const [showing, setShowing] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState<Exercise | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');

  const { mine, seeded } = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = exercises
      // The AMRAP/EMOM placeholders are not movements; they were never meant to be browsed.
      .filter((exercise) => !CONTAINER_SLUGS.has(exercise.slug))
      .filter((exercise) => category === 'all' || categoryOf(exercise) === category)
      .filter((exercise) => !term || exercise.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      mine: matches.filter((exercise) => exercise.isCustom),
      seeded: matches.filter((exercise) => !exercise.isCustom),
    };
  }, [exercises, category, query]);

  /**
   * How many movements sit in each category, before the search box narrows anything.
   *
   * Browsing is the point of this screen — "what does this app actually know about pulling"
   * — and a filter that does not say how much is behind it is a filter you have to tap to
   * find out. The counts come from the whole library so they stay put while you type.
   */
  const countByCategory = useMemo(() => {
    const counts = new Map<ExerciseCategory, number>();
    for (const exercise of exercises) {
      if (CONTAINER_SLUGS.has(exercise.slug)) continue;
      const key = categoryOf(exercise);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [exercises]);

  const row = (exercise: Exercise, editable: boolean) => (
    <div className="card tight" key={exercise.id}>
      <div className="row between">
        <button className="name-link grow truncate" onClick={() => setShowing(exercise)}>
          {exercise.name}
          <span className="info-dot" aria-hidden="true">ⓘ</span>
        </button>
        <span className="tiny faint">{t(CATEGORY_LABELS[categoryOf(exercise)])}</span>
      </div>
      {editable && (
        <div className="row" style={{ gap: '0.5rem', marginTop: '0.4rem' }}>
          <button className="btn sm grow" onClick={() => setEditing(exercise)}>
            {t('Edit')}
          </button>
          <button className="btn sm ghost danger" onClick={() => setDeleting(exercise)}>
            {t('Delete')}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title={t('Movements')}
        subtitle={t.count(mine.length + seeded.length, 'movement')}
        action={<Link to="/more" className="btn ghost sm">{t('Back')}</Link>}
      />

      <input
        value={query}
        placeholder={t('Search movements')}
        aria-label={t('Search movements')}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="chip-row" style={{ margin: '0.6rem 0 0.25rem' }}>
        <button
          className={`chip${category === 'all' ? ' on' : ''}`}
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
        >
          {t('All')}
        </button>
        {CATEGORY_ORDER.filter((value) => (countByCategory.get(value) ?? 0) > 0).map((value) => (
          <button
            key={value}
            className={`chip${category === value ? ' on' : ''}`}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {t(CATEGORY_LABELS[value])} <span className="faint">{countByCategory.get(value)}</span>
          </button>
        ))}
      </div>

      <button
        className="btn primary block"
        style={{ marginTop: '0.5rem' }}
        onClick={() => setAdding(true)}
      >
        + {t('Add a movement')}
      </button>

      {mine.length > 0 && <div className="section-title">{t('Yours')}</div>}
      {mine.map((exercise) => row(exercise, true))}

      {seeded.length > 0 && <div className="section-title">{t('Built in')}</div>}
      {/*
        Capped while browsing. The library is fifteen hundred movements now, and rendering all
        of them cost about half a second every time the search box was cleared — for a list
        nobody reads past the first screen of. A search lifts the cap, because the whole point
        of typing is that the answer is short.
      */}
      {seeded.slice(0, query.trim() ? seeded.length : BROWSE_LIMIT).map((exercise) =>
        row(exercise, false),
      )}
      {!query.trim() && seeded.length > BROWSE_LIMIT && (
        <p className="tiny faint" style={{ marginTop: '0.6rem' }}>
          {t.count(seeded.length - BROWSE_LIMIT, 'more movement')} in this category. Search to
          find them.
        </p>
      )}

      {mine.length + seeded.length === 0 && (
        <div className="empty">
          <span className="glyph">🔍</span>
          <p>
            {query.trim() ? `Nothing matches “${query.trim()}”` : 'Nothing here'}
            {category !== 'all' && ` in ${t(CATEGORY_LABELS[category])}`}.
          </p>
          <p className="small faint">
            {category === 'all'
              ? 'Add it yourself and it behaves like any other movement.'
              : 'Try All, or add it yourself — it behaves like any other movement.'}
          </p>
        </div>
      )}

      {(adding || editing) && (
        <ExerciseEditorSheet
          existing={editing ?? undefined}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}

      {showing && (
        <ExerciseInfoSheet exercise={showing} onClose={() => setShowing(null)} />
      )}

      {deleting && (
        <AskSheet
          title={`Delete ${deleting.name}?`}
          message="Sessions that already used it keep their sets — this only removes it from the library, so it stops being offered."
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await exerciseRepo.remove(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}

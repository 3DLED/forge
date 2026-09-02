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
import { plural } from '../../ui/text';
import { useApp } from '../../ui/AppProvider';
import { exerciseRepo } from '../../data/repos';
import { CATEGORY_LABELS, categoryOf } from '../../domain/categories';
import { CONTAINER_SLUGS } from '../../domain/training';
import type { Exercise } from '../../domain/types';

export default function ExerciseLibraryView() {
  const { exercises } = useApp();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [adding, setAdding] = useState(false);
  const [showing, setShowing] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState<Exercise | null>(null);

  const { mine, seeded } = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = exercises
      // The AMRAP/EMOM placeholders are not movements; they were never meant to be browsed.
      .filter((exercise) => !CONTAINER_SLUGS.has(exercise.slug))
      .filter((exercise) => !term || exercise.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      mine: matches.filter((exercise) => exercise.isCustom),
      seeded: matches.filter((exercise) => !exercise.isCustom),
    };
  }, [exercises, query]);

  const row = (exercise: Exercise, editable: boolean) => (
    <div className="card tight" key={exercise.id}>
      <div className="row between">
        <button className="name-link grow truncate" onClick={() => setShowing(exercise)}>
          {exercise.name}
          <span className="info-dot" aria-hidden="true">ⓘ</span>
        </button>
        <span className="tiny faint">{CATEGORY_LABELS[categoryOf(exercise)]}</span>
      </div>
      {editable && (
        <div className="row" style={{ gap: '0.5rem', marginTop: '0.4rem' }}>
          <button className="btn sm grow" onClick={() => setEditing(exercise)}>
            Edit
          </button>
          <button className="btn sm ghost danger" onClick={() => setDeleting(exercise)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Movements"
        subtitle={`${plural(mine.length + seeded.length, 'movement')}`}
        action={<Link to="/more" className="btn ghost sm">Back</Link>}
      />

      <input
        value={query}
        placeholder="Search movements"
        aria-label="Search movements"
        onChange={(event) => setQuery(event.target.value)}
      />

      <button
        className="btn primary block"
        style={{ marginTop: '0.5rem' }}
        onClick={() => setAdding(true)}
      >
        + Add a movement
      </button>

      {mine.length > 0 && <div className="section-title">Yours</div>}
      {mine.map((exercise) => row(exercise, true))}

      {seeded.length > 0 && <div className="section-title">Built in</div>}
      {seeded.map((exercise) => row(exercise, false))}

      {mine.length + seeded.length === 0 && (
        <div className="empty">
          <span className="glyph">🔍</span>
          <p>Nothing matches “{query}”.</p>
          <p className="small faint">Add it yourself and it behaves like any other movement.</p>
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

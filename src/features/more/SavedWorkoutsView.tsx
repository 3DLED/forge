/**
 * Workouts you have named, kept somewhere you can manage them.
 *
 * The list inside the logger is for one question — which of these am I doing now — so it has
 * one button. Sharing and deleting moved here, where you are not standing in a gym part-way
 * through a session, and where a delete sitting a thumb's width from Use cannot be hit by
 * accident.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import LibraryRow from './LibraryRow';
import ImportSheet from './ImportSheet';
import { plural } from '../../ui/text';
import { useApp } from '../../ui/AppProvider';
import { deleteSavedWorkout, isTimedWorkout, savedWorkouts } from '../../data/namedWorkouts';
import { buildWorkoutFile, downloadShareFile } from '../../data/share';
import { blockShape } from '../log/blockLabels';
import type { SessionTemplate } from '../../domain/types';

export default function SavedWorkoutsView() {
  const { exerciseBySlug } = useApp();
  const saved = useLiveQuery(() => savedWorkouts(), []);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const mine = saved ?? [];

  const share = async (template: SessionTemplate) => {
    const filename = downloadShareFile(await buildWorkoutFile(template));
    setNotice(`Saved ${filename}. Send it to anyone with Forge and they can import it.`);
  };

  /** "AMRAP 12:00" for a timed piece, "4 movements" for a straight one. */
  const describe = (template: SessionTemplate): string => {
    const block = template.blocks[0];
    const movements = plural(block?.items.length ?? 0, 'movement');
    if (!block || !isTimedWorkout(template)) {
      return `${movements}${template.estimatedMinutes ? ` · about ${template.estimatedMinutes} min` : ''}`;
    }
    return `${blockShape({
      id: block.id,
      style: block.style as never,
      capSec: block.capSec,
      intervalSec: block.restSec,
      targetRounds: block.rounds,
    })} · ${movements}`;
  };

  return (
    <>
      <PageHeader
        title="Saved workouts"
        subtitle={mine.length > 0 ? plural(mine.length, 'workout') : 'Name one and it comes back here'}
        action={<Link to="/more" className="btn ghost sm">Back</Link>}
      />

      {notice && (
        <div className="card tight">
          <p className="small" style={{ margin: 0 }}>
            {notice}
          </p>
          <button className="btn sm ghost" style={{ marginTop: '0.4rem' }} onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {mine.map((template) => (
        <LibraryRow
          key={template.id}
          name={template.name}
          subtitle={describe(template)}
          detail={(template.blocks[0]?.items ?? [])
            .map((item) => exerciseBySlug.get(item.exerciseSlug)?.name ?? item.exerciseSlug)
            .join(' · ')}
          onShare={() => void share(template)}
          onDelete={() => deleteSavedWorkout(template.id)}
        />
      ))}

      {mine.length === 0 && (
        <div className="empty">
          <span className="glyph">💾</span>
          <p>Nothing saved yet.</p>
          <p className="small faint">
            Name a workout you have built and it comes back here, ready to run again — and, if
            it is timed, with its own best to beat.
          </p>
        </div>
      )}

      <button className="btn block" style={{ marginTop: '0.5rem' }} onClick={() => setImporting(true)}>
        📥 Import a workout
      </button>

      {importing && (
        <ImportSheet
          expecting="workout"
          onClose={() => setImporting(false)}
          onImported={(message) => {
            setImporting(false);
            setNotice(message);
          }}
        />
      )}
    </>
  );
}

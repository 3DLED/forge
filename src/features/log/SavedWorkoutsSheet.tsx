/**
 * The workouts you have named, in one place.
 *
 * They were only reachable through "Suggest a workout" before, which is the wrong door: the
 * suggester is for when you do not know what to do, and picking a session you built and named
 * yourself is the opposite of that. Saving one and never finding it again is most of the way
 * to not having saved it.
 *
 * Straight sessions and timed pieces are separated because they arrive differently — a timed
 * workout comes back as a block with its clock, a straight one as a list of movements — and
 * because the timed ones are the ones with a score worth chasing.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import SavedWorkoutRow from './SavedWorkoutRow';
import { plural } from '../../ui/text';
import { isTimedWorkout, savedWorkouts, workoutHistory } from '../../data/namedWorkouts';
import { formatClock } from '../../domain/units';
import { formatDayLabel } from '../../domain/dates';
import type { SessionTemplate } from '../../domain/types';

export default function SavedWorkoutsSheet({
  onUse,
  onClose,
}: {
  /** Bring this one into the session. */
  onUse: (template: SessionTemplate) => void | Promise<void>;
  onClose: () => void;
}) {
  const saved = useLiveQuery(() => savedWorkouts(), []);

  const all = saved ?? [];
  const timed = all.filter(isTimedWorkout);
  const straight = all.filter((template) => !isTimedWorkout(template));

  return (
    <Sheet title="Your saved workouts" onClose={onClose}>
      {all.length === 0 && (
        <div className="empty">
          <span className="glyph">💾</span>
          <p>Nothing saved yet.</p>
          <p className="small faint">
            Name a workout you have built and it comes back here, ready to run again — and, if
            it is timed, with its own best to beat.
          </p>
        </div>
      )}

      {timed.length > 0 && <div className="section-title">Timed</div>}
      {timed.map((template) => (
        <TimedRow
          key={template.id}
          template={template}
          onUse={() => void onUse(template)}
        />
      ))}

      {straight.length > 0 && <div className="section-title">Straight sets</div>}
      {straight.map((template) => (
        <SavedWorkoutRow
          key={template.id}
          template={template}
          subtitle={
            plural(template.blocks[0]?.items.length ?? 0, 'movement') +
            (template.estimatedMinutes ? ` · about ${template.estimatedMinutes} min` : '')
          }
          onUse={() => void onUse(template)}
        />
      ))}

      <p className="tiny faint" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
        Share, import or tidy these up in More → Saved workouts.
      </p>
    </Sheet>
  );
}

/**
 * A timed workout, with what it has scored before.
 *
 * The history is the reason to name one at all — a workout compared only against itself is
 * the only comparison a timed piece supports.
 */
function TimedRow({
  template,
  onUse,
}: {
  template: SessionTemplate;
  onUse: () => void;
}) {
  const history = useLiveQuery(() => workoutHistory(template.id, 3), [template.id]);
  const best = (history ?? []).reduce<number>((most, run) => Math.max(most, run.rounds ?? 0), 0);
  const last = history?.[0];

  return (
    <div className="card tight">
      <div className="row between">
        <span className="grow truncate">
          <strong>{template.name}</strong>
        </span>
        {best > 0 && <span className="pill good">{plural(best, 'round')} best</span>}
      </div>

      <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
        {plural(template.blocks[0]?.items.length ?? 0, 'movement')}
        {last
          ? ` · last run ${formatDayLabel(last.date).toLowerCase()}${
              last.timeSec ? ` in ${formatClock(last.timeSec)}` : ''
            }`
          : ' · never run'}
      </div>

      <button className="btn sm primary block" style={{ marginTop: '0.5rem' }} onClick={onUse}>
        Run it again
      </button>
    </div>
  );
}

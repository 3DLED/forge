/**
 * One movement and its sets.
 *
 * Extracted so a timed block can nest exactly the same rows it shows at the top level —
 * inside an AMRAP a movement is still "10 reps of X", just read once per round rather than
 * ticked off. Duplicating this markup for the nested case would guarantee the two drift.
 */

import MetricInput, { metricLabel } from './MetricInput';
import { plural } from '../../ui/text';
import { formatDayLabel } from '../../domain/dates';
import { formatDistance, formatDuration, formatWeight } from '../../domain/units';
import type { Exercise, LoggedSet, MetricKey, UnitSystem } from '../../domain/types';

export interface PreviousPerformance {
  session: { date: string };
  sets: LoggedSet[];
}

export default function ExerciseGroup({
  slug,
  sets,
  exercise,
  units,
  previous,
  /** Inside a timed block: sets are the round's recipe, so per-set controls are hidden. */
  nested = false,
  onSetValue,
  onToggle,
  onRemoveSet,
  onAddSet,
  onRemoveExercise,
}: {
  slug: string;
  sets: LoggedSet[];
  exercise: Exercise | undefined;
  units: UnitSystem;
  previous?: PreviousPerformance | null;
  nested?: boolean;
  onSetValue: (setId: string, metric: MetricKey, value: number | undefined) => void;
  onToggle: (setId: string) => void;
  onRemoveSet: (setId: string) => void;
  onAddSet: (slug: string) => void;
  onRemoveExercise: (slug: string) => void;
}) {
  /*
   * Effort is recorded once for the whole session, not per set.
   *
   * The two are different measurements wearing one name. Per-set RPE is a load-selection
   * tool — "how many reps were left" — and it only pays for itself if you act on it before
   * the next set. Session effort is the Foster scale, and it is what multiplies by duration
   * to give the training load the Progress view is built on. Asking for the first on every
   * row to obtain the second is a tax on every set of every workout.
   *
   * Filtered here rather than removed from the library, so a prescribed effort target still
   * has somewhere to live and old sets keep the values they were logged with.
   */
  const metrics = (exercise?.metrics ?? (['reps', 'rpe'] as MetricKey[])).filter(
    (metric) => metric !== 'rpe',
  );

  return (
    <section className={nested ? 'block-movement' : 'card'}>
      <div className="card-head">
        <div className="grow">
          <h3 className="truncate">{exercise?.name ?? slug}</h3>
          {previous && (
            <div className="tiny faint">
              Last {formatDayLabel(previous.session.date).toLowerCase()}:{' '}
              {summariseSets(previous.sets, metrics, units)}
            </div>
          )}
        </div>
        <button
          className="btn ghost sm"
          aria-label={`Remove ${exercise?.name ?? slug}`}
          onClick={() => onRemoveExercise(slug)}
        >
          ✕
        </button>
      </div>

      <div className="set-row" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
        <span className="set-no" />
        <div className="set-fields">
          {metrics.map((metric) => (
            <span className="field-label" key={metric}>
              {metricLabel(metric, units)}
            </span>
          ))}
        </div>
        {/* Must match .set-check exactly, or the labels drift off their columns. */}
        <span style={{ width: 'var(--check-w)' }} />
      </div>

      {sets.map((set, index) => (
        <div key={set.id}>
          <div className="set-row" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
            <span className="set-no">{nested ? '' : index + 1}</span>
            <div className="set-fields">
              {metrics.map((metric) => (
                <MetricInput
                  key={metric}
                  metric={metric}
                  units={units}
                  value={set.values[metric]}
                  onChange={(value) => onSetValue(set.id, metric, value)}
                />
              ))}
            </div>
            {nested ? (
              <button
                className="set-check"
                aria-label={`Remove ${exercise?.name ?? slug} from this round`}
                onClick={() => onRemoveSet(set.id)}
              >
                ✕
              </button>
            ) : (
              <button
                className={`set-check${set.completed ? ' done' : ''}`}
                aria-label={set.completed ? `Set ${index + 1} done` : `Mark set ${index + 1} done`}
                onClick={() => onToggle(set.id)}
                onDoubleClick={() => onRemoveSet(set.id)}
              >
                ✓
              </button>
            )}
          </div>

          {/*
            What a timed block consisted of, and how the rounds were paced. Both are recorded
            by the timer and were previously invisible once saved.
          */}
          {(set.notes || (set.roundSplitsSec?.length ?? 0) > 1) && (
            <div className="tiny faint" style={{ paddingLeft: '2.15rem', paddingBottom: '0.3rem' }}>
              {set.notes}
              {set.notes && (set.roundSplitsSec?.length ?? 0) > 1 && ' · '}
              {(set.roundSplitsSec?.length ?? 0) > 1 &&
                `avg round ${formatDuration(
                  set.roundSplitsSec![set.roundSplitsSec!.length - 1] / set.roundSplitsSec!.length,
                )}`}
            </div>
          )}
        </div>
      ))}

      {!nested && (
        <div className="row" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
          <button className="btn sm grow" onClick={() => onAddSet(slug)}>
            + Set
          </button>
          {sets.length > 1 && (
            <button className="btn sm ghost" onClick={() => onRemoveSet(sets.at(-1)!.id)}>
              − Set
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function summariseSets(
  sets: LoggedSet[],
  metrics: MetricKey[],
  units: UnitSystem,
): string {
  if (metrics.includes('rounds')) {
    const rounds = sets.reduce((total, s) => total + (s.values.rounds ?? 0), 0);
    const time = sets.reduce((total, s) => total + (s.values.timeSec ?? 0), 0);
    return time > 0
      ? `${plural(rounds, 'round')} in ${formatDuration(time)}`
      : plural(rounds, 'round');
  }

  if (metrics.includes('distanceM')) {
    const distance = sets.reduce((total, s) => total + (s.values.distanceM ?? 0), 0);
    const time = sets.reduce((total, s) => total + (s.values.timeSec ?? 0), 0);
    return [distance > 0 && formatDistance(distance, units), time > 0 && formatDuration(time)]
      .filter(Boolean)
      .join(' in ');
  }

  const weight = sets[0]?.values.weightKg;
  const reps = sets.map((s) => s.values.reps).filter((r): r is number => r != null);
  if (reps.length > 0) {
    const repText = reps.every((r) => r === reps[0]) ? `${reps.length}×${reps[0]}` : reps.join('/');
    return weight ? `${repText} @ ${formatWeight(weight, units)}` : repText;
  }

  const time = sets.reduce((total, s) => total + (s.values.timeSec ?? 0), 0);
  return time > 0 ? `${sets.length}× ${formatDuration(time / sets.length)}` : `${sets.length} sets`;
}

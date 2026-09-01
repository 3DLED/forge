/**
 * One movement and its sets.
 *
 * Extracted so a timed block can nest exactly the same rows it shows at the top level —
 * inside an AMRAP a movement is still "10 reps of X", just read once per round rather than
 * ticked off. Duplicating this markup for the nested case would guarantee the two drift.
 */

import MetricInput, { metricLabel } from './MetricInput';
import { isHold } from '../../domain/generator';
import { plural } from '../../ui/text';
import { useApp } from '../../ui/AppProvider';
import { formatDayLabel } from '../../domain/dates';
import { formatDistance, formatDuration, formatWeight } from '../../domain/units';
import type { Exercise, LoggedSet, MetricKey, UnitSystem } from '../../domain/types';

export interface PreviousPerformance {
  session: { date: string };
  sets: LoggedSet[];
}

export default function ExerciseGroup({
  id,
  slug,
  sets,
  exercise,
  units,
  previous,
  /** Inside a timed block: sets are the round's recipe, so per-set controls are hidden. */
  nested = false,
  /** Reviewing a finished workout: everything is shown, nothing is editable. */
  readOnly = false,
  onSetValue,
  onToggle,
  onRemoveSet,
  onAddSet,
  onRemoveExercise,
  onSwapExercise,
  onShowInfo,
  onStartHold,
  warnings = [],
}: {
  /** Anchor for the rest panel's jump-to-next. */
  id?: string;
  slug: string;
  sets: LoggedSet[];
  exercise: Exercise | undefined;
  units: UnitSystem;
  previous?: PreviousPerformance | null;
  nested?: boolean;
  readOnly?: boolean;
  onSetValue: (setId: string, metric: MetricKey, value: number | undefined) => void;
  onToggle: (setId: string) => void;
  onRemoveSet: (setId: string) => void;
  onAddSet: (slug: string) => void;
  onRemoveExercise: (slug: string) => void;
  /** Open the difficulty ladder for this movement. */
  onSwapExercise: (slug: string) => void;
  /** Open the write-up: setup, cues, and the common fault. */
  onShowInfo: (slug: string) => void;
  /** Start a count-up clock for a hold. Absent where holds cannot be timed. */
  onStartHold?: (setId: string) => void;
  /** Current injuries this movement runs into. Flagged, never enforced. */
  warnings?: string[];
}) {
  /*
   * Effort is recorded once for the whole session unless asked for per set.
   *
   * The two are different measurements wearing one name. Per-set RPE is a load-selection
   * tool — "how many reps were left" — and it only pays for itself if you act on it before
   * the next set. Session effort is the Foster scale, and it is what multiplies by duration
   * to give the training load the Progress view is built on. Charging every set of every
   * workout for the first in order to get the second is the wrong default, so it is opt-in
   * under Settings.
   *
   * Filtered at render rather than removed from the library, so flipping the setting back on
   * reveals values already logged instead of having thrown them away.
   */
  const { perSetEffort } = useApp().profile;
  const metrics = (exercise?.metrics ?? (['reps', 'rpe'] as MetricKey[])).filter(
    (metric) => metric !== 'rpe' || perSetEffort,
  );

  /*
   * A plank is the one thing here you cannot log while doing it — both hands are busy and
   * the number only exists once you stop. Inside a block the sets are a round's recipe rather
   * than something you tick off, so there is nothing there to time.
   */
  const timeable = Boolean(onStartHold) && !nested && !readOnly && exercise && isHold(exercise);

  return (
    <section id={id} className={nested ? 'block-movement' : 'card'}>
      <div className="card-head">
        <div className="grow">
          {/* The name is the affordance. Nobody should leave the app mid-set to look up
              what a Cossack squat is. */}
          <h3 className="truncate">
            <button className="name-link" onClick={() => onShowInfo(slug)}>
              {exercise?.name ?? slug}
              <span className="info-dot" aria-hidden="true">ⓘ</span>
            </button>
          </h3>
          {previous && (
            <div className="tiny faint">
              Last {formatDayLabel(previous.session.date).toLowerCase()}:{' '}
              {summariseSets(previous.sets, metrics, units)}
            </div>
          )}
          {/*
            A note, not a barrier. Whether the shoulder can take a press today is something
            only you know, and an app that refused would just be one you worked around.
          */}
          {warnings.map((warning) => (
            <div className="tiny injury-note" key={warning}>
              🩹 {warning}
            </div>
          ))}
        </div>
        {/* Next to the name, because "this is too hard today" is a thought you have while
            looking at the movement, not one you go hunting through a menu for. */}
        {!readOnly && (
          <>
            <button
              className="btn ghost sm"
              aria-label={`Swap ${exercise?.name ?? slug} for another version`}
              onClick={() => onSwapExercise(slug)}
            >
              Swap
            </button>
            <button
              className="btn ghost sm"
              aria-label={`Remove ${exercise?.name ?? slug}`}
              onClick={() => onRemoveExercise(slug)}
            >
              ✕
            </button>
          </>
        )}
      </div>

      <div className="set-row" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
        <span className="set-no" />
        <div className="set-fields">
          {metrics.map((metric) => (
            <span className="field-label" key={metric}>
              {metricLabel(metric, units)}
            </span>
          ))}
          {/* The button takes a column of the same grid, so it needs a label to sit under. */}
          {timeable && <span className="field-label" />}
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
                  readOnly={readOnly}
                  onChange={(value) => onSetValue(set.id, metric, value)}
                />
              ))}
              {timeable && (
                <button
                  className="btn sm hold-start"
                  onClick={() => onStartHold!(set.id)}
                  aria-label={`Time this hold of ${exercise?.name ?? slug}`}
                >
                  ▶ Hold
                </button>
              )}
            </div>
            {readOnly ? (
              /*
               * Still a tick, still in the same column — a finished workout should look like
               * what you logged, not like a different screen. It just no longer answers to a
               * thumb, so scrolling back through history cannot quietly un-complete a set.
               */
              nested ? (
                <span style={{ width: 'var(--check-w)' }} />
              ) : (
                <span
                  className={`set-check${set.completed ? ' done' : ''}`}
                  aria-label={set.completed ? `Set ${index + 1} done` : `Set ${index + 1} not completed`}
                >
                  {set.completed ? '✓' : ''}
                </span>
              )
            ) : nested ? (
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

      {!nested && !readOnly && (
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

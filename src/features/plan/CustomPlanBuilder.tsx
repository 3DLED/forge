/**
 * Building a plan a week at a time.
 *
 * A week, not a calendar. Laying out twelve weeks by hand is a thing people start and do not
 * finish, and it is not what most training actually looks like: the same week, repeated, with
 * the load creeping up. The creeping up is already handled — the logger reads what you did
 * last time and suggests more — so the plan's job is the shape, and the shape is a week.
 *
 * Every weekday is shown, including the ones with nothing on them, because "Thursday is a rest
 * day" and "I have not decided about Thursday" are different states and only one of them wants
 * doing something about.
 */

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import AskSheet from '../../ui/AskSheet';
import { plural } from '../../ui/text';
import { emptyWeek, isTrainingDay, dayLabel, saveCustomPlan } from '../../data/customPlans';
import { savedWorkouts } from '../../data/namedWorkouts';
import { SEED_SESSION_TEMPLATES } from '../../data/seed/sessionTemplates';
import { weekdayName } from '../../domain/dates';
import { useApp } from '../../ui/AppProvider';
import type { CustomPlan, CustomPlanDay, GoalKind, Weekday } from '../../domain/types';

/** Offered lengths. Ongoing is last because a plan with an end is the commoner intent. */
const WEEK_OPTIONS: (number | null)[] = [4, 6, 8, 12, 16, null];

const GOALS: { kind: GoalKind; label: string }[] = [
  { kind: 'general', label: 'General' },
  { kind: 'strength', label: 'Strength' },
  { kind: 'physique', label: 'Muscle' },
  { kind: 'race', label: 'Race' },
];

export default function CustomPlanBuilder({
  existing,
  onClose,
  onSaved,
}: {
  existing?: CustomPlan;
  onClose: () => void;
  onSaved: (plan: CustomPlan) => void;
}) {
  const { profile } = useApp();
  const saved = useLiveQuery(() => savedWorkouts(), []);

  const [name, setName] = useState(existing?.name ?? 'My plan');
  const [goal, setGoal] = useState<GoalKind>(existing?.goal ?? 'general');
  const [weeks, setWeeks] = useState<number | null>(existing?.weeks ?? 8);
  const [days, setDays] = useState<CustomPlanDay[]>(existing?.days ?? emptyWeek());
  const [picking, setPicking] = useState<Weekday | null>(null);
  const [saving, setSaving] = useState(false);

  const training = days.filter(isTrainingDay).length;

  /* Shown starting on the athlete's own week start, so the grid reads like their calendar. */
  const ordered = Array.from(
    { length: 7 },
    (_, i) => days[((profile.weekStartsOn ?? 0) + i) % 7],
  );

  const setDay = (weekday: Weekday, next: Partial<CustomPlanDay>) =>
    setDays((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...next, weekday } : day)),
    );

  const save = async () => {
    setSaving(true);
    const plan = await saveCustomPlan(
      { name: name.trim() || 'My plan', goal, weeks, days },
      existing?.id,
    );
    onSaved(plan);
  };

  return (
    <>
      <Sheet
        title={existing ? `Edit “${existing.name}”` : 'Build a plan'}
        onClose={onClose}
        footer={
          <button
            className="btn primary block"
            disabled={saving || training === 0}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : training === 0 ? 'Add a day to save' : 'Save plan'}
          </button>
        }
      >
        <div className="section-title">Name</div>
        <input
          value={name}
          aria-label="Plan name"
          placeholder="Winter base"
          onChange={(event) => setName(event.target.value)}
        />

        <div className="section-title">What it is for</div>
        <div className="row wrap" style={{ gap: '0.4rem' }}>
          {GOALS.map((option) => (
            <button
              key={option.kind}
              className={`chip${goal === option.kind ? ' on' : ''}`}
              aria-pressed={goal === option.kind}
              onClick={() => setGoal(option.kind)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="section-title">How long</div>
        <div className="row wrap" style={{ gap: '0.4rem' }}>
          {WEEK_OPTIONS.map((option) => (
            <button
              key={String(option)}
              className={`chip${weeks === option ? ' on' : ''}`}
              aria-pressed={weeks === option}
              onClick={() => setWeeks(option)}
            >
              {option === null ? 'Ongoing' : `${option} weeks`}
            </button>
          ))}
        </div>

        <div className="section-title">Your week</div>
        <p className="tiny faint" style={{ marginTop: '-0.35rem' }}>
          This repeats. The weights climb from what you actually lift, not from the plan.
        </p>

        {ordered.map((day) => (
          <button
            key={day.weekday}
            className="pick"
            onClick={() => setPicking(day.weekday)}
            aria-label={`Set ${weekdayName(day.weekday)}`}
          >
            <span className="grow">
              <strong>{weekdayName(day.weekday)}</strong>
              <br />
              <span className={`tiny${isTrainingDay(day) ? '' : ' faint'}`}>
                {dayLabel(day)}
              </span>
            </span>
            <span className="faint">›</span>
          </button>
        ))}

        <p className="tiny faint" style={{ marginTop: '0.6rem' }}>
          {training === 0
            ? 'Nothing on any day yet.'
            : `${plural(training, 'session')} a week${weeks ? ` · ${plural(weeks * training, 'session')} in total` : ''}.`}
        </p>
      </Sheet>

      {picking != null && (
        <DayPicker
          weekday={picking}
          current={days.find((day) => day.weekday === picking)!}
          saved={saved ?? []}
          onClose={() => setPicking(null)}
          onPick={(next) => {
            setDay(picking, next);
            setPicking(null);
          }}
        />
      )}
    </>
  );
}

/**
 * What goes on one day.
 *
 * Rest is offered as a choice rather than as the absence of one, so a week you have finished
 * laying out looks finished.
 */
function DayPicker({
  weekday,
  current,
  saved,
  onClose,
  onPick,
}: {
  weekday: Weekday;
  current: CustomPlanDay;
  saved: { id: string; name: string; blocks: unknown[]; modalities: string[]; estimatedMinutes?: number }[];
  onClose: () => void;
  onPick: (day: Partial<CustomPlanDay>) => void;
}) {
  const [query, setQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const term = query.trim().toLowerCase();
  const matches = SEED_SESSION_TEMPLATES.filter(
    (template) => !term || template.name.toLowerCase().includes(term),
  );
  const mine = saved.filter((workout) => !term || workout.name.toLowerCase().includes(term));

  return (
    <>
      <Sheet title={weekdayName(weekday)} onClose={onClose}>
        <div className="row" style={{ gap: '0.5rem' }}>
          <button className="btn grow" onClick={() => onPick({ kind: 'rest', templateSlug: undefined, workout: undefined })}>
            😴 Rest day
          </button>
          {current.kind !== 'open' && (
            <button className="btn ghost" onClick={() => setConfirmClear(true)}>
              Clear
            </button>
          )}
        </div>

        <input
          type="search"
          value={query}
          placeholder="Search sessions"
          aria-label="Search sessions"
          style={{ marginTop: '0.6rem' }}
          onChange={(event) => setQuery(event.target.value)}
        />

        {mine.length > 0 && <div className="section-title">Your saved workouts</div>}
        {mine.map((workout) => (
          <button
            key={workout.id}
            className={`pick${
              current.kind === 'saved' && current.workout?.name === workout.name ? ' selected' : ''
            }`}
            onClick={() =>
              onPick({
                kind: 'saved',
                templateSlug: undefined,
                // Copied in, not linked. See the note on CustomPlanDay.
                workout: {
                  name: workout.name,
                  modalities: workout.modalities as never,
                  estimatedMinutes: workout.estimatedMinutes,
                  blocks: structuredClone(workout.blocks) as never,
                },
              })
            }
          >
            <span className="grow">
              <strong>{workout.name}</strong>
              <br />
              <span className="tiny faint">Yours · copied into the plan</span>
            </span>
          </button>
        ))}

        {matches.length > 0 && <div className="section-title">Built in</div>}
        {matches.map((template) => (
          <button
            key={template.slug}
            className={`pick${current.templateSlug === template.slug ? ' selected' : ''}`}
            onClick={() =>
              onPick({ kind: 'template', templateSlug: template.slug, workout: undefined })
            }
          >
            <span className="grow">
              <strong>{template.name}</strong>
              <br />
              <span className="tiny faint">
                {template.modalities.join(' · ')} · about {template.estimatedMinutes} min
              </span>
            </span>
          </button>
        ))}

        {matches.length + mine.length === 0 && (
          <p className="tiny faint" style={{ marginTop: '0.6rem' }}>
            Nothing matches “{query.trim()}”.
          </p>
        )}
      </Sheet>

      {confirmClear && (
        <AskSheet
          title={`Clear ${weekdayName(weekday)}?`}
          message="It goes back to undecided — neither a session nor a rest day."
          confirmLabel="Clear it"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setConfirmClear(false);
            onPick({ kind: 'open', templateSlug: undefined, workout: undefined });
          }}
        />
      )}
    </>
  );
}

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
import RampEditor from './RampEditor';
import { plural } from '../../ui/text';
import {
  dayLabel,
  emptyWeek,
  isTrainingDay,
  rampableMovements,
  saveCustomPlan,
} from '../../data/customPlans';
import { savedWorkouts } from '../../data/namedWorkouts';
import { SEED_SESSION_TEMPLATES } from '../../data/seed/sessionTemplates';
import { weekdayName } from '../../domain/dates';
import { BUILDABLE_REGIONS, REGION_LABELS } from '../../domain/regions';
import { useApp } from '../../ui/AppProvider';
import type {
  CustomPlan,
  CustomPlanDay,
  GoalKind,
  UnitSystem,
  Weekday,
} from '../../domain/types';

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
                {day.ramp && ` · grows weekly`}
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
          units={profile.units}
          weeks={weeks}
          onClose={() => setPicking(null)}
          onUpdate={(patch) => setDay(picking, patch)}
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
  units,
  weeks,
  onClose,
  onPick,
  onUpdate,
}: {
  weekday: Weekday;
  current: CustomPlanDay;
  saved: { id: string; name: string; blocks: unknown[]; modalities: string[]; estimatedMinutes?: number }[];
  units: UnitSystem;
  weeks: number | null;
  onClose: () => void;
  onPick: (day: Partial<CustomPlanDay>) => void;
  /** Kept apart from onPick: setting a ramp adjusts the day rather than replacing it. */
  /**
   * Changes the day without closing the sheet.
   *
   * Kept apart from `onPick`, which settles the day and gets out of the way. Turning a ramp on
   * or narrowing what a suggested day asks for are adjustments to a choice already made, and
   * closing the sheet under someone mid-adjustment is how you end up reopening it three times.
   */
  onUpdate: (patch: Partial<CustomPlanDay>) => void;
}) {
  const [query, setQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const rampable = rampableMovements(current);

  const term = query.trim().toLowerCase();
  const matches = SEED_SESSION_TEMPLATES.filter(
    (template) => !term || template.name.toLowerCase().includes(term),
  );
  const mine = saved.filter((workout) => !term || workout.name.toLowerCase().includes(term));

  return (
    <>
      <Sheet title={weekdayName(weekday)} onClose={onClose}>
        <div className="row" style={{ gap: '0.5rem' }}>
          <button
            className="btn grow"
            onClick={() =>
              onPick({
                kind: 'rest',
                templateSlug: undefined,
                workout: undefined,
                ramp: undefined,
                suggest: undefined,
              })
            }
          >
            😴 Rest day
          </button>
          {current.kind !== 'open' && (
            <button className="btn ghost" onClick={() => setConfirmClear(true)}>
              Clear
            </button>
          )}
        </div>

        {/*
          Only once there is a session to ramp, and only for what can sensibly grow. See the
          note in RampEditor for why load is left out of it.
        */}
        {rampable.length > 0 && (
          <RampEditor
            movements={rampable}
            ramp={current.ramp}
            units={units}
            weeks={weeks ?? 12}
            onChange={(ramp) => onUpdate({ ramp })}
          />
        )}

        <input
          type="search"
          value={query}
          placeholder="Search sessions"
          aria-label="Search sessions"
          style={{ marginTop: '0.6rem' }}
          onChange={(event) => setQuery(event.target.value)}
        />

        {/*
          A day described rather than specified. Choosing the movements eight weeks out means
          choosing them without knowing what you own that week or how the last one went.
        */}
        <div className="section-title">Decide on the day</div>
        <button
          className={`pick${current.kind === 'suggest' ? ' selected' : ''}`}
          onClick={() =>
            onUpdate({
              kind: 'suggest',
              templateSlug: undefined,
              workout: undefined,
              ramp: undefined,
              suggest: current.suggest ?? { regions: ['upper', 'lower'], minutes: 45 },
            })
          }
        >
          <span className="grow">
            <strong>✨ Suggest a session</strong>
            <br />
            <span className="tiny faint">
              Filled in when the day arrives, from your kit and what you have been training.
            </span>
          </span>
        </button>

        {current.kind === 'suggest' && current.suggest && (
          <div className="card tight">
            <div className="section-title" style={{ marginTop: 0 }}>Train</div>
            <div className="row wrap" style={{ gap: '0.4rem' }}>
              {BUILDABLE_REGIONS.map((region) => {
                const on = current.suggest!.regions.includes(region);
                return (
                  <button
                    key={region}
                    className={`chip${on ? ' on' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      const next = on
                        ? current.suggest!.regions.filter((r) => r !== region)
                        : [...current.suggest!.regions, region];
                      // Turning the last one off would leave nothing to generate from.
                      onUpdate({
                        suggest: {
                          ...current.suggest!,
                          regions: next.length > 0 ? next : current.suggest!.regions,
                        },
                      });
                    }}
                  >
                    {REGION_LABELS[region]}
                  </button>
                );
              })}
            </div>

            <div className="section-title">For about</div>
            <div className="row wrap" style={{ gap: '0.4rem' }}>
              {[20, 30, 45, 60].map((minutes) => (
                <button
                  key={minutes}
                  className={`chip${current.suggest!.minutes === minutes ? ' on' : ''}`}
                  aria-pressed={current.suggest!.minutes === minutes}
                  onClick={() => onUpdate({ suggest: { ...current.suggest!, minutes } })}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
        )}

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
                ramp: undefined,
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
            onPick({ kind: 'open', templateSlug: undefined, workout: undefined, ramp: undefined });
          }}
        />
      )}
    </>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import ReshuffleSheet from './ReshuffleSheet';
import GoalPicker from './GoalPicker';
import { plural } from '../../ui/text';
import { useApp } from '../../ui/AppProvider';
import { profileRepo } from '../../data/repos';
import { calendarExceptions } from '../../data/plans';
import { plannedBetween } from '../../data/sessions';
import { addDays, todayKey, weekdayName } from '../../domain/dates';
import { planReshuffle } from '../../domain/reshuffle';
import type { Modality, UnitSystem, Weekday } from '../../domain/types';

/**
 * How far ahead a change to your week is allowed to reach.
 *
 * Long enough to cover a plan you are actually running, short enough that editing a rest day
 * does not silently rewrite a marathon block eleven months out.
 */
const HORIZON_DAYS = 120;

const MODALITIES: { value: Modality; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'skill', label: 'Skill' },
];

export default function SettingsView() {
  const { profile } = useApp();
  const [reviewing, setReviewing] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const today = todayKey();
  const planned = useLiveQuery(() => plannedBetween(today, addDays(today, HORIZON_DAYS)), [today]);
  const exceptions = useLiveQuery(() => calendarExceptions(), []);

  /*
   * Recomputed on every change to the week, which is what makes the notice appear the moment
   * a day stops working rather than at some later checkpoint. It only ever reads.
   */
  const reshuffle = useMemo(
    () =>
      planReshuffle({
        sessions: planned ?? [],
        availability: profile.availability,
        exceptions: exceptions ?? [],
        from: today,
        weekStartsOn: profile.weekStartsOn,
      }),
    [planned, exceptions, profile.availability, profile.weekStartsOn, today],
  );

  const setUnits = (units: UnitSystem) => void profileRepo.update(profile.id, { units });

  const toggleModality = (weekday: Weekday, modality: Modality) => {
    const availability = profile.availability.map((rule) => {
      if (rule.weekday !== weekday) return rule;
      const allowed = rule.allowedModalities.includes(modality)
        ? rule.allowedModalities.filter((m) => m !== modality)
        : [...rule.allowedModalities, modality];
      return { ...rule, allowedModalities: allowed };
    });
    void profileRepo.update(profile.id, { availability });
  };

  return (
    <>
      <PageHeader
        title="Settings"
        action={<Link to="/more" className="btn ghost sm">Back</Link>}
      />

      <div className="section-title">Name</div>
      <input
        value={profile.displayName}
        onChange={(event) => void profileRepo.update(profile.id, { displayName: event.target.value })}
      />

      <div className="section-title">Training for</div>
      <GoalPicker profile={profile} />
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        Orders the plan library, sets what ‘Suggest a workout’ opens on, and shapes the sets
        and reps in plans you start from here. Plans already on your calendar keep what they
        prescribed.
      </p>

      <div className="section-title">Training max</div>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {[85, 90, 95, 100].map((percent) => (
          <button
            key={percent}
            className={`chip${(profile.trainingMaxPercent ?? 90) === percent ? ' on' : ''}`}
            onClick={() => void profileRepo.update(profile.id, { trainingMaxPercent: percent })}
          >
            {percent}%
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        Suggested loads are worked out from this share of your tested max, rather than from the
        max itself. Ninety per cent is the usual convention: a number computed from your best
        day is not makeable on an average one, and a programme you miss reps on is one you stop
        running. At 100% the suggestions come straight off your max.
      </p>

      <div className="section-title">Units</div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button
          className={`btn grow${profile.units === 'imperial' ? ' primary' : ''}`}
          onClick={() => setUnits('imperial')}
        >
          lb / miles
        </button>
        <button
          className={`btn grow${profile.units === 'metric' ? ' primary' : ''}`}
          onClick={() => setUnits('metric')}
        >
          kg / km
        </button>
      </div>
      <p className="tiny faint">
        Stored data does not change — this only affects how numbers are shown, so switching
        back and forth never rounds your history away.
      </p>

      <div className="section-title">Week starts on</div>
      <div className="chip-row">
        {([0, 1] as Weekday[]).map((day) => (
          <button
            key={day}
            className={`chip${profile.weekStartsOn === day ? ' on' : ''}`}
            onClick={() => void profileRepo.update(profile.id, { weekStartsOn: day })}
          >
            {weekdayName(day)}
          </button>
        ))}
      </div>

      <div className="section-title">Effort per set</div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button
          className={`btn grow${profile.perSetEffort ? '' : ' primary'}`}
          onClick={() => void profileRepo.update(profile.id, { perSetEffort: false })}
        >
          Once per session
        </button>
        <button
          className={`btn grow${profile.perSetEffort ? ' primary' : ''}`}
          onClick={() => void profileRepo.update(profile.id, { perSetEffort: true })}
        >
          Every set
        </button>
      </div>
      <p className="tiny faint">
        Per-set effort is how autoregulated strength work picks its loads — a 9 on a triple
        you wanted at 8 means the next set comes down. It is worth the extra box on every row
        only if you act on it between sets. Training load uses the session figure either way.
      </p>

      <div className="section-title">Weekly availability</div>

      {/*
        Shown rather than prompted. Toggling four chips to rearrange a week would otherwise
        raise four dialogs, so the mismatch waits here until the week looks the way you meant
        it to and you go and deal with it.
      */}
      {!reshuffle.settled && (
        <div className="card tight">
          <div className="small">
            <strong>{plural(reshuffle.moves.length + reshuffle.drops.length, 'planned session')}</strong>{' '}
            no longer {reshuffle.moves.length + reshuffle.drops.length === 1 ? 'fits' : 'fit'} this
            week.
          </div>
          <button
            className="btn primary block"
            style={{ marginTop: '0.5rem' }}
            onClick={() => setReviewing(true)}
          >
            See what would move
          </button>
        </div>
      )}

      {outcome && (
        <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
          {outcome}
        </p>
      )}

      <div className="card">
        <p className="small muted">
          Which kinds of training each day can hold. Planning will respect this — a day with
          nothing selected is a rest day.
        </p>
        {profile.availability
          .slice()
          .sort((a, b) => ((a.weekday - profile.weekStartsOn + 7) % 7) - ((b.weekday - profile.weekStartsOn + 7) % 7))
          .map((rule) => (
            <div key={rule.weekday} style={{ padding: '0.4rem 0' }}>
              <div className="row between">
                <strong className="small">{weekdayName(rule.weekday)}</strong>
                {rule.allowedModalities.length === 0 && <span className="pill">Rest</span>}
              </div>
              <div className="row wrap" style={{ gap: '0.35rem', marginTop: '0.3rem' }}>
                {MODALITIES.map((modality) => (
                  <button
                    key={modality.value}
                    className={`chip${rule.allowedModalities.includes(modality.value) ? ' on' : ''}`}
                    onClick={() => toggleModality(rule.weekday, modality.value)}
                  >
                    {modality.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>

      {reviewing && (
        <ReshuffleSheet
          plan={reshuffle}
          onClose={() => setReviewing(false)}
          onApplied={({ moved, dropped }) => {
            setReviewing(false);
            setOutcome(
              [
                moved > 0 && `${plural(moved, 'session')} moved`,
                dropped > 0 && `${plural(dropped, 'session')} dropped`,
              ]
                .filter(Boolean)
                .join(' · ') || 'Nothing changed',
            );
          }}
        />
      )}
    </>
  );
}

import { Link } from 'react-router-dom';
import PageHeader from '../../ui/PageHeader';
import { useApp } from '../../ui/AppProvider';
import { profileRepo } from '../../data/repos';
import { weekdayName } from '../../domain/dates';
import type { Modality, UnitSystem, Weekday } from '../../domain/types';

const MODALITIES: { value: Modality; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'skill', label: 'Skill' },
];

export default function SettingsView() {
  const { profile } = useApp();

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
    </>
  );
}

/**
 * A distance or a time on one day that grows week by week.
 *
 * The one kind of progression a plan has to carry itself. Load autoregulates — the logger
 * reads what you actually lifted and suggests more next time — but nothing about last Tuesday
 * tells you how far to run in week nine. That is scheduled, and scheduling it is the plan's
 * job. So this is offered only for distance and time; ramping reps or load here would mean a
 * plan arguing with the logger every session.
 *
 * The preview is the point of the whole screen. Eight per cent a week sounds modest and is
 * not — it doubles in nine weeks — and nobody can picture a compounding curve from its rate.
 * Showing week one beside the last week turns an abstract percentage into the two numbers
 * that actually matter: what you start on, and what it has become by the end.
 */

import { rampValueAt, type RampableMovement } from '../../data/customPlans';
import {
  displayDistance,
  distanceLabel,
  formatDistance,
  formatDuration,
  inputDistanceToMeters,
} from '../../domain/units';
import type { SlotProgression, UnitSystem } from '../../domain/types';

/** Five to ten per cent is the conventional range for adding distance; twelve is pushing it. */
const RATES = [0.05, 0.08, 0.1, 0.12];

export default function RampEditor({
  movements,
  ramp,
  units,
  weeks,
  onChange,
}: {
  movements: RampableMovement[];
  ramp?: SlotProgression;
  units: UnitSystem;
  weeks: number;
  onChange: (ramp: SlotProgression | undefined) => void;
}) {
  const target = movements.find((m) => m.exerciseSlug === ramp?.exerciseSlug) ?? movements[0];
  if (!target) return null;

  const isDistance = (ramp?.metric ?? target.metric) === 'distanceM';
  const show = (value: number) => (isDistance ? formatDistance(value, units) : formatDuration(value));

  const toStored = (entered: number) =>
    isDistance ? inputDistanceToMeters(entered, units) : Math.max(1, entered) * 60;
  const toShown = (stored: number) =>
    isDistance ? Math.round(displayDistance(stored, units) * 100) / 100 : Math.round(stored / 60);

  if (!ramp) {
    return (
      <button
        className="btn block"
        style={{ marginTop: '0.6rem' }}
        onClick={() =>
          onChange({
            exerciseSlug: target.exerciseSlug,
            metric: target.metric,
            // Starts where the session already is, which is the only sensible week one.
            startValue: target.value,
            weeklyRate: 0.08,
          })
        }
      >
        📈 Make it grow each week
      </button>
    );
  }

  const edit = (patch: Partial<SlotProgression>) => onChange({ ...ramp, ...patch });
  const capped = ramp.maxValue != null && rampValueAt(ramp, weeks) >= ramp.maxValue;
  const cappedAt = () => {
    for (let week = 1; week <= weeks; week += 1) {
      if (rampValueAt(ramp, week) >= ramp.maxValue!) return week;
    }
    return weeks;
  };

  return (
    <div className="card tight" style={{ marginTop: '0.6rem' }}>
      <div className="row between">
        <strong className="small grow">Grows each week</strong>
        <button className="btn sm ghost" onClick={() => onChange(undefined)}>
          Turn off
        </button>
      </div>

      {/* Only asked when the session holds more than one thing that could grow. */}
      {movements.length > 1 && (
        <div className="row wrap" style={{ gap: '0.4rem', marginTop: '0.5rem' }}>
          {movements.map((movement) => (
            <button
              key={`${movement.exerciseSlug}-${movement.metric}`}
              className={`chip${movement.exerciseSlug === ramp.exerciseSlug ? ' on' : ''}`}
              aria-pressed={movement.exerciseSlug === ramp.exerciseSlug}
              onClick={() =>
                edit({
                  exerciseSlug: movement.exerciseSlug,
                  metric: movement.metric,
                  startValue: movement.value,
                })
              }
            >
              {movement.exerciseSlug.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      )}

      <div className="section-title" style={{ marginTop: '0.5rem' }}>
        Start at
      </div>
      <div className="row" style={{ gap: '0.4rem' }}>
        <input
          type="number"
          inputMode="decimal"
          aria-label="Starting value"
          value={toShown(ramp.startValue)}
          style={{ maxWidth: '7rem' }}
          onChange={(event) => edit({ startValue: toStored(Number(event.target.value)) })}
        />
        <span className="muted small">{isDistance ? distanceLabel(units) : 'min'}</span>
      </div>

      <div className="section-title">By how much</div>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {RATES.map((rate) => (
          <button
            key={rate}
            className={`chip${ramp.weeklyRate === rate ? ' on' : ''}`}
            aria-pressed={ramp.weeklyRate === rate}
            onClick={() => edit({ weeklyRate: rate })}
          >
            {Math.round(rate * 100)}%
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        Ten per cent a week is the conventional ceiling for adding distance. Past it the
        injuries tend to arrive before the fitness does.
      </p>

      <div className="section-title">Stop at</div>
      <div className="row" style={{ gap: '0.4rem' }}>
        <input
          type="number"
          inputMode="decimal"
          aria-label="Maximum value"
          placeholder="no limit"
          value={ramp.maxValue == null ? '' : toShown(ramp.maxValue)}
          style={{ maxWidth: '7rem' }}
          onChange={(event) => {
            const raw = event.target.value.trim();
            edit({ maxValue: raw ? toStored(Number(raw)) : undefined });
          }}
        />
        <span className="muted small">{isDistance ? distanceLabel(units) : 'min'}</span>
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        Where the build-up levels off. Without one it keeps climbing for the whole plan.
      </p>

      <div className="card tight" style={{ marginTop: '0.6rem' }}>
        <div className="row between">
          <span className="small grow">Week 1</span>
          <span className="mono">{show(rampValueAt(ramp, 1))}</span>
        </div>
        <div className="row between" style={{ marginTop: '0.2rem' }}>
          <span className="small grow">Week {weeks}</span>
          <span className="mono">
            <strong>{show(rampValueAt(ramp, weeks))}</strong>
          </span>
        </div>
        {capped && (
          <div className="tiny faint" style={{ marginTop: '0.25rem' }}>
            Reaches {show(ramp.maxValue!)} in week {cappedAt()} and holds there.
          </div>
        )}
      </div>
    </div>
  );
}

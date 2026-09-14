/**
 * The pace alert controls, shared by the run settings screen and the run itself.
 *
 * Extracted rather than copied, because the two must never disagree about what a tolerance
 * means. The settings screen sets up an outing. The sheet on the run screen is for the moment
 * a mile in when the alerts turn out to be chatty or the target turns out to be wrong, and the
 * answer then should be the same controls, not a smaller cousin of them.
 */

import { displayPace, M_PER_MILE, parsePaceInput } from '../../domain/units';
import type { RunSettings } from '../../domain/runSettings';
import type { UnitSystem } from '../../domain/types';
import { useT } from '../../i18n/useT';

/** Tolerances offered in the pace unit on screen, stored per kilometre like everything else. */
const TOLERANCES = [10, 15, 20, 30];

export function PaceAlertControls({
  settings,
  units,
  patch,
}: {
  settings: RunSettings;
  units: UnitSystem;
  patch: (change: Partial<RunSettings>) => void;
}) {
  const t = useT();
  return (
    <>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button
          className={`btn grow${settings.paceAlerts ? ' primary' : ''}`}
          onClick={() => patch({ paceAlerts: true })}
        >
          {t('On')}
        </button>
        <button
          className={`btn grow${settings.paceAlerts ? '' : ' primary'}`}
          onClick={() => patch({ paceAlerts: false })}
        >
          {t('Off')}
        </button>
      </div>

      {settings.paceAlerts && (
        <>
          <div className="tiny faint" style={{ marginTop: '0.6rem' }}>
            {t('Say something once I am off by')}
          </div>
          <div className="chip-row">
            {TOLERANCES.map((seconds) => {
              const secPerKm = units === 'imperial' ? seconds / (M_PER_MILE / 1000) : seconds;
              const chosen = Math.abs(displayPace(settings.toleranceSecPerKm, units) - seconds) < 1;
              return (
                <button
                  key={seconds}
                  className={`chip${chosen ? ' on' : ''}`}
                  onClick={() => patch({ toleranceSecPerKm: secPerKm })}
                >
                  {seconds}s
                </button>
              );
            })}
          </div>
          <p className="tiny faint">
            {t('Measured against the target above, or on a tempo or interval session against the pace of the piece you are on. Drifting is normal, so this waits — half a minute off pace before it says anything, and longer before it says the same thing twice.')}
          </p>
        </>
      )}
    </>
  );
}

/** Minutes offered on the wheel, per mile or per kilometre: a sprint rep to a brisk walk. */
const MINUTE_RANGE: Record<UnitSystem, [number, number]> = { imperial: [4, 20], metric: [2, 13] };
const SECONDS = Array.from({ length: 60 }, (_, s) => s);

/**
 * A pace, picked on two wheels: minutes, then seconds.
 *
 * It used to be typed, and on a long run it could not be. The phone's number pad has no colon,
 * so "8:30" went in as 830 and "11" came back as eleven seconds a mile. Two selects are the
 * iPhone's own scroll wheels, and neither of them can mean the wrong unit.
 *
 * `optional` adds "No target" to the top of the minutes wheel, for the one pace a run can do
 * without. The pieces of a tempo or interval session always have one.
 */
export function PaceField({
  label,
  value,
  units,
  onChange,
  optional = false,
}: {
  label: string;
  value: number | undefined;
  units: UnitSystem;
  onChange: (secPerKm: number | undefined) => void;
  optional?: boolean;
}) {
  const t = useT();
  const shown = value == null ? null : Math.round(displayPace(value, units));
  const minutes = shown == null ? null : Math.floor(shown / 60);
  const seconds = shown == null ? 0 : shown % 60;

  // A pace saved before the wheels existed can sit outside their range; it still has to show.
  const [low, high] = MINUTE_RANGE[units];
  const minuteOptions = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  if (minutes != null && !minuteOptions.includes(minutes)) {
    minuteOptions.push(minutes);
    minuteOptions.sort((a, b) => a - b);
  }

  const pick = (m: number, s: number) => onChange(parsePaceInput(`${m}:${s}`, units) ?? undefined);

  return (
    <div className="run-field" role="group" aria-label={label} style={{ marginTop: '0.6rem' }}>
      <span className="tiny faint">{label}</span>
      <div className="pace-wheels">
        <select
          aria-label={t('Minutes')}
          value={minutes ?? ''}
          onChange={(event) => {
            if (event.target.value === '') onChange(undefined);
            else pick(Number(event.target.value), seconds);
          }}
        >
          {(optional || minutes == null) && <option value="">{t('No target')}</option>}
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="pace-colon" aria-hidden="true">
          :
        </span>
        <select
          aria-label={t('Seconds')}
          value={seconds}
          disabled={minutes == null}
          onChange={(event) => minutes != null && pick(minutes, Number(event.target.value))}
        >
          {SECONDS.map((s) => (
            <option key={s} value={s}>
              {String(s).padStart(2, '0')}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

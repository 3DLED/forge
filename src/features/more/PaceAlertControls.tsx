/**
 * The pace alert controls, shared by the run settings screen and the run itself.
 *
 * Extracted rather than copied, because the two must never disagree about what a tolerance
 * means. The settings screen sets up an outing. The sheet on the run screen is for the moment
 * a mile in when the alerts turn out to be chatty or the target turns out to be wrong, and the
 * answer then should be the same controls, not a smaller cousin of them.
 */

import { useState } from 'react';
import { displayPace, M_PER_MILE, paceInputValue, parsePaceInput } from '../../domain/units';
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

/**
 * A pace, typed.
 *
 * Held as text while you edit it rather than parsed on every keystroke: "8:" is halfway to a
 * valid pace, and a field that erases itself the moment you type a colon is unusable. The
 * stored value only moves when what is typed means something.
 */
export function PaceField({
  label,
  value,
  units,
  onChange,
}: {
  label: string;
  value: number | undefined;
  units: UnitSystem;
  onChange: (secPerKm: number | undefined) => void;
}) {
  const t = useT();
  const [text, setText] = useState(value == null ? '' : paceInputValue(value, units));
  const parsed = parsePaceInput(text, units);

  return (
    <label className="run-field" style={{ marginTop: '0.6rem' }}>
      <span className="tiny faint">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder={units === 'imperial' ? '8:30' : '5:20'}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (event.target.value.trim() === '') onChange(undefined);
          else {
            const next = parsePaceInput(event.target.value, units);
            if (next != null) onChange(next);
          }
        }}
      />
      {text.trim() !== '' && parsed == null && (
        <span className="tiny faint">{t('Minutes and seconds, like 8:30')}</span>
      )}
    </label>
  );
}

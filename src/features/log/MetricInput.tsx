/**
 * One input per metric, so the logging row for a movement is assembled from whatever that
 * movement records. This is the payoff of metric-driven exercises: no special-casing runs
 * against lifts anywhere in the UI.
 *
 * Each input keeps its own draft string while focused. Committing on blur (rather than on
 * every keystroke) is what lets someone type "8:30" into a time field, or clear a field to
 * retype it, without the value being reinterpreted mid-edit.
 */

import { useEffect, useState } from 'react';
import type { MetricKey, UnitSystem } from '../../domain/types';
import {
  displayDistance,
  displayWeight,
  distanceLabel,
  formatDuration,
  inputWeightToKg,
  parseDistanceInput,
  parseDuration,
  weightLabel,
} from '../../domain/units';

export function metricLabel(metric: MetricKey, units: UnitSystem): string {
  switch (metric) {
    case 'weightKg': return weightLabel(units);
    case 'reps': return 'reps';
    case 'timeSec': return 'time';
    case 'distanceM': return distanceLabel(units);
    case 'rpe': return 'effort';
    case 'rounds': return 'rounds';
  }
}

/** Stored value → what belongs in the text box. */
function toDraft(metric: MetricKey, value: number | undefined, units: UnitSystem): string {
  if (value == null) return '';
  switch (metric) {
    case 'weightKg': {
      const shown = Math.round(displayWeight(value, units) * 10) / 10;
      return String(shown);
    }
    case 'distanceM': {
      // Sub-half-mile efforts are interval work; show them in metres, as they were entered.
      if (value < 800) return `${Math.round(value)}m`;
      return String(Math.round(displayDistance(value, units) * 100) / 100);
    }
    case 'timeSec':
      return formatDuration(value).replace(/s$/, '');
    default:
      return String(value);
  }
}

/** What the user typed → the stored value. */
function fromDraft(metric: MetricKey, draft: string, units: UnitSystem): number | undefined {
  const text = draft.trim();
  if (!text) return undefined;

  switch (metric) {
    case 'weightKg': {
      const value = Number(text);
      return Number.isFinite(value) ? inputWeightToKg(value, units) : undefined;
    }
    case 'distanceM':
      return parseDistanceInput(text, units) ?? undefined;
    case 'timeSec':
      return parseDuration(text) ?? undefined;
    case 'rpe': {
      const value = Number(text);
      return Number.isFinite(value) ? Math.min(10, Math.max(1, value)) : undefined;
    }
    default: {
      const value = Number(text);
      return Number.isFinite(value) ? value : undefined;
    }
  }
}

/** Numeric keypad wherever the field is truly numeric; text where suffixes are allowed. */
function inputModeFor(metric: MetricKey): 'decimal' | 'numeric' | 'text' {
  if (metric === 'timeSec' || metric === 'distanceM') return 'text';
  if (metric === 'weightKg') return 'decimal';
  return 'numeric';
}

function placeholderFor(metric: MetricKey): string {
  switch (metric) {
    case 'timeSec': return '8:30';
    case 'distanceM': return '3.1';
    case 'rpe': return '1-10';
    default: return '—';
  }
}

export default function MetricInput({
  metric,
  value,
  units,
  onChange,
  showLabel = false,
}: {
  metric: MetricKey;
  value: number | undefined;
  units: UnitSystem;
  onChange: (next: number | undefined) => void;
  showLabel?: boolean;
}) {
  const [draft, setDraft] = useState(() => toDraft(metric, value, units));
  const [focused, setFocused] = useState(false);

  // Adopt external changes (prefilled targets, a copied previous set) unless mid-edit.
  useEffect(() => {
    if (!focused) setDraft(toDraft(metric, value, units));
  }, [value, metric, units, focused]);

  const commit = () => {
    setFocused(false);
    const parsed = fromDraft(metric, draft, units);
    onChange(parsed);
    setDraft(toDraft(metric, parsed, units));
  };

  return (
    <div>
      {showLabel && <span className="field-label">{metricLabel(metric, units)}</span>}
      <input
        type="text"
        inputMode={inputModeFor(metric)}
        value={draft}
        placeholder={placeholderFor(metric)}
        aria-label={metricLabel(metric, units)}
        onFocus={(event) => {
          setFocused(true);
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
    </div>
  );
}

/**
 * One personal best, in full.
 *
 * The list this opens from shows a single headline mark per movement. Everything else lives
 * here, because a row that reads "est. 1RM 102 kg · 1.31× BW · 12 reps · 4:20" is a row you
 * stop reading — the list exists to be scanned, and this exists to be studied.
 *
 * Each mark carries its own date and its own way back to the workout that set it. Marks on
 * one movement routinely come from different days, so a single date at the top of the sheet
 * would be right for one of them and quietly wrong for the rest.
 */

import { Link } from 'react-router-dom';
import Sheet from '../../ui/Sheet';
import { formatDayLabel } from '../../domain/dates';
import { formatDistance, formatDuration, formatPace, formatWeight } from '../../domain/units';
import type { PersonalRecord, PrKind } from '../../domain/training';
import type { UnitSystem } from '../../domain/types';

export interface PrMark {
  kind: PrKind;
  label: string;
  value: string;
  /** Why the number means what it means, where that is not obvious. */
  note?: string;
}

/**
 * Every mark on a record, labelled.
 *
 * Shared with the list so the headline it shows is guaranteed to be one of these, worded
 * identically — the same number described two ways in two places is how you end up unsure
 * which one is the real best.
 */
export function prMarks(record: PersonalRecord, units: UnitSystem): PrMark[] {
  const marks: PrMark[] = [];

  if (record.best1RMKg) {
    marks.push({
      kind: 'oneRm',
      label: 'Estimated 1RM',
      value: formatWeight(record.best1RMKg, units),
      note: 'Calculated from the heaviest set you completed, not a single you actually lifted.',
    });
  }

  if (record.best1RMxBw) {
    marks.push({
      // Derived from the 1RM, so it points back at the same workout.
      kind: 'oneRm',
      label: 'Relative strength',
      value: `${record.best1RMxBw.toFixed(2)}× bodyweight`,
      note: 'Against what you weighed that day, so it stays honest across a bulk or a cut.',
    });
  }

  if (record.bestReps) {
    marks.push({ kind: 'reps', label: 'Most reps in a set', value: String(record.bestReps) });
  }

  if (record.bestRounds) {
    marks.push({
      kind: 'rounds',
      label: 'Most rounds',
      value: record.bestRoundsTimeSec
        ? `${record.bestRounds} in ${formatDuration(record.bestRoundsTimeSec)}`
        : String(record.bestRounds),
      note: 'Only comparable against the same window — 9 rounds in 20 minutes is not a better score than 7 in 12.',
    });
  }

  if (!record.bestRounds && record.bestTimeSec) {
    marks.push({ kind: 'time', label: 'Longest hold', value: formatDuration(record.bestTimeSec) });
  }

  if (record.bestDistanceM) {
    marks.push({
      kind: 'distance',
      label: 'Furthest',
      value: formatDistance(record.bestDistanceM, units),
    });
  }

  if (record.bestPaceSecPerKm) {
    marks.push({
      kind: 'pace',
      label: 'Fastest pace',
      value: formatPace(record.bestPaceSecPerKm, units),
      note: 'Over at least a kilometre.',
    });
  }

  return marks;
}

export default function PrSheet({
  record,
  name,
  units,
  onClose,
}: {
  record: PersonalRecord;
  name: string;
  units: UnitSystem;
  onClose: () => void;
}) {
  const marks = prMarks(record, units);

  return (
    <Sheet title={name} onClose={onClose}>
      {marks.map((mark) => {
        const source = record.sources[mark.kind];

        return (
          <div className="card tight" key={mark.label}>
            <div className="row between">
              <span className="grow">{mark.label}</span>
              <span className="mono">{mark.value}</span>
            </div>

            {mark.note && (
              <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
                {mark.note}
              </div>
            )}

            {source && (
              <div className="tiny" style={{ marginTop: '0.35rem' }}>
                {/*
                  Straight into the workout it came from. A best is far easier to judge next to
                  what surrounded it — what you did first, how the session felt — than as a
                  number standing on its own.
                */}
                <Link to={`/log/${source.sessionId}`} onClick={onClose}>
                  Set {formatDayLabel(source.date)} — open this workout →
                </Link>
              </div>
            )}
          </div>
        );
      })}

      {marks.length === 0 && <p className="small muted">Nothing recorded for this movement yet.</p>}
    </Sheet>
  );
}

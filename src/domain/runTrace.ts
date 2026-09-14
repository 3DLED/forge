/**
 * Splits worked out after a run, from where the run clock stood every hundred metres.
 *
 * Stored as a trace rather than as splits because splits are a question asked later, in
 * whatever unit the reader uses. A run saved while set to kilometres should still show mile
 * splits to somebody who has since switched to miles, and a list of "kilometre 1, kilometre 2"
 * frozen at save time could not.
 *
 * A hundred metres is fine enough that a split boundary interpolated between two checkpoints is
 * off by well under a second at any running pace, and coarse enough that a 10 km run is a
 * hundred small numbers.
 */

export const TRACE_STEP_M = 100;

export interface TraceSplit {
  /** 1-based, so it reads as "mile 3". */
  index: number;
  metres: number;
  seconds: number;
  secPerKm: number;
  /** The leftover stretch past the last whole unit. */
  partial: boolean;
}

/**
 * Splits in `unitM`, from a trace and the run's own totals.
 *
 * The totals close the curve: the trace stops at the last hundred metres crossed, and the run
 * finished somewhere after it. A tail too short to mean anything, under a tenth of a unit or
 * fifty metres, is left off rather than reported as a sprint.
 *
 * An empty trace gives no splits at all. The alternative, spreading the average across every
 * mile, would show an evenly paced run that nobody actually ran.
 */
export function splitsFromTrace(trace: number[], unitM: number, totalM: number, totalSec: number): TraceSplit[] {
  if (trace.length === 0 || totalM <= 0 || totalSec <= 0 || unitM <= 0) return [];

  const points: [number, number][] = [[0, 0]];
  trace.forEach((seconds, i) => points.push([(i + 1) * TRACE_STEP_M, seconds]));
  if (totalM > points[points.length - 1][0]) points.push([totalM, totalSec]);

  const timeAt = (distance: number): number => {
    if (distance <= 0) return 0;
    for (let i = 1; i < points.length; i += 1) {
      const [d0, t0] = points[i - 1];
      const [d1, t1] = points[i];
      if (distance <= d1) return t0 + ((distance - d0) / (d1 - d0 || 1)) * (t1 - t0);
    }
    return totalSec;
  };

  const splits: TraceSplit[] = [];
  const whole = Math.floor(totalM / unitM + 1e-9);
  for (let i = 1; i <= whole; i += 1) {
    const seconds = timeAt(i * unitM) - timeAt((i - 1) * unitM);
    splits.push({ index: i, metres: unitM, seconds, secPerKm: (seconds / unitM) * 1000, partial: false });
  }

  const rest = totalM - whole * unitM;
  if (rest >= Math.max(50, unitM * 0.1)) {
    const seconds = totalSec - timeAt(whole * unitM);
    if (seconds > 0) {
      splits.push({ index: whole + 1, metres: rest, seconds, secPerKm: (seconds / rest) * 1000, partial: true });
    }
  }
  return splits;
}

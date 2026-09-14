/**
 * Splits from a trace. The failure worth guarding is a plausible wrong answer: a boundary
 * interpolated in the wrong direction, or an even split invented where there was no trace.
 */

import { describe, expect, it } from 'vitest';
import { splitsFromTrace, TRACE_STEP_M } from './runTrace';
import { decodeSeries, encodeSeries } from './series';
import { M_PER_MILE } from './units';

/** A run at a dead steady five minutes a kilometre: thirty seconds a hundred metres. */
const steady = (metres: number) =>
  Array.from({ length: Math.floor(metres / TRACE_STEP_M) }, (_, i) => (i + 1) * 30);

describe('splitsFromTrace', () => {
  it('gives whole-kilometre splits and the leftover stretch', () => {
    const splits = splitsFromTrace(steady(3200), 1000, 3200, 960);
    expect(splits.map((split) => Math.round(split.seconds))).toEqual([300, 300, 300, 60]);
    expect(splits.map((split) => split.partial)).toEqual([false, false, false, true]);
    expect(splits[3].metres).toBeCloseTo(200);
    expect(splits[3].secPerKm).toBeCloseTo(300);
  });

  /* A mile ends between two checkpoints, so its time is read off the line between them. */
  it('interpolates a boundary that falls between two checkpoints', () => {
    const splits = splitsFromTrace(steady(3300), M_PER_MILE, 3300, 990);
    expect(splits[0].seconds).toBeCloseTo(M_PER_MILE * 0.3, 1);
    expect(splits[1].seconds).toBeCloseTo(M_PER_MILE * 0.3, 1);
  });

  it('shows a fast second half as faster', () => {
    const trace = [...steady(1000), ...Array.from({ length: 10 }, (_, i) => 300 + (i + 1) * 25)];
    const splits = splitsFromTrace(trace, 1000, 2000, 550);
    expect(splits[1].seconds).toBeLessThan(splits[0].seconds);
  });

  /* Spreading the average across every mile would show an evenly paced run nobody ran. */
  it('gives no splits at all for a run with no trace', () => {
    expect(splitsFromTrace([], 1000, 5000, 1500)).toEqual([]);
  });

  it('leaves off a tail too short to mean anything', () => {
    const splits = splitsFromTrace(steady(2030), 1000, 2030, 609);
    expect(splits).toHaveLength(2);
  });

  it('refuses nonsense totals rather than dividing by them', () => {
    expect(splitsFromTrace(steady(1000), 1000, 0, 300)).toEqual([]);
    expect(splitsFromTrace(steady(1000), 1000, 1000, 0)).toEqual([]);
  });
});

describe('storing a series', () => {
  it('survives the trip to text and back', () => {
    expect(decodeSeries(encodeSeries([30, 61, 0, 145]))).toEqual([30, 61, 0, 145]);
  });

  it('rounds, since the trace is whole seconds and the heart rate whole beats', () => {
    expect(encodeSeries([29.6, 60.2])).toBe('30,60');
  });

  it('reads absent or damaged text as nothing rather than failing', () => {
    expect(decodeSeries(undefined)).toEqual([]);
    expect(decodeSeries('')).toEqual([]);
    expect(decodeSeries('140,x,150')).toEqual([140, 0, 150]);
  });
});

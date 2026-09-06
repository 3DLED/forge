/**
 * Structured runs — intervals, tempo blocks, a warm-up on the front.
 *
 * The case worth checking hardest is a plan that mixes currencies: a warm-up that ends on the
 * clock followed by an 800 that ends on the ground. Where the 800 starts depends on how far you
 * got in five minutes, which is not in the plan, which is why the cursor exists at all.
 */

import { describe, expect, it } from 'vitest';
import {
  advanceRun,
  describeNext,
  describeSegment,
  isFinished,
  runProgress,
  startRun,
  type RunPlan,
  type RunSegment,
} from './runPlan';

const seg = (over: Partial<RunSegment>): RunSegment => ({ kind: 'work', ...over });

/** Four times eight hundred with four hundred float, warm-up and cool-down either end. */
const intervals: RunPlan = {
  name: '4 × 800',
  segments: [
    seg({ kind: 'warmup', durationSec: 300, targetSecPerKm: 390 }),
    ...Array.from({ length: 4 }, () => [
      seg({ kind: 'work', distanceM: 800, targetSecPerKm: 270 }),
      seg({ kind: 'recovery', distanceM: 400, targetSecPerKm: 420 }),
    ]).flat(),
    seg({ kind: 'cooldown', durationSec: 300, targetSecPerKm: 400 }),
  ],
};

const run = (plan: RunPlan, distanceM: number, elapsedSec: number, cursor = startRun()) =>
  advanceRun({ plan, cursor, distanceM, elapsedSec });

describe('walking a plan', () => {
  it('starts on the first segment', () => {
    const progress = runProgress(intervals, startRun(), 0, 0);
    expect(progress.segment?.kind).toBe('warmup');
    expect(progress.finished).toBe(false);
  });

  it('stays put while the segment is still running', () => {
    const change = run(intervals, 600, 200);
    expect(change.entering).toBeNull();
    expect(change.cursor.index).toBe(0);
  });

  it('moves on when a timed segment runs out', () => {
    const change = run(intervals, 1100, 300);
    expect(change.leaving?.kind).toBe('warmup');
    expect(change.entering?.distanceM).toBe(800);
  });

  it('moves on when a distance segment is covered', () => {
    const after = run(intervals, 1100, 300);
    const change = run(intervals, 1900, 520, after.cursor);

    expect(change.leaving?.kind).toBe('work');
    expect(change.entering?.kind).toBe('recovery');
  });

  /**
   * The wrinkle the cursor exists for. The warm-up ends on the clock, so where the first 800
   * begins depends on how far you happened to get in those five minutes — 1100 m here, which
   * is nowhere in the plan.
   */
  it('starts a distance segment from wherever the timed one actually ended', () => {
    const change = run(intervals, 1100, 300);
    expect(change.cursor.fromM).toBe(1100);
    expect(change.cursor.fromSec).toBe(300);
  });

  /**
   * On a ladder of eight, handing the overshoot to the next segment compounds all the way
   * down: every rep starts a little late and the last one is out by most of a rep.
   */
  it('starts the next rep at the boundary, not where the fix landed', () => {
    const after = run(intervals, 1100, 300);
    // The fix arrives 60 m past the end of the 800.
    const change = run(intervals, 1960, 540, after.cursor);

    expect(change.cursor.fromM).toBe(1900);
  });

  it('reports what is left of the segment in its own currency', () => {
    const after = run(intervals, 1100, 300);
    const progress = runProgress(intervals, after.cursor, 1500, 420);

    expect(progress.remainingM).toBe(400);
    expect(progress.remainingSec).toBeNull();
  });

  /* Several boundaries can fall due at once after a tunnel or a backlog of buffered fixes. */
  it('crosses one boundary per call', () => {
    const after = run(intervals, 1100, 300);
    const change = run(intervals, 4000, 1200, after.cursor);

    expect(change.cursor.index).toBe(2);
  });

  it('reports how the finished segment actually went', () => {
    const change = run(intervals, 1100, 300);
    expect(change.covered).toEqual({ distanceM: 1100, seconds: 300 });
  });
});

describe('reaching the end', () => {
  const short: RunPlan = { name: 'Out and back', segments: [seg({ distanceM: 1000 })] };

  it('knows when the plan is done', () => {
    const change = run(short, 1000, 300);
    expect(change.finished).toBe(true);
    expect(change.entering).toBeNull();
    expect(isFinished(short, change.cursor)).toBe(true);
  });

  it('does nothing once it is done', () => {
    const done = run(short, 1000, 300);
    const after = run(short, 5000, 1800, done.cursor);

    expect(after.cursor).toBe(done.cursor);
    expect(after.entering).toBeNull();
  });

  /* A segment with neither a distance nor a time runs until something else stops it. */
  it('never ends an open-ended segment on its own', () => {
    const open: RunPlan = { name: 'Just run', segments: [seg({ kind: 'steady' })] };
    expect(run(open, 20_000, 7200).entering).toBeNull();
  });
});

describe('saying what is coming', () => {
  it('gives the instruction, not a set of fields', () => {
    expect(describeSegment(seg({ distanceM: 800, targetSecPerKm: 270 }), 'metric')).toBe(
      'Run 800 metres at 4:30 /km',
    );
  });

  it('speaks in the units you use', () => {
    const said = describeSegment(seg({ distanceM: 1609.344, targetSecPerKm: 300 }), 'imperial');
    expect(said).toContain('1 mile');
    expect(said).toContain('/mi');
  });

  it('says minutes for a timed segment', () => {
    expect(describeSegment(seg({ kind: 'warmup', durationSec: 300 }), 'metric')).toBe(
      'Warm up 5 minutes',
    );
  });

  it('leaves the pace out when the segment does not set one', () => {
    expect(describeSegment(seg({ kind: 'recovery', distanceM: 400 }), 'metric')).toBe(
      'Recover 400 metres',
    );
  });

  it('uses a label when one was written', () => {
    expect(describeSegment(seg({ distanceM: 400, label: 'Strides' }), 'metric')).toBe('Strides');
  });

  it('names the next one as it starts', () => {
    const change = run(intervals, 1100, 300);
    expect(describeNext(change.entering, 'metric')).toBe('Next, run 800 metres at 4:30 /km');
  });

  it('says so at the end rather than naming nothing', () => {
    expect(describeNext(null, 'metric')).toBe('Last one done');
  });
});

describe('a whole session of intervals', () => {
  /**
   * The shape of an actual outing: a warm-up on the clock, four reps and four floats on the
   * ground, a cool-down on the clock. What matters is that the reps alternate correctly and
   * the count comes out right, which is the thing a compounding boundary error breaks.
   */
  it('alternates work and recovery all the way down the ladder', () => {
    let cursor = startRun();
    const entered: string[] = [];

    let distance = 0;
    let seconds = 0;

    // Warm-up: five minutes, covering 1100 m.
    distance = 1100;
    seconds = 300;
    let change = advanceRun({ plan: intervals, cursor, distanceM: distance, elapsedSec: seconds });
    cursor = change.cursor;
    if (change.entering) entered.push(change.entering.kind);

    // Four reps and four floats, each covered at a plausible speed.
    for (let rep = 0; rep < 4; rep += 1) {
      distance += 800;
      seconds += 216;
      change = advanceRun({ plan: intervals, cursor, distanceM: distance, elapsedSec: seconds });
      cursor = change.cursor;
      if (change.entering) entered.push(change.entering.kind);

      distance += 400;
      seconds += 168;
      change = advanceRun({ plan: intervals, cursor, distanceM: distance, elapsedSec: seconds });
      cursor = change.cursor;
      if (change.entering) entered.push(change.entering.kind);
    }

    expect(entered).toEqual([
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'cooldown',
    ]);
  });
});

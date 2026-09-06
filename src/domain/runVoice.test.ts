/**
 * The wording. Almost all of the risk in this file is in what a sentence *omits* — a split
 * that reports a pace with no idea where you are, a drift cue that says you are off pace
 * without saying which way.
 */

import { describe, expect, it } from 'vitest';
import { sayChange, sayDrift, saySplit, sayStart, speakable, splitPlace } from './runVoice';
import { buildRunPlan, advanceRun, describeSegment, startRun, type RunPlan } from './runPlan';
import type { PaceReading, SplitCue } from './pace';

const cue = (over: Partial<SplitCue> = {}): SplitCue => ({
  index: 3,
  splitSecPerKm: 300,
  offSecPerKm: null,
  kind: 'onPace',
  ...over,
});

const reading = (paceSecPerKm: number | null): PaceReading => ({
  speedMps: paceSecPerKm ? 1000 / paceSecPerKm : null,
  paceSecPerKm,
  distanceM: 2000,
  moving: paceSecPerKm != null,
  discarded: 0,
});

describe('where a split lands', () => {
  it('counts whole miles and kilometres', () => {
    expect(splitPlace(3, 'mile')).toBe('Mile 3');
    expect(splitPlace(3, 'km')).toBe('Kilometre 3');
  });

  /* "Half-mile number five" is a sum. "Two and a half miles" is a place you are standing. */
  it('reports the distance reached for fractions rather than counting them', () => {
    expect(splitPlace(5, 'halfMile')).toBe('2.5 miles');
    expect(splitPlace(3, 'quarterMile')).toBe('0.75 miles');
    expect(splitPlace(3, 'halfKm')).toBe('1.5 kilometres');
  });

  it('says mile, not miles, at one', () => {
    expect(splitPlace(2, 'halfMile')).toBe('1 mile');
  });
});

describe('a split cue', () => {
  it('says where you are before it says how it went', () => {
    const said = saySplit({ cue: cue(), interval: 'mile', units: 'imperial' });
    expect(said.startsWith('Mile 3')).toBe(true);
    expect(said).toContain('/mi');
  });

  it('says how far off in seconds, and which way', () => {
    const slow = saySplit({ cue: cue({ offSecPerKm: 20, kind: 'tooSlow' }), interval: 'km', units: 'metric' });
    expect(slow).toContain('20 seconds slow');

    const fast = saySplit({ cue: cue({ offSecPerKm: -20, kind: 'tooFast' }), interval: 'km', units: 'metric' });
    expect(fast).toContain('20 seconds fast');
  });

  /*
   * Forty seconds a kilometre is sixty-four a mile. Reporting the metric figure beside an
   * imperial pace invites a runner to make up the wrong amount of time.
   */
  it('states how far off in the same unit as the pace beside it', () => {
    const said = saySplit({ cue: cue({ offSecPerKm: 40, kind: 'tooSlow' }), interval: 'mile', units: 'imperial' });
    expect(said).toContain('64 seconds slow');
  });

  it('says nothing about a target when there was not one', () => {
    const said = saySplit({ cue: cue(), interval: 'km', units: 'metric' });
    expect(said).not.toContain('slow');
    expect(said).not.toContain('fast');
    expect(said).not.toContain('on pace');
  });

  /* Total time is worth hearing at the mile. Every quarter it is just more words. */
  it('adds elapsed time only at whole units', () => {
    expect(saySplit({ cue: cue(), interval: 'mile', units: 'imperial', elapsedSec: 1500 })).toContain('25:00');
    expect(saySplit({ cue: cue(), interval: 'quarterMile', units: 'imperial', elapsedSec: 1500 })).not.toContain(
      '25:00',
    );
  });

  /* At mile one the total and the split are the same number, said twice. */
  it('leaves the total off the first one', () => {
    const said = saySplit({ cue: cue({ index: 1 }), interval: 'mile', units: 'imperial', elapsedSec: 533 });
    expect(said).toBe('Mile 1 · 8:03 /mi');
  });
});

describe('a drift cue', () => {
  it('leads with what to do about it', () => {
    const said = sayDrift({
      kind: 'tooSlow',
      reading: reading(320),
      target: { targetSecPerKm: 300, toleranceSecPerKm: 15 },
      units: 'metric',
    });
    expect(said.startsWith('Pick it up')).toBe(true);
    expect(said).toContain('20 seconds slow');
  });

  it('states the drift in the unit on screen too', () => {
    const said = sayDrift({
      kind: 'tooSlow',
      reading: reading(340),
      target: { targetSecPerKm: 300, toleranceSecPerKm: 15 },
      units: 'imperial',
    });
    expect(said).toContain('64 seconds slow');
  });

  it('tells you to ease back when you are ahead of it', () => {
    const said = sayDrift({
      kind: 'tooFast',
      reading: reading(280),
      target: { targetSecPerKm: 300, toleranceSecPerKm: 15 },
      units: 'metric',
    });
    expect(said.startsWith('Ease back')).toBe(true);
  });

  it('does not tell you to fix anything once you are back', () => {
    const said = sayDrift({
      kind: 'backOnPace',
      reading: reading(300),
      target: { targetSecPerKm: 300, toleranceSecPerKm: 15 },
      units: 'metric',
    });
    expect(said).toContain('Back on pace');
    expect(said).not.toContain('seconds');
  });
});

describe('a segment change', () => {
  const tempo = buildRunPlan({
    kind: 'tempo',
    warmupSec: 300,
    distanceM: 3000,
    targetSecPerKm: 250,
    cooldownSec: 300,
  })!;

  it('reports the piece just run, then the one starting', () => {
    const first = advanceRun({ plan: tempo, cursor: startRun(), distanceM: 1000, elapsedSec: 300 });
    const said = sayChange(first, 'metric');

    expect(said).toContain('1 kilometre');
    expect(said).toContain('Next, run 3 kilometres at 4:10 /km');
  });

  /* A five minute warm-up took five minutes. Saying so is filler. */
  it('leaves the time off a piece that was measured in time', () => {
    const first = advanceRun({ plan: tempo, cursor: startRun(), distanceM: 1000, elapsedSec: 300 });
    expect(sayChange(first, 'metric')).not.toContain(' in ');
  });

  /*
   * Where you got to in five minutes is a measurement, not a prescription — so it is read
   * back as one. "1591 metres" is nobody's cool-down.
   */
  it('reads a timed piece back as a measured distance, not as a rep', () => {
    const imperial = advanceRun({ plan: tempo, cursor: startRun(), distanceM: 1591, elapsedSec: 300 });
    expect(sayChange(imperial, 'imperial')).toContain('0.99 miles');
  });

  /* A rep, by contrast, finishes on its own number and is said in the words it was set in. */
  it('reads a distance piece back in the words it was written in', () => {
    const reps = buildRunPlan({
      kind: 'intervals',
      warmupSec: 0,
      reps: 2,
      workM: 800,
      workSecPerKm: 270,
      floatM: 400,
      floatSecPerKm: 420,
      cooldownSec: 0,
    })!;
    const first = advanceRun({ plan: reps, cursor: startRun(), distanceM: 810, elapsedSec: 216 });
    expect(sayChange(first, 'imperial')).toContain('800 metres in 3:36');
  });

  it('times a piece that was measured on the ground', () => {
    const first = advanceRun({ plan: tempo, cursor: startRun(), distanceM: 1000, elapsedSec: 300 });
    const second = advanceRun({ plan: tempo, cursor: first.cursor, distanceM: 4000, elapsedSec: 1050 });
    expect(sayChange(second, 'metric')).toContain('in 12:30');
  });

  it('says nothing when nothing changed', () => {
    const still = advanceRun({ plan: tempo, cursor: startRun(), distanceM: 400, elapsedSec: 120 });
    expect(sayChange(still, 'metric')).toBeNull();
  });

  it('says the session is over rather than naming the next one', () => {
    let change = advanceRun({ plan: tempo, cursor: startRun(), distanceM: 1000, elapsedSec: 300 });
    change = advanceRun({ plan: tempo, cursor: change.cursor, distanceM: 4000, elapsedSec: 1050 });
    change = advanceRun({ plan: tempo, cursor: change.cursor, distanceM: 5000, elapsedSec: 1350 });
    expect(sayChange(change, 'metric')).toContain('done');
  });
});

describe('saying it out loud', () => {
  /*
   * A speech engine reads "11:00" as a time of day, so an eleven minute mile came out of the
   * phone as "eleven o'clock per mile". Nothing this app says on a run is a clock time.
   */
  it('says durations as durations, not as times of day', () => {
    expect(speakable('Steady 5 miles at 11:00 /mi')).toBe(
      'Steady 5 miles at 11 minutes per mile',
    );
    expect(speakable('800 metres in 3:29')).toBe('800 metres in 3 minutes 29 seconds');
    expect(speakable('0:45 to go')).toBe('45 seconds to go');
    expect(speakable('1:04:15')).toBe('1 hour 4 minutes 15 seconds');
    expect(speakable('1:01')).toBe('1 minute 1 second');
  });

  it('expands what reads well but speaks badly', () => {
    expect(speakable('Run 800 metres at 4:30 /km')).toBe(
      'Run 800 metres at 4 minutes 30 seconds per kilometre',
    );
    expect(speakable('Mile 3 · 8:14 /mi')).toBe('Mile 3. 8 minutes 14 seconds per mile');
    expect(speakable('Mile 3 · on pace')).toBe('Mile 3. On pace');
    // A decimal point is not a sentence boundary, and has no space to say so.
    expect(speakable('1.03 miles · next')).toBe('1.03 miles. Next');
    expect(speakable('4 × 800')).toBe('4 by 800');
  });

  it('opens the run with the first instruction', () => {
    const plan: RunPlan | null = buildRunPlan({
      kind: 'intervals',
      warmupSec: 600,
      reps: 4,
      workM: 800,
      workSecPerKm: 270,
      floatM: 400,
      floatSecPerKm: 420,
      cooldownSec: 300,
    });
    expect(sayStart(plan!.segments[0], 'metric')).toBe('Warm up 10 minutes');
  });

  it('has something to say for an unstructured run', () => {
    expect(sayStart(null, 'metric')).toBe('Run started');
  });
});

describe('building a plan from a handful of numbers', () => {
  it('leaves an open run without one', () => {
    expect(buildRunPlan({ kind: 'open' })).toBeNull();
  });

  /* Nine segments, not ten: four reps, three floats between them, warm-up and cool-down. */
  it('does not put a recovery after the last rep', () => {
    const plan = buildRunPlan({
      kind: 'intervals',
      warmupSec: 600,
      reps: 4,
      workM: 800,
      workSecPerKm: 270,
      floatM: 400,
      floatSecPerKm: 420,
      cooldownSec: 300,
    })!;

    expect(plan.segments.map((s) => s.kind)).toEqual([
      'warmup',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'cooldown',
    ]);
    expect(plan.name).toBe('4 × 800 m');
  });

  it('skips a warm-up or cool-down set to nothing', () => {
    const plan = buildRunPlan({
      kind: 'tempo',
      warmupSec: 0,
      distanceM: 5000,
      targetSecPerKm: 250,
      cooldownSec: 0,
    })!;
    expect(plan.segments).toHaveLength(1);
  });

  it('refuses a steady run with neither a distance nor a time', () => {
    expect(buildRunPlan({ kind: 'steady' }, 300)).toBeNull();
  });

  /*
   * A steady run has one pace, and it is the target pace the alerts and splits already use.
   * Storing a second one on the shape gave the screen two fields for the same number, only
   * one of which did anything.
   */
  it('runs a steady piece at the target it is handed', () => {
    const plan = buildRunPlan({ kind: 'steady', distanceM: 8000 }, 330)!;
    expect(plan.segments[0].targetSecPerKm).toBe(330);
    expect(describeSegment(plan.segments[0], 'metric')).toBe('Steady 8 kilometres at 5:30 /km');
  });

  it('leaves a steady piece unpaced when there is no target to hand', () => {
    const plan = buildRunPlan({ kind: 'steady', distanceM: 8000 })!;
    expect(plan.segments[0].targetSecPerKm).toBeUndefined();
  });
});

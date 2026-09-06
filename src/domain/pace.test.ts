/**
 * Pace, and knowing when to keep quiet.
 *
 * The measurement is checked against the failure modes GPS actually has — a reflection off a
 * building, a fix with no speed on it, standing at a crossing — rather than against a clean
 * signal it will never see. The cue rules are checked against the ways a running app becomes
 * annoying, which is the thing that decides whether the feature stays switched on.
 */

import { describe, expect, it } from 'vitest';
import {
  M_PER_MILE,
} from './units';
import {
  MIN_GAP_MS,
  REPEAT_MS,
  WARMUP_MS,
  decideCue,
  medianSpeed,
  metresBetween,
  readPace,
  speedOf,
  usable,
  type CueState,
  type Fix,
  SPLIT_INTERVALS,
  decideSplit,
  startSplits,
  type PaceTarget,
  type SplitState,
} from './pace';

const fix = (over: Partial<Fix> = {}): Fix => ({
  at: 0,
  lat: 51.5,
  lon: -0.12,
  accuracy: 5,
  speed: 3,
  ...over,
});

/** A steady run: one fix a second, all reporting the same speed. */
const steady = (speedMps: number, count: number, from = 0): Fix[] =>
  Array.from({ length: count }, (_, i) => fix({ at: from + i * 1000, speed: speedMps }));

describe('measuring the ground', () => {
  it('gives roughly a hundred metres for a hundred metres', () => {
    // A thousandth of a degree of latitude is about 111 m.
    const a = fix({ lat: 51.5 });
    const b = fix({ lat: 51.501 });
    expect(metresBetween(a, b)).toBeGreaterThan(100);
    expect(metresBetween(a, b)).toBeLessThan(120);
  });

  it('is zero for the same place', () => {
    expect(metresBetween(fix(), fix())).toBe(0);
  });
});

describe('which fixes are worth keeping', () => {
  it('keeps an accurate one', () => {
    expect(usable(fix({ accuracy: 5 }))).toBe(true);
  });

  /* Thirty metres is a city block — smoothing that in moves the pace more than a hill would. */
  it('drops one that could be a block away', () => {
    expect(usable(fix({ accuracy: 80 }))).toBe(false);
  });

  it('keeps one that did not report its accuracy', () => {
    expect(usable(fix({ accuracy: null }))).toBe(true);
  });

  it('drops nonsense coordinates', () => {
    expect(usable(fix({ lat: Number.NaN }))).toBe(false);
  });
});

describe('where the speed comes from', () => {
  /* The receiver's own figure is Doppler-derived, not differenced — a better measurement. */
  it('prefers what the receiver reported', () => {
    const previous = fix({ at: 0, lat: 51.5 });
    const current = fix({ at: 1000, lat: 51.6, speed: 3 });

    // Differencing these two would give kilometres per second.
    expect(speedOf(current, previous)).toBe(3);
  });

  it('falls back to differencing when there is no speed', () => {
    const previous = fix({ at: 0, lat: 51.5, speed: null });
    const current = fix({ at: 10_000, lat: 51.501, speed: null });

    const derived = speedOf(current, previous)!;
    expect(derived).toBeGreaterThan(10);
    expect(derived).toBeLessThan(12);
  });

  /* Some receivers say -1 rather than null, and a number sails straight through a null check. */
  it('treats a negative speed as no speed at all', () => {
    const previous = fix({ at: 0, lat: 51.5 });
    const current = fix({ at: 10_000, lat: 51.501, speed: -1 });

    expect(speedOf(current, previous)).toBeGreaterThan(10);
  });

  it('gives nothing for the very first fix with no speed on it', () => {
    expect(speedOf(fix({ speed: null }))).toBeNull();
  });

  it('does not divide by a zero interval', () => {
    const same = fix({ at: 1000, speed: null });
    expect(speedOf(same, fix({ at: 1000, speed: null }))).toBeNull();
  });
});

describe('smoothing', () => {
  it('takes the middle value', () => {
    expect(medianSpeed([1, 2, 9])).toBe(2);
  });

  it('averages the middle pair when there is no single middle', () => {
    expect(medianSpeed([1, 2, 4, 9])).toBe(3);
  });

  it('has nothing to say about an empty window', () => {
    expect(medianSpeed([])).toBeNull();
  });

  /**
   * The case a mean would fail. A reflection off a building reporting thirty metres a second
   * is not a gentle outlier, and averaging it in would report a sprint mid-jog.
   */
  it('ignores one wild reading entirely', () => {
    const fixes = [...steady(3, 10), fix({ at: 10_000, speed: 30 })];
    const reading = readPace(fixes, 10_000);

    expect(reading.speedMps).toBe(3);
  });
});

describe('reading a pace', () => {
  it('reports seconds per kilometre from the smoothed speed', () => {
    const reading = readPace(steady(3.333, 10), 10_000);
    // 3.333 m/s is a five minute kilometre.
    expect(reading.paceSecPerKm).toBeGreaterThan(295);
    expect(reading.paceSecPerKm).toBeLessThan(305);
  });

  /* Standing at a crossing is not a very slow run, and must not be reported as one. */
  it('says nothing about pace while stopped', () => {
    const reading = readPace(steady(0.1, 10), 10_000);

    expect(reading.moving).toBe(false);
    expect(reading.paceSecPerKm).toBeNull();
  });

  it('only smooths over the recent window', () => {
    const old = steady(10, 5, 0);
    const recent = steady(3, 5, 60_000);
    const reading = readPace([...old, ...recent], 64_000);

    expect(reading.speedMps).toBe(3);
  });

  it('counts distance from the fixes it kept', () => {
    const reading = readPace(
      [fix({ at: 0, lat: 51.5 }), fix({ at: 1000, lat: 51.501 })],
      1000,
    );

    expect(reading.distanceM).toBeGreaterThan(100);
  });

  it('reports how many fixes it threw away', () => {
    const reading = readPace([fix({ accuracy: 5 }), fix({ accuracy: 500 })], 0);
    expect(reading.discarded).toBe(1);
  });

  it('has nothing to say before any fixes arrive', () => {
    expect(readPace([], 0)).toMatchObject({ speedMps: null, paceSecPerKm: null, moving: false });
  });
});

// --- the half that decides whether anyone keeps it switched on ---------------

const target: PaceTarget = { targetSecPerKm: 300, toleranceSecPerKm: 15 };

const state = (over: Partial<CueState> = {}): CueState => ({
  last: null,
  lastAt: 0,
  startedAt: 0,
  ...over,
});

const reading = (paceSecPerKm: number | null) => ({
  speedMps: paceSecPerKm ? 1000 / paceSecPerKm : 0,
  paceSecPerKm,
  distanceM: 500,
  moving: paceSecPerKm != null,
  discarded: 0,
});

const decide = (paceSecPerKm: number | null, now: number, over: Partial<CueState> = {}) =>
  decideCue({ reading: reading(paceSecPerKm), target, state: state(over), now });

describe('staying quiet', () => {
  /* The receiver is settling and you are accelerating from standing. Both are expected. */
  it('says nothing during the warm-up, however far off the pace is', () => {
    expect(decide(400, WARMUP_MS - 1).kind).toBeNull();
  });

  it('says nothing while stopped', () => {
    expect(decide(null, 200_000).kind).toBeNull();
  });

  it('says nothing when the pace is where it should be', () => {
    expect(decide(300, 200_000).kind).toBeNull();
  });

  it('says nothing inside the tolerance', () => {
    expect(decide(312, 200_000).kind).toBeNull();
  });

  it('leaves a gap between cues however much has changed', () => {
    const soon = decideCue({
      reading: reading(400),
      target,
      state: state({ last: 'tooFast', lastAt: 190_000 }),
      now: 190_000 + MIN_GAP_MS - 1,
    });

    expect(soon.kind).toBeNull();
  });

  /* Being told the same thing every gap is the fastest way to a disabled feature. */
  it('waits longer before repeating a complaint it has already made', () => {
    const again = decideCue({
      reading: reading(400),
      target,
      state: state({ last: 'tooSlow', lastAt: 100_000 }),
      now: 100_000 + REPEAT_MS - 1,
    });

    expect(again.kind).toBeNull();
  });
});

describe('speaking up', () => {
  it('says so when the pace has drifted slow', () => {
    expect(decide(340, 200_000).kind).toBe('tooSlow');
  });

  it('says so when the pace has drifted fast', () => {
    expect(decide(260, 200_000).kind).toBe('tooFast');
  });

  it('repeats a standing complaint once enough time has gone by', () => {
    const again = decideCue({
      reading: reading(400),
      target,
      state: state({ last: 'tooSlow', lastAt: 100_000 }),
      now: 100_000 + REPEAT_MS + 1,
    });

    expect(again.kind).toBe('tooSlow');
  });

  it('switches complaint immediately when you overcorrect', () => {
    const flipped = decideCue({
      reading: reading(250),
      target,
      state: state({ last: 'tooSlow', lastAt: 100_000 }),
      now: 100_000 + MIN_GAP_MS + 1,
    });

    expect(flipped.kind).toBe('tooFast');
  });
});

describe('coming back on pace', () => {
  const after = (paceSecPerKm: number) =>
    decideCue({
      reading: reading(paceSecPerKm),
      target,
      state: state({ last: 'tooSlow', lastAt: 100_000 }),
      now: 100_000 + MIN_GAP_MS + 1,
    });

  it('says you are back once you are properly inside the band', () => {
    expect(after(303).kind).toBe('backOnPace');
  });

  /**
   * The rule that stops it chattering. Leaving the band at the tolerance and returning at the
   * same point means hovering on the boundary produces a cue every time you breathe.
   */
  it('stays quiet while you are only just back inside', () => {
    expect(after(313).kind).toBeNull();
  });

  it('does not announce a return it never left', () => {
    expect(decide(300, 200_000).kind).toBeNull();
  });

  it('does not say it twice', () => {
    const again = decideCue({
      reading: reading(300),
      target,
      state: state({ last: 'backOnPace', lastAt: 100_000 }),
      now: 100_000 + MIN_GAP_MS + 1,
    });

    expect(again.kind).toBeNull();
  });
});

describe('a run, start to finish', () => {
  /**
   * The shape of an actual outing rather than a single decision: quiet at the start, a word
   * when it drifts, quiet while it holds, and a word when it comes back.
   */
  it('speaks four times in twelve minutes of drifting', () => {
    let current = state({ startedAt: 0 });
    const said: (string | null)[] = [];

    // Kept clear of the exact boundaries: a timeline that lands on one tests the comparison
    // operator rather than the behaviour, and reads as a bug the first time either constant
    // is nudged.
    const paces = [
      [10_000, 320], // warm-up: silent
      [60_000, 340], // drifted slow
      [90_000, 345], // still slow, inside the minimum gap
      [140_000, 345], // still slow, inside the repeat window
      [200_000, 345], // still slow, repeat window passed
      [260_000, 301], // properly back
      [320_000, 300], // on pace, nothing to add
      [400_000, 260], // gone too fast
    ] as const;

    for (const [now, pace] of paces) {
      const decision = decideCue({ reading: reading(pace), target, state: current, now });
      current = decision.state;
      said.push(decision.kind);
    }

    expect(said).toEqual([
      null,
      'tooSlow',
      null,
      null,
      'tooSlow',
      'backOnPace',
      null,
      'tooFast',
    ]);
  });
});

/**
 * Splits — cueing on ground covered rather than on a clock.
 *
 * The reason this beats a timer is that it self-gates: stopping at a crossing stops the
 * distance accumulating, so it stops talking without needing a rule about crossings. What the
 * tests below are mostly checking is that a boundary fires once, at the right moment, with the
 * pace of the interval rather than of the instant.
 */
describe('splitting on distance', () => {
  const QUARTER = SPLIT_INTERVALS.quarterMile.metres;

  const at = (distanceM: number, now: number, state: SplitState, target?: PaceTarget) =>
    decideSplit({ distanceM, now, interval: 'quarterMile', state, target });

  it('says nothing before the first boundary', () => {
    expect(at(QUARTER - 1, 60_000, startSplits(0)).cue).toBeNull();
  });

  it('speaks the moment one goes by', () => {
    const { cue } = at(QUARTER + 1, 120_000, startSplits(0));
    expect(cue?.index).toBe(1);
  });

  /* A quarter mile in two minutes is a five minute kilometre, near enough. */
  it('reports the pace of that interval, not of this instant', () => {
    const { cue } = at(QUARTER, 120_000, startSplits(0));

    expect(cue!.splitSecPerKm).toBeGreaterThan(295);
    expect(cue!.splitSecPerKm).toBeLessThan(303);
  });

  it('does not say the same one twice', () => {
    const first = at(QUARTER + 5, 120_000, startSplits(0));
    const again = at(QUARTER + 50, 130_000, first.state);

    expect(first.cue).not.toBeNull();
    expect(again.cue).toBeNull();
  });

  it('counts them up as they go by', () => {
    let state = startSplits(0);
    const indexes: number[] = [];

    for (let i = 1; i <= 4; i += 1) {
      const decision = at(QUARTER * i, 120_000 * i, state);
      state = decision.state;
      if (decision.cue) indexes.push(decision.cue.index);
    }

    expect(indexes).toEqual([1, 2, 3, 4]);
  });

  /**
   * After a tunnel, or when the phone was asleep and the plugin hands over a backlog, two
   * boundaries can arrive at once. Announcing both would be two sentences about ground that is
   * already behind you.
   */
  it('speaks once even when two boundaries arrive together', () => {
    const decision = at(QUARTER * 2 + 10, 240_000, startSplits(0));

    expect(decision.cue?.index).toBe(2);
    expect(decision.state.count).toBe(2);
  });

  /**
   * The next split is measured from the boundary, not from wherever the fix happened to land.
   * Otherwise every later split inherits the same overshoot and they all read slightly wrong.
   */
  it('measures the next one from the boundary it crossed', () => {
    const { state } = at(QUARTER + 80, 120_000, startSplits(0));
    expect(state.atMetres).toBe(QUARTER);
  });

  it('stops talking when you stop moving', () => {
    const { state } = at(QUARTER, 120_000, startSplits(0));
    expect(at(QUARTER, 400_000, state).cue).toBeNull();
  });
});

describe('a split against a target', () => {
  const MILE = SPLIT_INTERVALS.mile.metres;
  const target: PaceTarget = { targetSecPerKm: 300, toleranceSecPerKm: 15 };

  /** Runs a mile in the given number of seconds. */
  const mileIn = (seconds: number) =>
    decideSplit({
      distanceM: MILE,
      now: seconds * 1000,
      interval: 'mile',
      state: startSplits(0),
      target,
    }).cue!;

  it('calls a mile on target on target', () => {
    // 300 s/km over 1.609 km is 483 s.
    expect(mileIn(483).kind).toBe('onPace');
  });

  it('calls a slow one slow, and says by how much', () => {
    const cue = mileIn(540);
    expect(cue.kind).toBe('tooSlow');
    expect(cue.offSecPerKm).toBeGreaterThan(0);
  });

  it('calls a fast one fast', () => {
    expect(mileIn(430).kind).toBe('tooFast');
  });

  it('says nothing about a target it was not given', () => {
    const cue = decideSplit({
      distanceM: MILE,
      now: 600_000,
      interval: 'mile',
      state: startSplits(0),
    }).cue!;

    expect(cue.offSecPerKm).toBeNull();
    expect(cue.kind).toBe('onPace');
  });
});

describe('the intervals on offer', () => {
  it('covers both ways of measuring a run', () => {
    const imperial = Object.values(SPLIT_INTERVALS).filter((i) => i.units === 'imperial');
    const metric = Object.values(SPLIT_INTERVALS).filter((i) => i.units === 'metric');

    expect(imperial).toHaveLength(3);
    expect(metric).toHaveLength(2);
  });

  it('gets the distances right', () => {
    expect(SPLIT_INTERVALS.mile.metres).toBe(M_PER_MILE);
    expect(SPLIT_INTERVALS.quarterMile.metres).toBeCloseTo(402.336, 2);
    expect(SPLIT_INTERVALS.halfKm.metres).toBe(500);
    expect(SPLIT_INTERVALS.km.metres).toBe(1000);
  });
});

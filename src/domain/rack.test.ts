import { describe, expect, it } from 'vitest';
import { barbellLoads, hasBarbellLoads, type BarbellRack } from './rack';
import { nextLoadAbove, nextLoadBelow } from './equipment';
import { lbToKg } from './units';

const rack = (barKg: number, plates: [number, number][]): BarbellRack => ({
  barKg,
  plates: plates.map(([kg, pairs]) => ({ kg, pairs })),
});

describe('what a bar makes', () => {
  it('offers the bar on its own', () => {
    expect(barbellLoads(rack(20, []))).toEqual([20]);
  });

  /* One pair goes on as two plates, one per side — the doubling is the whole point. */
  it('adds twice each pair, not once', () => {
    expect(barbellLoads(rack(20, [[10, 1]]))).toEqual([20, 40]);
  });

  it('stacks multiple pairs of one denomination', () => {
    expect(barbellLoads(rack(20, [[10, 3]]))).toEqual([20, 40, 60, 80]);
  });

  it('combines denominations', () => {
    expect(barbellLoads(rack(20, [[10, 1], [5, 1]]))).toEqual([20, 30, 40, 50]);
  });

  it('comes back sorted, lightest first', () => {
    const loads = barbellLoads(rack(20, [[2.5, 2], [20, 1], [5, 1]]));
    expect(loads).toEqual([...loads].sort((a, b) => a - b));
  });

  it('has no duplicates when two combinations make the same weight', () => {
    // 2 x 5 kg pairs and 1 x 10 kg pair both make +20.
    const loads = barbellLoads(rack(20, [[5, 2], [10, 1]]));
    expect(loads).toEqual([...new Set(loads)]);
  });

  it('ignores denominations you own none of', () => {
    expect(barbellLoads(rack(20, [[10, 1], [25, 0]]))).toEqual([20, 40]);
  });

  it('ignores a plate with no weight', () => {
    expect(barbellLoads(rack(20, [[0, 4], [10, 1]]))).toEqual([20, 40]);
  });
});

describe('the bench press that started this', () => {
  /**
   * The reported bug: a 3RM test opened at 134.5 lb, which is not a weight anyone loads.
   * A 45 lb bar and a pair of 45s is 135, and that is the number the ladder has to land on.
   */
  it('makes 135 lb out of a 45 lb bar and a pair of 45s', () => {
    const loads = barbellLoads(rack(lbToKg(45), [[lbToKg(45), 2], [lbToKg(25), 2], [lbToKg(10), 2]]));
    const inLb = loads.map((kg) => Math.round(kg / lbToKg(1)));

    expect(inLb).toContain(135);
    expect(inLb).toContain(225);
    expect(inLb).not.toContain(134);
  });

  /* Nothing between 135 and 155 with only 45s and 10s on hand — the gap has to be real. */
  it('does not invent weights the plates cannot make', () => {
    const loads = barbellLoads(rack(lbToKg(45), [[lbToKg(45), 1], [lbToKg(10), 1]]));
    const inLb = loads.map((kg) => Math.round(kg / lbToKg(1)));

    expect(inLb).toEqual([45, 65, 135, 155]);
  });
});

describe('a rack with nothing in it', () => {
  it('is not treated as a constraint', () => {
    expect(hasBarbellLoads(undefined)).toBe(false);
    expect(hasBarbellLoads({ barKg: 0, plates: [] })).toBe(false);
  });

  it('counts as a rack once there is a bar', () => {
    expect(hasBarbellLoads({ barKg: 20, plates: [] })).toBe(true);
  });
});

describe('not hanging on a silly rack', () => {
  it('still returns sorted loads when the combinations run away', () => {
    const absurd = rack(20, [
      [1.25, 8], [2.5, 8], [5, 8], [10, 8], [15, 8], [20, 8], [25, 8],
    ]);
    const loads = barbellLoads(absurd);

    expect(loads.length).toBeGreaterThan(0);
    expect(loads[0]).toBe(20);
    expect(loads).toEqual([...loads].sort((a, b) => a - b));
  });
});

describe('stepping through a rack after a converted weight', () => {
  /**
   * The bug this guards: a weight typed in pounds converts to 102.0582 kg, while the same
   * weight computed by the rack rounds to 102.06. Asking for the next load above the first
   * used to hand back the second — the identical weight, one hundredth of a kilo heavier —
   * so the test ladder stalled on the number you had just lifted.
   */
  const loads = barbellLoads(rack(lbToKg(45), [[lbToKg(45), 2], [lbToKg(25), 1], [lbToKg(10), 1]]));

  it('does not offer the same weight back as a step up', () => {
    const typed = lbToKg(225);
    const next = nextLoadAbove(typed, loads);

    expect(next).toBeDefined();
    expect(Math.round(next! / lbToKg(1))).toBeGreaterThan(225);
  });

  it('does not offer the same weight back as a step down', () => {
    const typed = lbToKg(225);
    const below = nextLoadBelow(typed, loads);

    expect(below).toBeDefined();
    expect(Math.round(below! / lbToKg(1))).toBeLessThan(225);
  });

  it('still steps normally between weights that are genuinely different', () => {
    expect(nextLoadAbove(24, [16, 24, 32])).toBe(32);
    expect(nextLoadBelow(24, [16, 24, 32])).toBe(16);
  });
});

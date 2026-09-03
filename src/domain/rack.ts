/**
 * What you can actually pick up.
 *
 * Everything in this app that prescribes a weight — the load chart, the progression rules,
 * the test ladder — rounds its answer to a real load before showing it. That rounding has
 * been correct for months and had nothing to round to: no screen ever asked which weights you
 * own, so the rack was always empty and every prescription fell through to a generic 2.5 kg
 * step. Which is how a bench press test came to open at 134.5 lb.
 *
 * Two shapes of rack, because they are genuinely different objects:
 *
 * - **Bells.** A kettlebell is a thing you own or do not own. The rack is the list.
 * - **A barbell.** Its loads are *derived*: the bar, plus twice whatever goes on each side.
 *   Nobody owns "135 lb"; they own a 45 lb bar and a pair of 45s, and 135 is what that makes.
 *   Asking for the list directly would be asking the athlete to do this arithmetic by hand
 *   for every combination they own.
 *
 * Standard sizes are offered in both units rather than converted, because bells and plates
 * are manufactured to round numbers in one system or the other. A 24 kg bell converted to
 * pounds is 52.9, which is not a thing anyone has ever bought, and a picker full of numbers
 * like that reads as broken.
 */

/** A pair of plates: what you own, and how many of them. */
export interface PlatePair {
  kg: number;
  /** Pairs owned. One pair goes on as two plates, one per side. */
  pairs: number;
}

export interface BarbellRack {
  barKg: number;
  plates: PlatePair[];
}

/** Guards against a pathological rack generating combinations forever. */
const MAX_COMBINATIONS = 4000;

/** Loads are stored in kilos and compared as numbers; two decimals kills float drift. */
function round2(kg: number): number {
  return Math.round(kg * 100) / 100;
}

/**
 * Every weight a bar can be made into, lightest first.
 *
 * A bounded subset sum over the pairs owned: each denomination contributes nought to `pairs`
 * lots of twice its weight. The bar on its own is always in the list — it is the lightest
 * thing you can pick up, and a warm-up set of it is a real prescription.
 */
export function barbellLoads(rack: BarbellRack): number[] {
  const usable = rack.plates.filter((plate) => plate.kg > 0 && plate.pairs > 0);

  let reachable = new Set<number>([0]);
  for (const plate of usable) {
    const next = new Set<number>();
    for (const base of reachable) {
      for (let n = 0; n <= plate.pairs; n += 1) {
        next.add(round2(base + n * 2 * plate.kg));
      }
    }
    // Stop widening rather than hang; the loads already found are still correct.
    if (next.size > MAX_COMBINATIONS) break;
    reachable = next;
  }

  return [...reachable].map((added) => round2(rack.barKg + added)).sort((a, b) => a - b);
}

/** Whether a rack has anything to say. An empty one must read as "no constraint". */
export function hasBarbellLoads(rack?: BarbellRack): rack is BarbellRack {
  return Boolean(rack && rack.barKg > 0);
}

// --- what people actually own ----------------------------------------------

/**
 * Standard sizes, per unit system.
 *
 * Not conversions of each other. Competition kettlebells run in 4 kg steps; the bells sold by
 * weight in pounds run 18/26/35/44/53, which are approximations of those and not equal to
 * them. Offering the converted list would put 52.9 lb in front of someone whose bell says 53.
 */
export const COMMON_KETTLEBELLS = {
  kg: [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48],
  lb: [5, 10, 15, 18, 20, 26, 30, 35, 44, 53, 62, 70, 79, 88, 106],
} as const;

export const COMMON_DUMBBELLS = {
  kg: [2, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40],
  lb: [5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100],
} as const;

export const COMMON_PLATES = {
  kg: [0.5, 1.25, 2.5, 5, 10, 15, 20, 25],
  lb: [1.25, 2.5, 5, 10, 25, 35, 45],
} as const;

/** Bars, heaviest first — the 20 kg / 45 lb bar is the default everywhere. */
export const COMMON_BARS = {
  kg: [20, 15, 10, 7],
  lb: [45, 35, 25, 15],
} as const;

/** What a new barbell rack starts as: a standard bar and nothing on it. */
export const DEFAULT_BAR_KG = 20;

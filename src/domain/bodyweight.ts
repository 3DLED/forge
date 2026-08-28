/**
 * What you weighed on a given day.
 *
 * Volume for bodyweight movements depends on your bodyweight, which means it depends on *when*
 * — and using today's figure for every session in the chart would quietly rewrite history. Put
 * on ten pounds and last spring's push-up sessions would all get heavier retroactively, which
 * is exactly the kind of silent revision that makes a trend chart untrustworthy.
 *
 * So each session is valued at the most recent weigh-in on or before its own date. Sessions
 * older than your first weigh-in fall back to the current figure, since guessing backwards is
 * worse than admitting the number is approximate.
 */

import type { BodyMetric, DayKey } from './types';

export interface BodyweightLookup {
  /** Kilograms on that day, or undefined when nothing is known at all. */
  at(date: DayKey): number | undefined;
  /** The most recent weigh-in, whenever it was. */
  latest: number | undefined;
  latestDate: DayKey | undefined;
  entries: { date: DayKey; kg: number }[];
}

export function bodyweightLookup(
  metrics: BodyMetric[],
  fallbackKg?: number,
): BodyweightLookup {
  const entries = metrics
    .filter((m) => m.kind === 'bodyweightKg' && !m.deletedAt)
    .map((m) => ({ date: m.date, kg: m.value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = entries.at(-1);

  return {
    entries,
    latest: latest?.kg ?? fallbackKg,
    latestDate: latest?.date,
    at(date: DayKey) {
      // Walk back to the last weigh-in that had happened by then.
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].date <= date) return entries[i].kg;
      }
      return latest?.kg ?? fallbackKg;
    },
  };
}

/** An empty lookup, for the many callers that do not have the history to hand. */
export const NO_BODYWEIGHT: BodyweightLookup = {
  entries: [],
  latest: undefined,
  latestDate: undefined,
  at: () => undefined,
};

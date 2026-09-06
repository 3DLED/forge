/**
 * What the app is allowed to say on a run, and when.
 *
 * Three switches that people genuinely disagree about, kept separate because turning one off
 * should not silence the others. Someone running to a plan wants the segment calls and nothing
 * else. Someone doing an easy hour wants their mile splits and would throw the phone at a wall
 * if it said "pick it up". Lumping these under one "voice coaching" toggle means the second
 * person turns off the first person's feature to get rid of the third person's.
 *
 * Lives on the profile rather than per run: these are preferences about how you like to be
 * talked to, and re-answering them in a car park before every outing is how a feature stops
 * being used.
 */

import { SPLIT_INTERVALS, type SplitUnit } from './pace';
import type { RunShape } from './runPlan';
import type { UnitSystem } from './types';

export interface RunSettings {
  /**
   * Whether anything is spoken at all.
   *
   * A master switch above the three below, because there is one situation — a race, a group
   * run, a track session with a coach shouting — where you want the tracking and none of the
   * talking, and hunting three toggles to get there is a poor answer.
   */
  voice: boolean;
  /** Announce each interval as it goes by. The one most people keep on. */
  splits: boolean;
  splitUnit: SplitUnit;
  /**
   * Complain when you drift off a target pace and stay off it.
   *
   * Useless without a target, which is why the target sits beside it rather than in some
   * other section — the switch and the number it needs are one decision.
   */
  paceAlerts: boolean;
  targetSecPerKm?: number;
  /** How far off target counts as off target. See `decideCue`. */
  toleranceSecPerKm: number;
  /** Call each segment of a structured run as it starts. */
  segmentCues: boolean;
  /** The shape last built here, reused until it is changed. */
  shape?: RunShape;
}

/** Fifteen seconds a kilometre — about a nine second mile, which is a real drift, not noise. */
export const DEFAULT_TOLERANCE_SEC_PER_KM = 15;

/** Whole miles or whole kilometres, matching whatever the rest of the app is showing. */
export function defaultSplitUnit(units: UnitSystem): SplitUnit {
  return units === 'imperial' ? 'mile' : 'km';
}

/**
 * The settings as they stand, with anything unanswered filled in.
 *
 * Pace alerts default off because they are the only one of the three that needs a number
 * before it can say anything true, and a coaching cue built on a target nobody set is worse
 * than silence.
 */
export function runSettingsFor(units: UnitSystem, stored?: RunSettings): RunSettings {
  return {
    voice: stored?.voice ?? true,
    splits: stored?.splits ?? true,
    splitUnit: stored?.splitUnit ?? defaultSplitUnit(units),
    paceAlerts: stored?.paceAlerts ?? false,
    targetSecPerKm: stored?.targetSecPerKm,
    toleranceSecPerKm: stored?.toleranceSecPerKm ?? DEFAULT_TOLERANCE_SEC_PER_KM,
    segmentCues: stored?.segmentCues ?? true,
    shape: stored?.shape ?? { kind: 'open' },
  };
}

/** Whether pace alerts can actually fire — the switch is on and there is something to aim at. */
export function alertsArmed(settings: RunSettings): boolean {
  return settings.paceAlerts && settings.targetSecPerKm != null && settings.targetSecPerKm > 0;
}

/** One line for the row that opens this screen: "Every mile · pace alerts on". */
export function describeRunSettings(settings: RunSettings): string {
  if (!settings.voice) return 'Silent';

  const parts: string[] = [];
  if (settings.splits) parts.push(SPLIT_INTERVALS[settings.splitUnit].label);
  if (alertsArmed(settings)) parts.push('pace alerts');
  if (parts.length === 0) return 'Nothing spoken';
  return parts.join(' · ');
}

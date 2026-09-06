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
import type { RunKind, RunShape } from './runPlan';
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
  /**
   * The last structure set up for each kind of run, kept apart from each other.
   *
   * One shape for everything was wrong in both directions: setting up a track session left
   * Sunday's long run prescribing four by eight hundred, and an easy run offering a rep count
   * is a question with no answer. Keyed by kind rather than by movement so that "my usual
   * interval session" survives switching between Interval Run and Hill Repeats, which is the
   * same session on a different surface.
   */
  shapes?: Partial<Record<RunKind, RunShape>>;
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
    shapes: stored?.shapes ?? {},
  };
}

/** What this kind of run is set up to be today. Unstructured until somebody says otherwise. */
export function shapeFor(settings: RunSettings, kind: RunKind): RunShape {
  return settings.shapes?.[kind] ?? { kind: 'open' };
}

/** Stores one kind's structure without disturbing the other two. */
export function withShape(settings: RunSettings, kind: RunKind, shape: RunShape): RunSettings {
  return { ...settings, shapes: { ...settings.shapes, [kind]: shape } };
}

/**
 * Whether pace alerts can actually fire — the switch is on and there is something to aim at.
 *
 * `segmentHasTarget` covers the structured case: a rep prescribed at 4:30 supplies its own
 * number, so the standing target need not be set for alerts to mean something. The switch
 * still governs, because off has to mean off.
 */
export function alertsArmed(settings: RunSettings, segmentHasTarget = false): boolean {
  if (!settings.paceAlerts) return false;
  if (segmentHasTarget) return true;
  return settings.targetSecPerKm != null && settings.targetSecPerKm > 0;
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

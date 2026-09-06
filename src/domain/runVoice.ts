/**
 * What the app actually says on a run.
 *
 * Kept apart from the engines that decide *whether* to say something, because the two fail
 * differently and are fixed by different people. `pace.ts` is arithmetic and gating; this is
 * language, and language is what you end up rewriting after the first outing, when it turns
 * out that "off pace by twelve" means nothing at eight miles in.
 *
 * Three rules run through all of it:
 *
 * 1. **Where you are, then how it went.** "Mile three" first. That is the part a runner is
 *    waiting for, and it is the part that survives being half-heard through a headphone.
 * 2. **Seconds, not percentages.** Nobody adjusts by four percent. "Six seconds slow" is a
 *    number you can act on inside the next hundred metres.
 * 3. **Screens and speech want different strings.** "4:30 /km" reads correctly and speaks
 *    as "four thirty slash km", so anything going to the speech engine goes through
 *    `speakable` first. Same sentence, two renderings, one place to change it.
 */

import { M_PER_KM, M_PER_MILE, displayPace, formatClock, formatDistance, formatPace } from './units';
import { SPLIT_INTERVALS, type CueKind, type PaceReading, type PaceTarget, type SplitCue, type SplitUnit } from './pace';
import { describeSegment, distanceWords, type RunSegment, type SegmentChange } from './runPlan';
import type { UnitSystem } from './types';

/**
 * The same sentence, said rather than shown.
 *
 * Abbreviations that read cleanly are exactly the ones a speech engine mangles, and the fix
 * is not to drop them from the screen — it is to expand them on the way out.
 */
export function speakable(text: string): string {
  return text
    .replace(/\/km/g, 'per kilometre')
    .replace(/\/mi/g, 'per mile')
    .replace(/×/g, 'by')
    // The separator is a full stop in speech, not a word — " · " would leave a stray one
    // floating between two spaces, which some engines read aloud as "dot".
    .replace(/ · /g, '. ')
    .replace(/·/g, '.');
}

/** "1.5" rather than "1.50", and "1" rather than "1.0". */
function trim(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * Where the split lands, in the words a runner would use.
 *
 * Whole miles and kilometres get counted — "mile three" — because that is how the distance is
 * spoken about. The fractions do not: "half-mile number five" is a sum, where "two and a half
 * miles" is a place. So the whole units count, and the fractions report the distance reached.
 */
export function splitPlace(index: number, interval: SplitUnit): string {
  if (interval === 'mile') return `Mile ${index}`;
  if (interval === 'km') return `Kilometre ${index}`;

  const metres = SPLIT_INTERVALS[interval].metres * index;
  if (SPLIT_INTERVALS[interval].units === 'imperial') {
    const miles = metres / M_PER_MILE;
    return `${trim(miles)} ${miles === 1 ? 'mile' : 'miles'}`;
  }
  const km = metres / M_PER_KM;
  return `${trim(km)} ${km === 1 ? 'kilometre' : 'kilometres'}`;
}

/**
 * "6 seconds slow" — in seconds, and signed by the word rather than by a minus.
 *
 * Converted into the unit sitting next to it in the sentence. Being off by forty seconds a
 * kilometre is being off by sixty-four a mile, and "9:04 per mile, 40 seconds slow" quietly
 * invites a runner to make up forty seconds over a distance where they are sixty-four down.
 */
function offWords(offSecPerKm: number, slow: boolean, units: UnitSystem): string {
  const seconds = Math.round(Math.abs(displayPace(offSecPerKm, units)));
  if (seconds === 0) return 'on pace';
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'} ${slow ? 'slow' : 'fast'}`;
}

function offBy(cue: SplitCue, units: UnitSystem): string | null {
  if (cue.offSecPerKm == null) return null;
  if (cue.kind === 'onPace') return 'on pace';
  return offWords(cue.offSecPerKm, cue.kind === 'tooSlow', units);
}

/**
 * A split, expanded into a full report rather than a bare pace.
 *
 * The pace alone tells you a number; this tells you where you are, what that piece cost, and
 * what to do about it — which is the whole reason to interrupt someone mid-run.
 */
export function saySplit(options: {
  cue: SplitCue;
  interval: SplitUnit;
  units: UnitSystem;
  /** Total elapsed time, spoken at whole units only — nobody needs it every quarter mile. */
  elapsedSec?: number;
}): string {
  const { cue, interval, units, elapsedSec } = options;
  const parts = [splitPlace(cue.index, interval), formatPace(cue.splitSecPerKm, units)];

  const off = offBy(cue, units);
  if (off) parts.push(off);
  /*
   * Total time from the second whole unit onwards.
   *
   * At mile one the total and the split are the same number, and saying "8:53 per mile, 8:53"
   * sounds like a stutter — the one place the extra figure carries no information is exactly
   * the first place it would be said.
   */
  if (elapsedSec != null && cue.index >= 2 && (interval === 'mile' || interval === 'km')) {
    parts.push(formatClock(Math.round(elapsedSec)));
  }

  return parts.join(' · ');
}

/**
 * A drift cue: you have wandered off the pace and stayed off it.
 *
 * Opens with the instruction rather than the measurement. By the time this fires you have been
 * off pace for the best part of a minute, and "pick it up" is the actionable half.
 */
export function sayDrift(options: {
  kind: CueKind;
  reading: PaceReading;
  target: PaceTarget;
  units: UnitSystem;
}): string {
  const { kind, reading, target, units } = options;
  const now = reading.paceSecPerKm == null ? null : formatPace(reading.paceSecPerKm, units);

  if (kind === 'backOnPace') return now ? `Back on pace · ${now}` : 'Back on pace';

  const off =
    reading.paceSecPerKm == null
      ? null
      : offWords(reading.paceSecPerKm - target.targetSecPerKm, kind === 'tooSlow', units);
  const tail = [now, off].filter(Boolean).join(' · ');

  const lead = kind === 'tooSlow' ? 'Pick it up' : 'Ease back';
  return tail ? `${lead} · ${tail}` : lead;
}

/**
 * "800 metres in 3:36" — how the piece you just finished actually went.
 *
 * The two currencies want different wording, and for the same reason they wanted different
 * cursors. A distance piece finishes on its own number, so it is read back in the words it
 * was written in: an 800 is an 800. A timed piece finishes wherever you got to, and that is a
 * measurement — "1591 metres" is nobody's cool-down, "0.99 miles" is the distance you covered.
 */
function sayCovered(segment: RunSegment, covered: { distanceM: number; seconds: number }, units: UnitSystem): string {
  if (segment.durationSec != null) {
    // Whatever it took was always going to be exactly the time asked for, so no time here.
    return formatDistance(covered.distanceM, units);
  }
  return `${distanceWords(covered.distanceM, units)} in ${formatClock(Math.round(covered.seconds))}`;
}

/**
 * What to say as one segment gives way to the next.
 *
 * Both halves, in that order: the rep you just ran, then the one starting now. On a tempo
 * session that is "two kilometres in 8:12. Next, jog 400 metres at 6:30 per kilometre" — the
 * shape of the whole instruction, without needing to remember what the plan said.
 */
export function sayChange(change: SegmentChange, units: UnitSystem): string | null {
  if (!change.leaving) return null;

  const parts: string[] = [];
  if (change.covered) parts.push(sayCovered(change.leaving, change.covered, units));

  parts.push(
    change.entering
      ? `Next, ${describeSegment(change.entering, units).toLowerCase()}`
      : 'Session done',
  );

  return parts.join(' · ');
}

/** Said once as the run starts, so the first instruction is not a surprise a mile in. */
export function sayStart(first: RunSegment | null, units: UnitSystem): string {
  return first ? describeSegment(first, units) : 'Run started';
}

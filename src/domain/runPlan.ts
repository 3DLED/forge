/**
 * A run with a shape to it — intervals, a tempo block, a warm-up and a cool-down.
 *
 * The thing that makes this awkward, and the reason it cannot be a pure function of "how far
 * have I gone and how long have I been out": segments are measured in different currencies. A
 * five minute warm-up ends on the clock; the 800 after it ends on the ground. To know whether
 * you have finished the warm-up you need the clock, and to know where the 800 started you need
 * how far you happened to get in those five minutes — which is not in the plan, because it
 * depends on how fast you ran.
 *
 * So progress is a cursor that is advanced as boundaries go by, exactly like the split counter,
 * rather than a calculation redone from totals each time. That also makes it honest about
 * pausing, tunnels and backlogs of buffered fixes: the cursor moves when ground is covered, and
 * not otherwise.
 */

import { M_PER_KM, M_PER_MILE } from './units';
import { formatPace } from './units';
import { words } from './lang';
import type { Language, UnitSystem } from './types';

export type SegmentKind = 'warmup' | 'work' | 'recovery' | 'steady' | 'cooldown';

export interface RunSegment {
  kind: SegmentKind;
  /**
   * Measured on the ground or on the clock, never both.
   *
   * "400 metres" and "90 seconds" are different instructions and a segment carrying both would
   * have to pick one to actually end on.
   */
  distanceM?: number;
  durationSec?: number;
  /** What to run it at, in seconds per kilometre. Absent means "however you like". */
  targetSecPerKm?: number;
  /** Overrides the generated wording, for a segment that wants naming. */
  label?: string;
}

export interface RunPlan {
  name: string;
  /**
   * Flattened, with repeats already expanded.
   *
   * Four times eight hundred is eight segments here, not a repeat count. A cursor walking a
   * flat list cannot get its arithmetic wrong, and the builder that writes the list is a far
   * better place for "times four" than the engine reading it mid-run.
   */
  segments: RunSegment[];
}

export interface RunCursor {
  /** Which segment is being run. Equal to the length once the plan is finished. */
  index: number;
  /** Total distance when this segment began. */
  fromM: number;
  /** Total elapsed seconds when this segment began. */
  fromSec: number;
}

export function startRun(): RunCursor {
  return { index: 0, fromM: 0, fromSec: 0 };
}

export function segmentAt(plan: RunPlan, cursor: RunCursor): RunSegment | null {
  return plan.segments[cursor.index] ?? null;
}

export function isFinished(plan: RunPlan, cursor: RunCursor): boolean {
  return cursor.index >= plan.segments.length;
}

/** Whether the segment being run has been completed, given where you are now. */
function complete(segment: RunSegment, intoM: number, intoSec: number): boolean {
  if (segment.distanceM != null) return intoM >= segment.distanceM;
  if (segment.durationSec != null) return intoSec >= segment.durationSec;
  // A segment with neither runs until something else ends it — a lap button, or the finish.
  return false;
}

export interface RunProgress {
  segment: RunSegment | null;
  index: number;
  /** How far and how long into the current segment. */
  intoM: number;
  intoSec: number;
  /** What is left of it, in whichever currency it is measured in. Null for the other one. */
  remainingM: number | null;
  remainingSec: number | null;
  finished: boolean;
}

export function runProgress(
  plan: RunPlan,
  cursor: RunCursor,
  distanceM: number,
  elapsedSec: number,
): RunProgress {
  const segment = segmentAt(plan, cursor);
  const intoM = Math.max(0, distanceM - cursor.fromM);
  const intoSec = Math.max(0, elapsedSec - cursor.fromSec);

  return {
    segment,
    index: cursor.index,
    intoM,
    intoSec,
    remainingM: segment?.distanceM != null ? Math.max(0, segment.distanceM - intoM) : null,
    remainingSec: segment?.durationSec != null ? Math.max(0, segment.durationSec - intoSec) : null,
    finished: isFinished(plan, cursor),
  };
}

export interface SegmentChange {
  cursor: RunCursor;
  /** The segment just started, when one was. Null when nothing changed. */
  entering: RunSegment | null;
  /** The segment just finished, for reporting how it went. */
  leaving: RunSegment | null;
  /** How the finished segment actually went, so a cue can say more than "next". */
  covered: { distanceM: number; seconds: number } | null;
  finished: boolean;
}

/**
 * Moves the cursor on if a segment has been completed.
 *
 * One boundary per call, deliberately, and for the same reason splits announce one at a time:
 * after a tunnel or a backlog of buffered fixes, several can fall due at once, and being told
 * about three segments you have already run is worse than being told about none of them. The
 * next call takes the next one.
 */
export function advanceRun(options: {
  plan: RunPlan;
  cursor: RunCursor;
  distanceM: number;
  elapsedSec: number;
}): SegmentChange {
  const { plan, cursor, distanceM, elapsedSec } = options;
  const still: SegmentChange = {
    cursor,
    entering: null,
    leaving: null,
    covered: null,
    finished: isFinished(plan, cursor),
  };

  const segment = segmentAt(plan, cursor);
  if (!segment) return still;

  const intoM = distanceM - cursor.fromM;
  const intoSec = elapsedSec - cursor.fromSec;
  if (!complete(segment, intoM, intoSec)) return still;

  /*
   * The new segment starts at the boundary, not at wherever you happened to be when the fix
   * arrived. Starting it late would hand the overshoot to the next segment, and on a set of
   * eight four-hundreds that error compounds all the way down the ladder.
   */
  const boundaryM = segment.distanceM != null ? cursor.fromM + segment.distanceM : distanceM;
  const boundarySec =
    segment.durationSec != null ? cursor.fromSec + segment.durationSec : elapsedSec;

  const next: RunCursor = { index: cursor.index + 1, fromM: boundaryM, fromSec: boundarySec };

  return {
    cursor: next,
    entering: plan.segments[next.index] ?? null,
    leaving: segment,
    covered: { distanceM: boundaryM - cursor.fromM, seconds: boundarySec - cursor.fromSec },
    finished: next.index >= plan.segments.length,
  };
}

// --- saying it out loud ------------------------------------------------------

/*
 * Every function below takes a language as well as a unit system, for the same reason it
 * takes a unit system: it produces words, and words differ. The wording itself lives in
 * `lang.ts` — what is here is which pieces go in what order, which is a judgement about
 * running rather than about Spanish.
 */

/**
 * "800 metres" / "0.25 miles" / "5 kilometres" — a distance in the words a runner uses.
 *
 * Exported because the spoken cues report distances too, and two implementations of this
 * would disagree about an 800 within a week.
 */
export function distanceWords(
  metres: number,
  units: UnitSystem,
  lang: Language | undefined,
  /**
   * Set for a distance that was measured rather than asked for.
   *
   * The track-rep rule below is about what somebody *chose*: an 800 is an 800. Nobody chose
   * to cover 1591 metres in their cool-down, so a measured distance is always read in the
   * unit on screen — and always in words, because this ends up at a speech engine, where
   * "1.03 mi" comes out as the letters M and I.
   */
  measured = false,
): string {
  const w = words(lang);
  if (units === 'imperial') {
    if (measured) return w.count('mile', metres / M_PER_MILE);
    const miles = metres / M_PER_MILE;
    /*
     * Track reps are said in metres even in a country that measures everything else in miles.
     * An 800 is an 800; calling it "0.5 miles" is both wrong by nine metres and not what
     * anybody would say out loud.
     *
     * So: quarters of a mile stay in miles, because that is a distance somebody chose in
     * miles. Anything else under a mile is a metric distance wearing a bad conversion and
     * stays in metres. Over a mile, miles win — nobody runs "eight thousand metres".
     */
    const quarters = miles * 4;
    const chosenInMiles = Math.abs(quarters - Math.round(quarters)) < 0.005;
    if (!chosenInMiles && metres < M_PER_MILE) return w.count('metre', Math.round(metres));
    return w.count('mile', miles);
  }

  if (measured) return w.count('kilometre', metres / M_PER_KM);
  return metres < M_PER_KM
    ? w.count('metre', Math.round(metres))
    : w.count('kilometre', metres / M_PER_KM);
}

/** "800 metres" / "5 minutes" — how long the thing lasts, in its own currency. */
function extentOf(segment: RunSegment, units: UnitSystem, lang: Language | undefined): string {
  const w = words(lang);
  if (segment.durationSec != null) {
    const minutes = Math.round(segment.durationSec / 60);
    return minutes >= 1 ? w.count('minute', minutes) : w.count('second', segment.durationSec);
  }
  if (segment.distanceM == null) return w.phrase.untilYouSay;
  return distanceWords(segment.distanceM, units, lang);
}

/**
 * What to say when a segment starts.
 *
 * Built as a sentence rather than a set of fields because it is going to a speech engine, and
 * because the same words read perfectly well on screen. "Run 800 metres at 4:30 per kilometre"
 * is the instruction; anything shorter needs the runner to remember what the plan said.
 */
export function describeSegment(
  segment: RunSegment,
  units: UnitSystem,
  lang: Language | undefined,
): string {
  // A label somebody typed is already in whatever language they typed it in.
  if (segment.label) return segment.label;

  const w = words(lang);
  const verb = w.verb[segment.kind];
  const extent = extentOf(segment, units, lang);
  if (segment.targetSecPerKm == null) return `${verb} ${extent}`;

  return `${verb} ${extent} ${w.phrase.at} ${formatPace(segment.targetSecPerKm, units)}`;
}

/** "Next: run 800 metres at 4:30 / km" — spoken as one segment gives way to the next. */
export function describeNext(
  segment: RunSegment | null,
  units: UnitSystem,
  lang: Language | undefined,
): string {
  const w = words(lang);
  if (!segment) return w.phrase.lastOneDone;
  return `${w.phrase.next} ${w.lower(describeSegment(segment, units, lang))}`;
}

// --- building one from a handful of numbers ----------------------------------

/**
 * The shapes a run actually comes in, as far as anyone needs to describe one on a phone.
 *
 * Deliberately four, not a general-purpose segment editor. Almost every structured run is a
 * steady effort, a tempo with something either side of it, or reps with floats between; the
 * ones that are not can be built by hand later. A builder offering arbitrary segment lists
 * would be more capable and would be used less, which is the wrong trade for a screen you
 * open in a car park with cold hands.
 */
export type RunShape =
  /** No structure. Splits and drift alerts still work; nothing is prescribed. */
  | { kind: 'open' }
  /**
   * A distance, and nothing else.
   *
   * No pace of its own on purpose. A one-segment run has exactly one pace, and that is the
   * target pace the alerts and the splits are already measured against — a second field for
   * it would be the same number asked for twice, with only one of the two doing anything.
   * Tempo and interval work is different: their pieces disagree with each other, so there is
   * no single number and each piece states its own.
   */
  | { kind: 'steady'; distanceM?: number; durationSec?: number }
  | {
      kind: 'tempo';
      warmupSec: number;
      distanceM: number;
      targetSecPerKm: number;
      cooldownSec: number;
    }
  | {
      kind: 'intervals';
      warmupSec: number;
      reps: number;
      workM: number;
      workSecPerKm: number;
      floatM: number;
      floatSecPerKm: number;
      cooldownSec: number;
    };

/** "4 × 800" — the name a runner would give the session, built from its own numbers. */
function intervalName(reps: number, workM: number): string {
  return workM >= M_PER_KM ? `${reps} × ${Number((workM / M_PER_KM).toFixed(2))} km` : `${reps} × ${workM} m`;
}

/**
 * Turns a shape into the flat segment list the cursor walks.
 *
 * Null for an open run rather than a one-segment plan: "no structure" and "one long segment"
 * behave the same at every boundary but read differently on screen, and a run screen showing
 * "Segment 1 of 1" for an ordinary easy run is noise.
 */
export function buildRunPlan(
  shape: RunShape,
  /**
   * The pace a shape that has none of its own should be run at.
   *
   * Only a steady run takes it. Passing it in rather than storing it on the shape is what
   * keeps there being one target pace in the app instead of two that can disagree.
   */
  targetSecPerKm?: number,
): RunPlan | null {
  if (shape.kind === 'open') return null;

  if (shape.kind === 'steady') {
    if (shape.distanceM == null && shape.durationSec == null) return null;
    return {
      name: 'Steady',
      segments: [
        {
          kind: 'steady',
          distanceM: shape.distanceM,
          durationSec: shape.distanceM == null ? shape.durationSec : undefined,
          targetSecPerKm,
        },
      ],
    };
  }

  if (shape.kind === 'tempo') {
    const segments: RunSegment[] = [];
    if (shape.warmupSec > 0) segments.push({ kind: 'warmup', durationSec: shape.warmupSec });
    segments.push({ kind: 'work', distanceM: shape.distanceM, targetSecPerKm: shape.targetSecPerKm });
    if (shape.cooldownSec > 0) segments.push({ kind: 'cooldown', durationSec: shape.cooldownSec });
    return { name: 'Tempo', segments };
  }

  const segments: RunSegment[] = [];
  if (shape.warmupSec > 0) segments.push({ kind: 'warmup', durationSec: shape.warmupSec });

  for (let rep = 0; rep < Math.max(1, shape.reps); rep += 1) {
    segments.push({ kind: 'work', distanceM: shape.workM, targetSecPerKm: shape.workSecPerKm });
    /*
     * No float after the last rep. It would be a recovery you run before stopping, and on the
     * screen it is the difference between the session ending when you finish the work and it
     * ending four hundred metres later for no reason.
     */
    if (rep < shape.reps - 1 && shape.floatM > 0) {
      segments.push({ kind: 'recovery', distanceM: shape.floatM, targetSecPerKm: shape.floatSecPerKm });
    }
  }

  if (shape.cooldownSec > 0) segments.push({ kind: 'cooldown', durationSec: shape.cooldownSec });
  return { name: intervalName(shape.reps, shape.workM), segments };
}

/** Total prescribed ground, where every segment states one. Null when any is on the clock. */
export function plannedDistanceM(plan: RunPlan): number | null {
  let total = 0;
  for (const segment of plan.segments) {
    if (segment.distanceM == null) return null;
    total += segment.distanceM;
  }
  return total;
}

// --- what a given run can even be ---------------------------------------------

/**
 * What kind of run a movement is, which decides what can be prescribed for it.
 *
 * The distinction that matters is reps. An interval session is a list of efforts with
 * recoveries between them; an easy run, a long run, a walk and a ruck are one effort that
 * lasts as long as it lasts. Offering "how many reps" on a Sunday long run is offering a
 * question with no answer, and the setup screen is worse for every run because one kind of
 * run needed it.
 */
export type RunKind = 'steady' | 'tempo' | 'intervals';

/**
 * The shapes worth offering for each kind, in the order they should appear.
 *
 * Not a hard rule about what is possible — it is a list of what is worth putting on a screen
 * you open outdoors. Somebody who genuinely wants to run reps inside an "Easy Run" can pick
 * Interval Run, which is what it is for.
 */
export const SHAPES_FOR: Record<RunKind, RunShape['kind'][]> = {
  steady: ['open', 'steady'],
  tempo: ['open', 'tempo', 'steady'],
  intervals: ['open', 'intervals', 'tempo'],
};

/**
 * The math that turns logged sets into something you can judge a training block by.
 *
 * The organising idea is **session RPE x duration**. A 60-minute lift at RPE 7 and a
 * 60-minute run at RPE 7 both cost 420 units. It is crude, it is well validated, and it is
 * the only load metric that lets a hybrid athlete add running and lifting into one number
 * instead of staring at two charts that never meet.
 */

import type { BodyweightLookup } from './bodyweight';
import type { DayKey, Exercise, Id, LoggedSession, LoggedSet } from './types';

// --- per-set --------------------------------------------------------------

/**
 * Estimated one-rep max, Epley. Above about 12 reps this stops meaning much, so it is
 * capped rather than silently reported as a PR off a set of 30.
 */
export function estimate1RM(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return null;
  return weightKg * (1 + reps / 30);
}

/**
 * Load moved by one set, in kg-reps. Unilateral work counts both sides.
 *
 * Bodyweight counts. Half the library records no external weight at all, so without this a
 * hundred push-ups scored as no work done — and for anyone training on bodyweight and
 * kettlebells that is most of the chart missing. Added load stacks on top rather than
 * replacing: a weighted pull-up is you plus the plate.
 *
 * The estimate is rough, and it is not comparable across movements — a set of air squats
 * outscores a set of goblet squats, because your own mass is genuinely more than a 24 kg bell.
 * That is fine for what this feeds: a trend for one movement, and a week-over-week total.
 * It is not a claim that the two are equivalent work.
 */
export function setVolumeKg(set: LoggedSet, exercise?: Exercise, bodyweightKg?: number): number {
  const external = set.values.weightKg ?? 0;
  const own = (exercise?.bodyweightFactor ?? 0) * (bodyweightKg ?? 0);
  const reps = set.values.reps ?? 0;
  const sides = exercise?.unilateral && !set.side ? 2 : 1;
  return (external + own) * reps * sides;
}

export function setDistanceM(set: LoggedSet): number {
  return set.values.distanceM ?? 0;
}

// --- per-session ----------------------------------------------------------

/**
 * Session load. Uses the recorded session RPE and duration when present; otherwise falls
 * back to the average set RPE and a rough minute estimate, so a session logged in a hurry
 * still contributes something rather than reading as a zero-effort day.
 */
export function sessionLoad(session: LoggedSession): number {
  const minutes = session.durationMin ?? estimateDurationMin(session);
  const rpe = session.sessionRpe ?? averageSetRpe(session) ?? 0;
  return Math.round(minutes * rpe);
}

export function averageSetRpe(session: LoggedSession): number | null {
  const values = session.sets.map((s) => s.values.rpe).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Seconds recorded by the session stopwatch, including any run currently in progress. */
export function stopwatchSec(session: LoggedSession): number {
  return (
    (session.elapsedSec ?? 0) +
    (session.runningSince ? Math.max(0, (Date.now() - Date.parse(session.runningSince)) / 1000) : 0)
  );
}

/** Seconds spent inside timed blocks. */
export function blocksSec(session: LoggedSession): number {
  return (session.blocks ?? []).reduce((total, block) => total + (block.timeSec ?? 0), 0);
}

/** Rounds completed across every timed block in the session. */
export function sessionRounds(session: LoggedSession): number {
  return (session.blocks ?? []).reduce((total, block) => total + (block.rounds ?? 0), 0);
}

/** Wall-clock minutes if the session was timed; otherwise inferred from its contents. */
export function estimateDurationMin(session: LoggedSession): number {
  // The stopwatch and the block clocks both measure real working time, unlike start/end
  // timestamps which only bound how long the screen was open. Take whichever saw more: the
  // stopwatch covers a block it was running through, and a block covers itself when the
  // session clock was never started.
  const timed = Math.max(stopwatchSec(session), blocksSec(session));
  if (timed > 30) return Math.round(timed / 60);

  if (session.startedAt && session.endedAt) {
    const ms = Date.parse(session.endedAt) - Date.parse(session.startedAt);
    if (ms > 0) return Math.round(ms / 60_000);
  }
  const workSec = session.sets.reduce((total, set) => total + (set.values.timeSec ?? 0), 0);
  if (workSec > 0) return Math.round(workSec / 60);
  // Roughly three minutes per set including rest — enough to keep load comparable.
  return session.sets.filter((s) => s.completed).length * 3;
}

export function sessionVolumeKg(
  session: LoggedSession,
  bySlug: Map<string, Exercise>,
  /** Bodyweight as of this session's date — see `domain/bodyweight.ts`. */
  bodyweightKg?: number,
): number {
  return session.sets.reduce(
    (total, set) =>
      total + (set.completed ? setVolumeKg(set, bySlug.get(set.exerciseSlug), bodyweightKg) : 0),
    0,
  );
}

export function sessionDistanceM(session: LoggedSession): number {
  return session.sets.reduce((total, set) => total + (set.completed ? setDistanceM(set) : 0), 0);
}

export function sessionWorkSec(session: LoggedSession): number {
  const setSec = session.sets.reduce(
    (total, set) => total + (set.completed ? (set.values.timeSec ?? 0) : 0),
    0,
  );
  return setSec + blocksSec(session);
}

// --- across sessions ------------------------------------------------------

/** Trailing weeks that must contain real training before the ratio means anything. */
const MIN_WEEKS_FOR_RATIO = 3;

/**
 * Acute:chronic workload ratio — this week's load against the trailing four-week average.
 * Above ~1.5 is the classic "you are ramping faster than you are adapting" warning, and it
 * is the number most likely to keep someone out of a boot.
 *
 * Returns null until there is enough history to divide by. Against three empty weeks the
 * arithmetic yields 4.0 and screams danger at someone whose crime was starting to train —
 * a warning that fires for every new user is a warning nobody reads by week five.
 */
export function acuteChronicRatio(weeklyLoads: number[]): number | null {
  const chronicWeeks = weeklyLoads.slice(-4);
  if (chronicWeeks.filter((load) => load > 0).length < MIN_WEEKS_FOR_RATIO) return null;

  const chronic = chronicWeeks.reduce((a, b) => a + b, 0) / chronicWeeks.length;
  if (chronic <= 0) return null;
  return weeklyLoads[weeklyLoads.length - 1] / chronic;
}

/** The kinds of mark a movement can hold a best in. */
export type PrKind = 'oneRm' | 'reps' | 'time' | 'distance' | 'pace' | 'rounds';

/** Which workout a mark came from, so a best can be traced back to the day it happened. */
export interface PrSource {
  sessionId: Id;
  date: DayKey;
}

export interface PersonalRecord {
  exerciseSlug: string;
  /** Best estimated 1RM, for loaded work. */
  best1RMKg?: number;
  /**
   * That 1RM as a multiple of what you weighed when you hit it.
   *
   * The number people actually compare. A 140 kg deadlift says little on its own; twice
   * bodyweight says a lot, and it stays honest across a bulk or a cut in a way the raw
   * figure does not.
   */
  best1RMxBw?: number;
  /** Most reps in a single set, for bodyweight work. */
  bestReps?: number;
  /** Longest hold, for planks and hangs. */
  bestTimeSec?: number;
  /** Furthest single effort. */
  bestDistanceM?: number;
  /** Fastest pace over at least a kilometre, in seconds per km. */
  bestPaceSecPerKm?: number;
  /** Most rounds in a timed block. */
  bestRounds?: number;
  /**
   * The cap the round count was set against. Rounds are only comparable within the same
   * window — 9 rounds in 20 minutes is not a better score than 7 in 12 — so the number is
   * never shown without it.
   */
  bestRoundsTimeSec?: number;
  /**
   * Where each mark was set, by kind.
   *
   * Per mark rather than per record, because a movement's best 1RM and its best rep count
   * routinely come from different workouts. A single date on the record would be right for
   * one of them and quietly wrong for the other.
   */
  sources: Partial<Record<PrKind, PrSource>>;
  /** The most recent day anything on this record improved. */
  date: DayKey;
}

/** A mark being beaten, on the day it happened. */
export interface PrEvent {
  sessionId: Id;
  date: DayKey;
  exerciseSlug: string;
  kind: PrKind;
  /** The new mark, in storage units. */
  value: number;
  /** What it beat. Always present — establishing a first mark is not an event. */
  previous: number;
}

/** Lower is better for pace; every other mark is a bigger-is-better number. */
function beats(kind: PrKind, candidate: number, existing: number): boolean {
  return kind === 'pace' ? candidate < existing : candidate > existing;
}

/** The best of a kind that one session produced, before it is judged against history. */
interface Candidate {
  value: number;
  /** Carried alongside a rounds mark: the window it was scored against. */
  timeSec?: number;
  /** Carried alongside a 1RM: bodyweight that day, for the relative figure. */
  bodyweightKg?: number;
}

export interface RecordScan {
  records: Map<string, PersonalRecord>;
  /** Every improvement, oldest first. */
  events: PrEvent[];
}

/**
 * Best-ever marks per movement, and the moments they were set.
 *
 * Two rules are what make the events mean anything:
 *
 * 1. **A session is judged against everything before it, never against itself.** Each session
 *    is reduced to its own best of each kind first, then compared. Without that, a warm-up
 *    ramp of 40/60/80 kg reports two personal bests on the way to one working set.
 *
 * 2. **Establishing a first mark is not an event.** The arithmetic says the first time you do
 *    anything is a best in everything, which would flag most of a new athlete's first month
 *    and leave the badge meaning nothing. A PR here is beating something you had already done.
 *
 * Sessions are sorted before scanning. An event is a claim about chronology, so it must not
 * depend on the order a caller happened to read the table in.
 */
export function scanRecords(
  sessions: LoggedSession[],
  /** Bodyweight on any given day, for relative-strength bests. Optional. */
  bodyweight?: BodyweightLookup,
): RecordScan {
  const records = new Map<string, PersonalRecord>();
  const events: PrEvent[] = [];

  const ordered = [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.endedAt ?? '').localeCompare(b.endedAt ?? ''),
  );

  for (const session of ordered) {
    /** slug -> kind -> the best this one session managed. */
    const sessionBest = new Map<string, Partial<Record<PrKind, Candidate>>>();

    const offer = (slug: string, kind: PrKind, candidate: Candidate) => {
      const forSlug = sessionBest.get(slug) ?? {};
      const held = forSlug[kind];
      if (!held || beats(kind, candidate.value, held.value)) {
        forSlug[kind] = candidate;
        sessionBest.set(slug, forSlug);
      }
    };

    for (const set of session.sets) {
      if (!set.completed) continue;
      const { weightKg, reps, timeSec, distanceM, rounds } = set.values;

      if (rounds) offer(set.exerciseSlug, 'rounds', { value: rounds, timeSec });

      if (weightKg && reps) {
        const oneRm = estimate1RM(weightKg, reps);
        if (oneRm) {
          offer(set.exerciseSlug, 'oneRm', {
            value: oneRm,
            bodyweightKg: bodyweight?.at(session.date),
          });
        }
      }
      if (reps && !weightKg) offer(set.exerciseSlug, 'reps', { value: reps });
      if (timeSec && !distanceM) offer(set.exerciseSlug, 'time', { value: timeSec });
      if (distanceM) offer(set.exerciseSlug, 'distance', { value: distanceM });
      if (distanceM && timeSec && distanceM >= 1000) {
        offer(set.exerciseSlug, 'pace', { value: timeSec / (distanceM / 1000) });
      }
    }

    /*
     * Rounds live on the block, not on its movements, so blocks are scanned separately — and
     * attributed to the *named workout* they came from rather than to their style.
     *
     * A round count only means something against the same work. Nine rounds of Cindy and nine
     * rounds of a burpee-and-swing AMRAP are not comparable results, so a single "best AMRAP"
     * was a number that could not be beaten honestly. Naming a workout is what makes its score
     * a score, and an unnamed block records rounds against nothing.
     */
    for (const block of session.blocks ?? []) {
      if (!block.rounds || !block.sourceTemplateId) continue;
      offer(workoutKey(block.sourceTemplateId), 'rounds', {
        value: block.rounds,
        timeSec: block.capSec ?? block.timeSec,
      });
    }

    for (const [slug, kinds] of sessionBest) {
      const record: PersonalRecord = records.get(slug) ?? {
        exerciseSlug: slug,
        sources: {},
        date: session.date,
      };

      for (const key of Object.keys(kinds) as PrKind[]) {
        const candidate = kinds[key];
        if (!candidate) continue;

        const existing = currentMark(record, key);
        const isFirst = existing == null;
        if (!isFirst && !beats(key, candidate.value, existing)) continue;

        applyMark(record, key, candidate);
        record.sources[key] = { sessionId: session.id, date: session.date };
        record.date = session.date;

        if (!isFirst) {
          events.push({
            sessionId: session.id,
            date: session.date,
            exerciseSlug: slug,
            kind: key,
            value: candidate.value,
            previous: existing,
          });
        }
      }

      records.set(slug, record);
    }
  }

  return { records, events };
}

function currentMark(record: PersonalRecord, kind: PrKind): number | undefined {
  switch (kind) {
    case 'oneRm': return record.best1RMKg;
    case 'reps': return record.bestReps;
    case 'time': return record.bestTimeSec;
    case 'distance': return record.bestDistanceM;
    case 'pace': return record.bestPaceSecPerKm;
    case 'rounds': return record.bestRounds;
  }
}

function applyMark(record: PersonalRecord, kind: PrKind, candidate: Candidate): void {
  switch (kind) {
    case 'oneRm':
      record.best1RMKg = candidate.value;
      // Divided by what you weighed *then*, not now, so the ratio records what actually
      // happened rather than shifting every time the scale does.
      record.best1RMxBw =
        candidate.bodyweightKg && candidate.bodyweightKg > 0
          ? candidate.value / candidate.bodyweightKg
          : undefined;
      return;
    case 'reps': record.bestReps = candidate.value; return;
    case 'time': record.bestTimeSec = candidate.value; return;
    case 'distance': record.bestDistanceM = candidate.value; return;
    case 'pace': record.bestPaceSecPerKm = candidate.value; return;
    case 'rounds':
      record.bestRounds = candidate.value;
      record.bestRoundsTimeSec = candidate.timeSec;
      return;
  }
}

/** Best-ever marks per movement, scanned from logged sets. */
export function personalRecords(
  sessions: LoggedSession[],
  bodyweight?: BodyweightLookup,
): Map<string, PersonalRecord> {
  return scanRecords(sessions, bodyweight).records;
}

/** PR events grouped by the workout that set them — what History flags a session on. */
export function prEventsBySession(events: PrEvent[]): Map<Id, PrEvent[]> {
  const bySession = new Map<Id, PrEvent[]>();
  for (const event of events) {
    const list = bySession.get(event.sessionId);
    if (list) list.push(event);
    else bySession.set(event.sessionId, [event]);
  }
  return bySession;
}

/**
 * How a saved workout's record is keyed.
 *
 * Namespaced so it cannot collide with a movement slug, and so anything reading the records
 * can tell the two apart — a workout's name comes from the saved template, not the exercise
 * library.
 */
export function workoutKey(templateId: Id): string {
  return `workout:${templateId}`;
}

export function workoutIdFromKey(key: string): Id | undefined {
  return key.startsWith('workout:') ? key.slice('workout:'.length) : undefined;
}

/**
 * Library entries standing in for a timed block.
 *
 * They no longer carry records — a named workout does that now — but they remain so the
 * picker can keep hiding them, and so any session already referencing one still resolves.
 */
const CONTAINER_SLUG: Record<string, string> = {
  amrap: 'amrap',
  emom: 'emom',
  forTime: 'for-time',
};

/**
 * The container entries themselves, for anything that browses the library.
 *
 * They are not movements, and they are hidden rather than deleted because sessions logged
 * before rounds moved onto named workouts still point at them. Adding one to a workout was
 * never the way to start a timed piece; ‘Add block’ is.
 */
export const CONTAINER_SLUGS = new Set(Object.values(CONTAINER_SLUG));

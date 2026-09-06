/**
 * Turning a stream of GPS fixes into a pace you can act on.
 *
 * Two problems, and only the second one is obvious.
 *
 * **Getting a number at all.** Raw satellite positions wander by several metres even standing
 * still, so differencing consecutive ones — taking the derivative of a noisy signal — produces
 * a pace that swings wildly while you run at a perfectly even effort. The fix is not to
 * difference at all where it can be avoided: the receiver reports its own `speed`, computed
 * from Doppler shift on the carrier rather than from positions, and that is a different and
 * far steadier measurement. Differencing stays as the fallback for fixes that arrive without
 * one, which happens often enough to matter.
 *
 * **Knowing when to shut up.** A cue on every fix is a cue nobody keeps switched on. Most of
 * what follows is refusal: too soon after the last one, too close to the boundary to be a real
 * change, too slow to be running at all. The measurement is the easy half.
 */

/** One reading from wherever the positions are coming from. See `locationSource`. */
export interface Fix {
  /** Milliseconds since the epoch, as both the browser and the plugin report it. */
  at: number;
  lat: number;
  lon: number;
  /** Metres of horizontal error. Bigger is worse; null means the source did not say. */
  accuracy: number | null;
  /** Metres per second from the receiver, or null when it could not work one out. */
  speed: number | null;
}

/**
 * Fixes worse than this are dropped rather than smoothed.
 *
 * A thirty metre error is a city block, and letting one into the window moves the pace by more
 * than any real change in effort would. Dropping is safe because another fix is a second away.
 */
export const MAX_ACCURACY_M = 30;

/**
 * How much history the pace is averaged over.
 *
 * Short enough to notice a hill, long enough to ride out a bad fix. Under about eight seconds
 * the number twitches; past about twenty it lags far enough behind that acting on it means
 * correcting something you stopped doing half a minute ago.
 */
export const WINDOW_MS = 12_000;

/**
 * Below this, treat it as standing still.
 *
 * Half a metre a second is a shuffle — around thirty-three minutes a kilometre. GPS speed is
 * least reliable at the bottom of its range, and this is also the rule that stops the app
 * talking to you at a pedestrian crossing.
 */
export const MOVING_FLOOR_MPS = 0.5;

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance. Flat-earth approximations drift on north–south routes. */
export function metresBetween(a: Fix, b: Fix): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Whether a fix is good enough to reason from. */
export function usable(fix: Fix): boolean {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return false;
  if (fix.accuracy == null) return true;
  return fix.accuracy <= MAX_ACCURACY_M;
}

/**
 * How fast this fix says you are going.
 *
 * The receiver's own figure when it gave one — some report `-1` rather than null to mean "no
 * idea", which is a number and would otherwise sail straight through. Only then fall back to
 * dividing the distance from the previous fix by the time between them.
 */
export function speedOf(fix: Fix, previous?: Fix): number | null {
  if (fix.speed != null && fix.speed >= 0) return fix.speed;
  if (!previous) return null;

  const seconds = (fix.at - previous.at) / 1000;
  if (seconds <= 0) return null;
  return metresBetween(previous, fix) / seconds;
}

/**
 * The middle speed in the window, not the average.
 *
 * A mean is moved by one bad reading in proportion to how bad it was, and GPS failures are not
 * gentle — a reflection off a building can report thirty metres a second. A median ignores it
 * completely as long as most of the window is sane, which is the failure mode that actually
 * happens.
 */
export function medianSpeed(speeds: number[]): number | null {
  if (speeds.length === 0) return null;
  const sorted = [...speeds].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export interface PaceReading {
  /** Smoothed speed in metres per second, or null before there is enough to say. */
  speedMps: number | null;
  /** Seconds per kilometre, or null while stopped or still settling. */
  paceSecPerKm: number | null;
  /** Metres covered across the fixes that were good enough to keep. */
  distanceM: number;
  moving: boolean;
  /** Fixes thrown away for poor accuracy — worth surfacing when it is most of them. */
  discarded: number;
}

/**
 * What the last few seconds say.
 *
 * Takes the whole buffer rather than accumulating internally, so the same input always gives
 * the same answer and a test can hand it a route without pretending to be a clock.
 */
export function readPace(fixes: Fix[], now: number): PaceReading {
  const good = fixes.filter(usable);
  const discarded = fixes.length - good.length;

  let distanceM = 0;
  for (let i = 1; i < good.length; i += 1) distanceM += metresBetween(good[i - 1], good[i]);

  const speeds: number[] = [];
  for (let i = 0; i < good.length; i += 1) {
    if (now - good[i].at > WINDOW_MS) continue;
    const speed = speedOf(good[i], good[i - 1]);
    if (speed != null) speeds.push(speed);
  }

  const speedMps = medianSpeed(speeds);
  const moving = speedMps != null && speedMps >= MOVING_FLOOR_MPS;

  return {
    speedMps,
    paceSecPerKm: moving && speedMps ? 1000 / speedMps : null,
    distanceM,
    moving,
    discarded,
  };
}

// --- deciding whether to say anything ---------------------------------------

export type CueKind = 'tooFast' | 'tooSlow' | 'backOnPace';

export interface PaceTarget {
  /** The pace being aimed at, in seconds per kilometre. */
  targetSecPerKm: number;
  /** How far off it has to be before the app says so. */
  toleranceSecPerKm: number;
}

/**
 * Nothing is said in the first stretch of a run.
 *
 * The receiver is still settling and you are still accelerating from standing, so the pace is
 * both wrong and expected to be wrong. Being told you are slow in the first ten seconds of
 * every run is how a feature earns its way into the settings screen and then to Off.
 */
export const WARMUP_MS = 30_000;

/** The least time between two cues, however much has changed. */
export const MIN_GAP_MS = 45_000;

/** How long before the same complaint may be repeated. */
export const REPEAT_MS = 90_000;

/**
 * How far back inside the band you must come before it says you are back on pace.
 *
 * Leaving at the tolerance and returning at the same point means hovering on the boundary
 * produces a cue every time you breathe. Coming back in only counts once you are properly
 * inside it.
 */
export const RETURN_FRACTION = 0.5;

export interface CueState {
  /** What it last said, if anything. */
  last: CueKind | null;
  lastAt: number;
  /** When the run started, for the warm-up. */
  startedAt: number;
}

export interface CueDecision {
  kind: CueKind | null;
  /** Why nothing was said. Not shown to anyone — it is what makes a failure debuggable. */
  reason?: string;
  state: CueState;
}

/**
 * Whether to say something, and what.
 *
 * A pure function over the state it is given, which is what lets every rule below be tested
 * without waiting in real time for a cue that may never come.
 */
export function decideCue(options: {
  reading: PaceReading;
  target: PaceTarget;
  state: CueState;
  now: number;
}): CueDecision {
  const { reading, target, state, now } = options;
  const keep = (reason: string): CueDecision => ({ kind: null, reason, state });

  if (now - state.startedAt < WARMUP_MS) return keep('warming up');
  if (!reading.moving || reading.paceSecPerKm == null) return keep('not moving');
  if (now - state.lastAt < MIN_GAP_MS) return keep('too soon');

  // Slower means a bigger number of seconds per kilometre, which reads backwards all the way
  // down unless it is named once, here.
  const off = reading.paceSecPerKm - target.targetSecPerKm;
  const outside = Math.abs(off) > target.toleranceSecPerKm;

  if (outside) {
    const kind: CueKind = off > 0 ? 'tooSlow' : 'tooFast';
    // The same complaint twice needs a longer wait than a new one.
    if (kind === state.last && now - state.lastAt < REPEAT_MS) return keep('said that recently');
    return { kind, state: { ...state, last: kind, lastAt: now } };
  }

  // Inside the band. Only worth saying if it had complained, and only once properly back.
  if (state.last === 'tooFast' || state.last === 'tooSlow') {
    if (Math.abs(off) > target.toleranceSecPerKm * RETURN_FRACTION) {
      return keep('back inside, but only just');
    }
    return { kind: 'backOnPace', state: { ...state, last: 'backOnPace', lastAt: now } };
  }

  return keep('on pace, nothing to report');
}

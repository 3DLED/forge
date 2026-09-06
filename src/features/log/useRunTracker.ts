/**
 * The live run: fixes in, numbers and sentences out.
 *
 * Everything that decides anything lives in `domain/pace`, `domain/runPlan` and
 * `domain/runVoice`, all of which are pure. What is left here is the part that cannot be —
 * holding a subscription, keeping a buffer, and knowing what time it is. That split is what
 * makes the interesting behaviour testable without pretending to run down a road.
 *
 * Two decisions worth naming:
 *
 * **Total distance is accumulated, not recomputed.** `readPace` measures across the buffer it
 * is handed, and the buffer is trimmed to a few seconds so the smoothing stays honest. So the
 * total is added up as fixes arrive instead — otherwise trimming the buffer would quietly
 * shorten the run.
 *
 * **Paused time is subtracted, not the paused distance.** Standing at a crossing already
 * costs nothing, because distance stops accumulating on its own; the clock does not. So a
 * pause banks elapsed seconds and the clock restarts from the bank, which is the same trick
 * the session stopwatch uses and for the same reason: a phone that slept must not lose time.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { browserLocation, type LocationSource, type LocationWatch } from '../../data/locationSource';
import {
  decideCue,
  decideSplit,
  metresBetween,
  readPace,
  startSplits,
  usable,
  WINDOW_MS,
  type CueState,
  type Fix,
  type PaceReading,
  type SplitState,
} from '../../domain/pace';
import { advanceRun, runProgress, startRun, type RunCursor, type RunPlan, type RunProgress } from '../../domain/runPlan';
import { alertsArmed, type RunSettings } from '../../domain/runSettings';
import { sayChange, sayDrift, saySplit, sayStart, speakable } from '../../domain/runVoice';
import { speak, stopSpeaking, unlockSpeech } from '../../ui/speak';
import type { UnitSystem } from '../../domain/types';

/** One thing that was said, kept so the screen can show what the ear may have missed. */
export interface RunNote {
  at: number;
  text: string;
  kind: 'split' | 'drift' | 'segment' | 'start';
}

/**
 * Held slightly longer than the pace window.
 *
 * The window is what gets averaged; the buffer needs one fix older than that so the earliest
 * fix inside it still has a previous one to be differenced against when the receiver gave no
 * speed of its own.
 */
const BUFFER_MS = WINDOW_MS + 10_000;

export type RunStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface RunTracker {
  status: RunStatus;
  /** Metres covered, across every fix good enough to keep. */
  distanceM: number;
  /** Seconds of running, with paused time taken out. */
  elapsedSec: number;
  reading: PaceReading | null;
  /** Average over the whole run, which is the number that ends up in the log. */
  averageSecPerKm: number | null;
  progress: RunProgress | null;
  /** Newest first, so the screen can show the last few without reversing. */
  notes: RunNote[];
  error: string | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
}

export function useRunTracker(options: {
  settings: RunSettings;
  units: UnitSystem;
  /** Absent for an unstructured run — splits and drift alerts still work. */
  plan?: RunPlan | null;
  /** Swapped for the background plugin once there is a native shell to run it in. */
  source?: LocationSource;
}): RunTracker {
  const { settings, units, plan, source = browserLocation } = options;

  const [status, setStatus] = useState<RunStatus>('idle');
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [reading, setReading] = useState<PaceReading | null>(null);
  const [notes, setNotes] = useState<RunNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<RunCursor>(() => startRun());

  /*
   * Everything the fix handler needs lives in refs rather than state.
   *
   * The handler is installed once, when the watch starts, and would otherwise close over the
   * first render's values for the rest of the run — a class of bug that shows up as splits
   * announced against a target you changed and then changed back.
   */
  const buffer = useRef<Fix[]>([]);
  const previous = useRef<Fix | null>(null);
  const totalM = useRef(0);
  const splitState = useRef<SplitState | null>(null);
  const cueState = useRef<CueState | null>(null);
  const cursorRef = useRef<RunCursor>(startRun());
  const watch = useRef<LocationWatch | null>(null);

  /** Time banked from earlier stretches, plus when the current one began. */
  const banked = useRef(0);
  const since = useRef<number | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const planRef = useRef(plan ?? null);
  planRef.current = plan ?? null;
  const unitsRef = useRef(units);
  unitsRef.current = units;

  const runSeconds = useCallback(
    (now: number) => banked.current + (since.current == null ? 0 : (now - since.current) / 1000),
    [],
  );

  const say = useCallback((text: string, kind: RunNote['kind'], at: number) => {
    setNotes((current) => [{ at, text, kind }, ...current].slice(0, 40));
    if (settingsRef.current.voice) speak(speakable(text));
  }, []);

  /** One fix: distance, pace, and then everything that might need saying about them. */
  const handle = useCallback(
    (fix: Fix | null, failure: Error | null) => {
      if (failure) {
        setError(failure.message);
        return;
      }
      if (!fix || !usable(fix)) return;
      setError(null);

      const now = fix.at;
      if (previous.current) totalM.current += metresBetween(previous.current, fix);
      previous.current = fix;

      buffer.current = [...buffer.current, fix].filter((f) => now - f.at <= BUFFER_MS);

      const paceNow = readPace(buffer.current, now);
      setReading(paceNow);
      setDistanceM(totalM.current);

      const seconds = runSeconds(now);
      setElapsedSec(seconds);

      const current = settingsRef.current;
      const target =
        current.targetSecPerKm != null
          ? { targetSecPerKm: current.targetSecPerKm, toleranceSecPerKm: current.toleranceSecPerKm }
          : undefined;

      /*
       * Segments first, splits second, drift last, and at most one of them per fix.
       *
       * They are in order of how much a runner wants them: being told the next rep matters
       * more than the split that fell in the same stride, which matters more than a drift
       * warning about a pace you are about to change anyway. Saying two at once means hearing
       * neither.
       */
      const activePlan = planRef.current;
      if (activePlan) {
        const change = advanceRun({
          plan: activePlan,
          cursor: cursorRef.current,
          distanceM: totalM.current,
          elapsedSec: seconds,
        });
        if (change.entering || change.finished) {
          cursorRef.current = change.cursor;
          setCursor(change.cursor);

          const sentence = current.segmentCues ? sayChange(change, unitsRef.current) : null;
          if (sentence) {
            say(sentence, 'segment', now);
            return;
          }
        }
      }

      if (current.splits && splitState.current) {
        const decision = decideSplit({
          distanceM: totalM.current,
          now,
          interval: current.splitUnit,
          state: splitState.current,
          target,
        });
        splitState.current = decision.state;
        if (decision.cue) {
          say(
            saySplit({ cue: decision.cue, interval: current.splitUnit, units: unitsRef.current, elapsedSec: seconds }),
            'split',
            now,
          );
          return;
        }
      }

      if (alertsArmed(current) && target && cueState.current) {
        const decision = decideCue({ reading: paceNow, target, state: cueState.current, now });
        cueState.current = decision.state;
        if (decision.kind) {
          say(sayDrift({ kind: decision.kind, reading: paceNow, target, units: unitsRef.current }), 'drift', now);
        }
      }
    },
    [runSeconds, say],
  );

  const start = useCallback(() => {
    if (status === 'running') return;

    // The tap that starts the run is the one that buys us a voice for the rest of it.
    unlockSpeech();

    const now = Date.now();
    buffer.current = [];
    previous.current = null;
    totalM.current = 0;
    banked.current = 0;
    since.current = now;
    splitState.current = startSplits(now);
    cueState.current = { last: null, lastAt: now, startedAt: now };
    cursorRef.current = startRun();

    setCursor(startRun());
    setDistanceM(0);
    setElapsedSec(0);
    setReading(null);
    setNotes([]);
    setError(null);
    setStatus('running');

    const opening = sayStart(planRef.current?.segments[0] ?? null, unitsRef.current);
    say(opening, 'start', now);

    void source
      .watch(
        {
          backgroundTitle: 'Forge',
          backgroundMessage: 'Tracking your run',
          distanceFilter: 0,
        },
        handle,
      )
      .then((handle) => {
        watch.current = handle;
      })
      .catch((failure: Error) => {
        setError(failure.message);
        setStatus('idle');
      });
  }, [handle, say, source, status]);

  const pause = useCallback(() => {
    if (status !== 'running') return;
    banked.current = runSeconds(Date.now());
    since.current = null;
    stopSpeaking();
    setStatus('paused');
  }, [runSeconds, status]);

  const resume = useCallback(() => {
    if (status !== 'paused') return;
    const now = Date.now();
    since.current = now;
    /*
     * The buffer is dropped rather than carried across the pause. Its fixes are from before a
     * gap of unknown length, and differencing across that gap would report the pace of
     * standing still for four minutes.
     */
    buffer.current = [];
    previous.current = null;
    // Splits and drift both measure from a moment, and both moments moved.
    splitState.current = { atMetres: totalM.current, atTime: now, count: splitState.current?.count ?? 0 };
    cueState.current = { last: null, lastAt: now, startedAt: now };
    setStatus('running');
  }, [status]);

  const finish = useCallback(() => {
    banked.current = runSeconds(Date.now());
    since.current = null;
    stopSpeaking();
    void watch.current?.stop();
    watch.current = null;
    setStatus('finished');
  }, [runSeconds]);

  /* The clock has to move between fixes, which arrive about once a second and sometimes not. */
  useEffect(() => {
    if (status !== 'running') return;
    const tick = setInterval(() => setElapsedSec(runSeconds(Date.now())), 500);
    return () => clearInterval(tick);
  }, [runSeconds, status]);

  /* A run left behind by a closed tab must not keep the receiver awake. */
  useEffect(
    () => () => {
      void watch.current?.stop();
      watch.current = null;
      stopSpeaking();
    },
    [],
  );

  const averageSecPerKm = distanceM > 0 && elapsedSec > 0 ? (elapsedSec / distanceM) * 1000 : null;

  return {
    status,
    distanceM,
    elapsedSec,
    reading,
    averageSecPerKm,
    progress: plan ? runProgress(plan, cursor, distanceM, elapsedSec) : null,
    notes,
    error,
    start,
    pause,
    resume,
    finish,
  };
}

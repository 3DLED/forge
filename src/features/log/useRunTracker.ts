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
import { locationSource, type LocationSource, type LocationWatch } from '../../data/locationSource';
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
import {
  advanceRun,
  runProgress,
  segmentAt,
  startRun,
  type RunCursor,
  type RunPlan,
  type RunProgress,
} from '../../domain/runPlan';
import { alertsArmed, type RunSettings } from '../../domain/runSettings';
import { sayChange, sayDrift, saySplit, sayStart, speakable } from '../../domain/runVoice';
import { speak, stopSpeaking, unlockSpeech } from '../../ui/speak';
import type { Language, UnitSystem } from '../../domain/types';

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

/** A piece already behind you, and what it actually cost. */
export interface FinishedPiece {
  index: number;
  distanceM: number;
  seconds: number;
}

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
  /**
   * Pieces already run, by their index in the plan.
   *
   * Kept so the session can be read as a whole rather than as whatever is happening now —
   * what you have done, what you are doing, and what is still to come, on one screen.
   */
  finished: FinishedPiece[];
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
  /** Absent means English. Decides the words and the voice, never the units. */
  lang?: Language;
  /** Absent for an unstructured run — splits and drift alerts still work. */
  plan?: RunPlan | null;
  /** Defaults to the right one for the platform; passed explicitly only by tests. */
  source?: LocationSource;
}): RunTracker {
  const { settings, units, lang, plan, source = locationSource() } = options;

  const [status, setStatus] = useState<RunStatus>('idle');
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [reading, setReading] = useState<PaceReading | null>(null);
  const [notes, setNotes] = useState<RunNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<RunCursor>(() => startRun());
  const [finishedPieces, setFinishedPieces] = useState<FinishedPiece[]>([]);

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
  const langRef = useRef(lang);
  langRef.current = lang;

  const runSeconds = useCallback(
    (now: number) => banked.current + (since.current == null ? 0 : (now - since.current) / 1000),
    [],
  );

  const say = useCallback((text: string, kind: RunNote['kind'], at: number) => {
    setNotes((current) => [{ at, text, kind }, ...current].slice(0, 40));
    if (settingsRef.current.voice) speak(speakable(text, langRef.current), langRef.current);
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
          const done = cursorRef.current.index;
          cursorRef.current = change.cursor;
          setCursor(change.cursor);
          if (change.covered) {
            setFinishedPieces((pieces) => [
              ...pieces,
              { index: done, distanceM: change.covered!.distanceM, seconds: change.covered!.seconds },
            ]);
          }

          /*
           * A new piece is a new effort against a new number, so the drift rules start over.
           *
           * Without this, being slow at the end of a recovery jog carries into the rep that
           * follows it and gets shouted at you ten seconds in, when you are still accelerating
           * and the target has just changed anyway. Restarting also reinstates the warm-up
           * grace, which is the same argument at the start of every rep as at the start of the
           * run.
           */
          cueState.current = { last: null, lastAt: now, startedAt: now };

          const sentence = current.segmentCues ? sayChange(change, unitsRef.current, langRef.current) : null;
          if (sentence) {
            say(sentence, 'segment', now);
            return;
          }
        }
      }

      /*
       * What you are aiming at *right now*.
       *
       * The piece being run outranks the standing target, and getting this the wrong way round
       * is loud: on a prescribed 11:16 recovery jog, an 8:00 easy-run target had the app
       * shouting "pick it up, 196 seconds slow" at somebody doing exactly what they were told.
       * The standing target is what to aim at when nothing else has said.
       *
       * The one place this is approximate is a split that straddles two pieces — half a rep
       * and half a float compared against the rep's number. The segment calls already report
       * each piece properly, so the split is the lesser of the two readings there.
       */
      const activeSegment = activePlan ? segmentAt(activePlan, cursorRef.current) : null;
      /*
       * With a session in hand, the session decides — including when it decides nothing.
       *
       * A warm-up and a cool-down carry no target on purpose, and falling back to the standing
       * one there would nag somebody for jogging gently during the ten minutes whose entire
       * job is jogging gently. The standing target is what to aim at on a run with no shape to
       * it, which is most runs, and it keeps that job exactly there.
       */
      const aim = activePlan ? activeSegment?.targetSecPerKm : current.targetSecPerKm;
      const target =
        aim != null ? { targetSecPerKm: aim, toleranceSecPerKm: current.toleranceSecPerKm } : undefined;

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
            saySplit({ cue: decision.cue, interval: current.splitUnit, units: unitsRef.current, lang: langRef.current, elapsedSec: seconds }),
            'split',
            now,
          );
          return;
        }
      }

      /*
       * Alerts stay gated on the standing setting even when the piece supplies the number.
       *
       * Switching pace alerts off has to mean off. A structured run is exactly the case where
       * a target exists whether or not anybody asked to be told about it.
       */
      if (alertsArmed(current, aim != null) && target && cueState.current) {
        const decision = decideCue({ reading: paceNow, target, state: cueState.current, now });
        cueState.current = decision.state;
        if (decision.kind) {
          say(sayDrift({ kind: decision.kind, reading: paceNow, target, units: unitsRef.current, lang: langRef.current }), 'drift', now);
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
    setFinishedPieces([]);
    setDistanceM(0);
    setElapsedSec(0);
    setReading(null);
    setNotes([]);
    setError(null);
    setStatus('running');

    const opening = sayStart(planRef.current?.segments[0] ?? null, unitsRef.current, langRef.current);
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
    finished: finishedPieces,
    notes,
    error,
    start,
    pause,
    resume,
    finish,
  };
}

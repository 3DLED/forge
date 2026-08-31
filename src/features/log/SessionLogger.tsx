/**
 * The logging screen — the one that has to work with cold hands between sets.
 *
 * Sets are held in local state and flushed to IndexedDB on a short debounce. Writing on
 * every keystroke would be a transaction per character; writing only at the end would lose
 * a session to a dropped phone. Half a second of lag is the right trade.
 *
 * Blocks are the exception: they live on the session record and are written immediately,
 * because they are created and edited far less often and a half-second window in which a
 * newly created block does not exist yet would make the "add a movement to it" flow racy.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../../ui/AppProvider';
import Sheet from '../../ui/Sheet';
import AskSheet from '../../ui/AskSheet';
import ExercisePicker from './ExercisePicker';
import ExerciseGroup from './ExerciseGroup';
import RestTimer, { type UpNext } from './RestTimer';
import WorkoutTimer from './WorkoutTimer';
import PinnedTimer from './PinnedTimer';
import { useBlockTimer } from './useBlockTimer';
import { blockShape, blockTitle } from './blockLabels';
import NewBlockSheet from './NewBlockSheet';
import SuggestWorkoutSheet from './SuggestWorkoutSheet';
import VariationSheet from './VariationSheet';
import ExerciseInfoSheet from './ExerciseInfoSheet';
import SessionEquipmentSheet from './SessionEquipmentSheet';
import { unlockAudio } from '../../ui/beep';
import { plural } from '../../ui/text';
import {
  addBlock,
  convertSessionToBlock,
  deleteSession,
  finishSession,
  getSession,
  lastPerformance,
  isStopwatchRunning,
  removeBlock,
  startStopwatch,
  updateBlock,
  updateSets,
} from '../../data/sessions';
import { loggedSessionRepo } from '../../data/repos';
import {
  describeMovements,
  nameBlock,
  saveSessionAsWorkout,
  savedWorkoutToSets,
  saveBlockAsWorkout,
  suggestedName,
  workoutHistory,
  workoutToDraft,
} from '../../data/namedWorkouts';
import { ulid } from '../../domain/ids';
import { formatDayLabel } from '../../domain/dates';
import { estimateDurationMin } from '../../domain/training';
import { formatClock } from '../../domain/units';
import { availableSlugs } from '../../domain/equipment';
import type { SuggestedItem } from '../../domain/generator';
import type {
  EquipmentTag,
  Exercise,
  Id,
  LoggedBlock,
  LoggedSession,
  LoggedSet,
  MetricKey,
  SessionTemplate,
} from '../../domain/types';

/** Used only when nothing prescribed a rest — a movement added by hand. */
const DEFAULT_REST_SEC = 90;

type Feel = NonNullable<LoggedSession['feel']>;

const FEELS: { value: Feel; label: string }[] = [
  { value: 'great', label: '💪 Great' },
  { value: 'good', label: '🙂 Good' },
  { value: 'ok', label: '😐 OK' },
  { value: 'rough', label: '😮‍💨 Rough' },
  { value: 'bad', label: '🥴 Bad' },
];

/** A movement with its sets. */
interface Group {
  slug: string;
  sets: LoggedSet[];
}

/** The screen is a list of these: loose movements, and timed blocks containing movements. */
type Section =
  | { kind: 'exercise'; key: string; group: Group }
  | { kind: 'block'; key: string; block: LoggedBlock; groups: Group[] };

export default function SessionLogger() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { units, exerciseBySlug, exercises, available, activeEquipment } = useApp();

  // Resolves to null when the session genuinely does not exist, so "loading" and "missing"
  // stay distinguishable — useLiveQuery reports undefined until the first read settles.
  const session = useLiveQuery(
    async () => (sessionId ? ((await getSession(sessionId)) ?? null) : null),
    [sessionId],
  );

  const [sets, setSets] = useState<LoggedSet[] | null>(null);
  /** Non-null while the picker is open; carries the block to add into, if any. */
  const [picking, setPicking] = useState<{ blockId?: Id } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  /** The movement the current rest follows, which is what makes "up next" answerable. */
  const [restingAfter, setRestingAfter] = useState<string | null>(null);
  /**
   * Opt-in editing of a workout that is already finished.
   *
   * Resets to false on every mount, so arriving from History always lands in review. Anything
   * else means the state of the last session you edited decides whether the next one you open
   * is live — and the whole point is that a scroll through old workouts cannot change them.
   */
  const [editing, setEditing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [creatingBlock, setCreatingBlock] = useState<'new' | 'convert' | null>(null);
  /** The block whose shape is being changed — AMRAP to EMOM, a longer cap, more rounds. */
  const [editingBlockId, setEditingBlockId] = useState<Id | null>(null);
  /** The block holding the pinned strip. Not necessarily running — loaded is enough. */
  const [activeBlockId, setActiveBlockId] = useState<Id | null>(null);
  /** Whether the full timer is open over it. The clock runs either way. */
  const [timerExpanded, setTimerExpanded] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(false);
  const [namingBlockId, setNamingBlockId] = useState<Id | null>(null);
  const [namingSession, setNamingSession] = useState(false);
  const [swappingSlug, setSwappingSlug] = useState<string | null>(null);
  const [infoSlug, setInfoSlug] = useState<string | null>(null);
  /**
   * Which session the local `sets` were loaded from.
   *
   * This must be an id, never a boolean. Routing between two sessions reuses this component,
   * so a plain "have I hydrated?" flag stays true across the switch: the load is skipped for
   * the new session while the save fires immediately, writing the previous session's sets
   * over it. Comparing ids means sets can only ever be written back to their own session.
   */
  const hydratedFor = useRef<Id | null>(null);

  useEffect(() => {
    if (session && hydratedFor.current !== session.id) {
      setSets(session.sets);
      hydratedFor.current = session.id;
    }
  }, [session]);

  useEffect(() => {
    if (!sets || !sessionId || hydratedFor.current !== sessionId) return;
    const timer = setTimeout(() => void updateSets(sessionId, sets), 400);
    return () => clearTimeout(timer);
  }, [sets, sessionId]);

  const blocks = useMemo(() => session?.blocks ?? [], [session]);

  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === activeBlockId) ?? null,
    [blocks, activeBlockId],
  );

  /*
   * Held here rather than inside the timer sheet, which is what lets the strip keep counting
   * after the sheet is dismissed. Must sit above the early returns below — it is a hook.
   */
  const timer = useBlockTimer(activeBlock, () => {
    if (session) void startStopwatch(session);
  });

  /*
   * One tick for the session clock in the strip, only while it is actually running. Depending
   * on the boolean rather than the session keeps this from tearing down and rebuilding the
   * interval on every keystroke — the session is a live query and changes identity constantly.
   */
  const stopwatchRunning = session ? isStopwatchRunning(session) : false;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!stopwatchRunning) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [stopwatchRunning]);

  /**
   * What this session can actually do. Falls back to the profile default when the session
   * carries no override, so an untouched workout behaves exactly as before.
   */
  const sessionTags = session?.equipmentTags;
  const sessionAvailable = useMemo(
    () => (sessionTags ? availableSlugs(exercises, sessionTags) : available),
    [sessionTags, exercises, available],
  );

  /**
   * Sections in the order the sets were added, so a block appears where its first movement
   * does rather than being hoisted to the top or bottom.
   */
  const sections = useMemo(() => {
    if (!sets) return [] as Section[];

    const blockById = new Map(blocks.map((b) => [b.id, b]));
    const out: Section[] = [];
    const blockSections = new Map<Id, Extract<Section, { kind: 'block' }>>();
    const looseSections = new Map<string, Extract<Section, { kind: 'exercise' }>>();

    for (const set of sets) {
      const block = set.blockId ? blockById.get(set.blockId) : undefined;

      if (block) {
        let section = blockSections.get(block.id);
        if (!section) {
          section = { kind: 'block', key: block.id, block, groups: [] };
          blockSections.set(block.id, section);
          out.push(section);
        }
        let group = section.groups.find((g) => g.slug === set.exerciseSlug);
        if (!group) {
          group = { slug: set.exerciseSlug, sets: [] };
          section.groups.push(group);
        }
        group.sets.push(set);
        continue;
      }

      let section = looseSections.get(set.exerciseSlug);
      if (!section) {
        section = { kind: 'exercise', key: set.exerciseSlug, group: { slug: set.exerciseSlug, sets: [] } };
        looseSections.set(set.exerciseSlug, section);
        out.push(section);
      }
      section.group.sets.push(set);
    }

    // Blocks created but not yet filled have no sets to place them, so they go last.
    for (const block of blocks) {
      if (!blockSections.has(block.id)) {
        out.push({ kind: 'block', key: block.id, block, groups: [] });
      }
    }

    return out;
  }, [sets, blocks]);

  const allSlugs = useMemo(
    () => [...new Set((sets ?? []).map((s) => s.exerciseSlug))].join('|'),
    [sets],
  );

  /**
   * What is already in the workout, as a stable set. Keyed off the joined string so the
   * identity only changes when the movements do — the generator re-runs on it, and a fresh
   * Set every render would re-run it on every keystroke.
   */
  const loggedSlugs = useMemo(
    () => new Set(allSlugs ? allSlugs.split('|') : []),
    [allSlugs],
  );

  /** Previous runs of each named block, so a result can be read against its own history. */
  const templateIds = blocks.map((b) => b.sourceTemplateId).filter(Boolean).join('|');
  const blockHistories = useLiveQuery(async () => {
    const ids = templateIds ? templateIds.split('|') : [];
    const entries = await Promise.all(
      ids.map(async (id) => [id, await workoutHistory(id, 5)] as const),
    );
    return new Map(entries);
  }, [templateIds]);

  const history = useLiveQuery(async () => {
    const slugs = allSlugs ? allSlugs.split('|') : [];
    const entries = await Promise.all(
      slugs.map(async (slug) => [slug, await lastPerformance(slug, sessionId)] as const),
    );
    return new Map(entries);
  }, [allSlugs, sessionId]);

  if (!sessionId) return null;
  if (session === undefined) return <p className="muted">Loading…</p>;
  if (session === null || !sets) {
    return (
      <div className="empty">
        <span className="glyph">🤷</span>
        <p>That session is gone.</p>
        <button className="btn" onClick={() => navigate('/today')}>Back to today</button>
      </div>
    );
  }

  /**
   * A finished workout is a record until you say otherwise.
   *
   * History links straight into this screen, so without the gate every past session is one
   * mis-tap from being rewritten — silently, since the sets flush on a debounce and nothing
   * announces the change. The flag is derived from the session, not from how you got here,
   * which means an in-progress workout is always live no matter which screen opened it.
   */
  const finished = Boolean(session.endedAt);
  const readOnly = finished && !editing;

  // The single choke point every set edit goes through, so review mode cannot be defeated by
  // a control that was missed when the buttons were hidden.
  const mutate = (next: LoggedSet[]) => {
    if (readOnly) return;
    setSets(next);
  };

  const addExercise = async (exercise: Exercise) => {
    const blockId = picking?.blockId;
    setPicking(null);

    // Start from what you did last time — far more useful than an empty row.
    const previous = await lastPerformance(exercise.slug, sessionId);
    const seed = previous?.sets.at(-1)?.values ?? {};
    const values = Object.fromEntries(
      exercise.metrics.filter((m) => m !== 'rpe' && seed[m] != null).map((m) => [m, seed[m]]),
    );

    mutate([
      ...sets,
      { id: ulid(), exerciseSlug: exercise.slug, blockId, setIndex: 0, values, completed: false },
    ]);
  };

  /**
   * Accepts a generated draft: every movement arrives with its prescribed number of sets and
   * the rep or time target pre-filled. Load is left blank on purpose — what the bar should
   * weigh is the one thing the generator has no business guessing.
   */
  const addSuggested = (items: SuggestedItem[], timed?: boolean) => {
    setSuggesting(false);
    const created: LoggedSet[] = [];
    for (const item of items) {
      for (let index = 0; index < item.sets; index++) {
        created.push({
          id: ulid(),
          exerciseSlug: item.exercise.slug,
          setIndex: index,
          values: { ...item.values },
          restSec: item.restSec,
          completed: false,
        });
      }
    }
    mutate([...sets, ...created]);

    // Straight into the block sheet, where the shape is chosen. The conversion collapses the
    // sets to one row per movement on the way through, so an AMRAP built here and one built
    // after the fact come out identical rather than by two near-identical routes.
    if (timed) setCreatingBlock('convert');
  };

  /** Re-runs a saved session: its movements and sets, blank, ready to log against. */
  const useSavedSession = (template: SessionTemplate) => {
    setSuggesting(false);
    mutate([...sets, ...savedWorkoutToSets(template)]);
  };

  const addSet = (slug: string) => {
    const existing = sets.filter((s) => s.exerciseSlug === slug && !s.blockId);
    const previous = existing.at(-1);
    const insertAfter = previous ? sets.lastIndexOf(previous) : sets.length - 1;
    const created: LoggedSet = {
      id: ulid(),
      exerciseSlug: slug,
      setIndex: existing.length,
      values: { ...(previous?.values ?? {}) },
      restSec: previous?.restSec,
      completed: false,
    };
    mutate([...sets.slice(0, insertAfter + 1), created, ...sets.slice(insertAfter + 1)]);
  };

  const setValue = (setId: string, metric: MetricKey, value: number | undefined) => {
    mutate(
      sets.map((set) =>
        set.id === setId ? { ...set, values: { ...set.values, [metric]: value } } : set,
      ),
    );
  };

  const toggleComplete = (setId: string) => {
    const target = sets.find((s) => s.id === setId);
    mutate(sets.map((set) => (set.id === setId ? { ...set, completed: !set.completed } : set)));
    // Completing a set starts the clock; un-completing one should not. The rest the set was
    // prescribed wins: telling you to rest three minutes and then handing you a ninety-second
    // timer is the app disagreeing with itself.
    if (target && !target.completed) {
      // This tap is the only user gesture in the rest flow, and browsers hand out an
      // AudioContext nowhere else. Unlocking here is what lets the timer make a sound when
      // it runs out — by then there is no gesture left to ask for one.
      unlockAudio();
      setRestEndsAt(Date.now() + (target.restSec ?? DEFAULT_REST_SEC) * 1000);
      setRestingAfter(target.exerciseSlug);

      /*
       * Ticking your first set is starting the workout.
       *
       * The same argument the block timer already made for itself: a clock you have to
       * remember to start separately is a clock that records zero. Nothing else in a straight
       * strength session ever started it, so a session of nothing but sets came out with no
       * duration and no training load.
       *
       * Only ever the first tick. Once the clock has been touched at all, a later pause was a
       * deliberate act — you racked the bar to take a call — and completing the next set
       * should not quietly undo it. Finished workouts are excluded outright: editing a
       * session from March must not set its clock running today.
       */
      const clockUntouched = !session.runningSince && !session.elapsedSec;
      if (!finished && clockUntouched) void startStopwatch(session);
    }
  };

  const endRest = () => {
    setRestEndsAt(null);
    setRestingAfter(null);
  };

  const removeSet = (setId: string) => mutate(sets.filter((s) => s.id !== setId));

  /**
   * Swaps a movement for another rung on its ladder, keeping the sets.
   *
   * Reps and load carry over untouched. They are wrong for the new movement about as often as
   * they are right, but they are a starting point you can edit, whereas emptying every row
   * punishes you for finding the exercise too hard — which is exactly when this gets used.
   */
  const swapExercise = (from: string, to: Exercise) => {
    setSwappingSlug(null);
    if (from === to.slug) return;
    mutate(sets.map((set) => (set.exerciseSlug === from ? { ...set, exerciseSlug: to.slug } : set)));
  };

  /** Removes a movement from one context only — the block it is in, or the loose list. */
  const removeExerciseFrom = (slug: string, blockId?: Id) =>
    mutate(sets.filter((s) => !(s.exerciseSlug === slug && s.blockId === blockId)));

  const completedCount = sets.filter((s) => s.completed).length;
  const looseCount = sets.filter((s) => !s.blockId).length;
  const activeSection = sections.find(
    (s): s is Extract<Section, { kind: 'block' }> =>
      s.kind === 'block' && s.block.id === activeBlockId,
  );

  /**
   * What the rest is for.
   *
   * Sets left on the movement you just finished win: mid-movement the honest answer is
   * "another one of those", and naming the movement after it instead would send you down the
   * screen to something you are not ready for. Blocks are skipped — a round recipe is never
   * ticked off, so it has no next set to point at.
   */
  const upNext: (UpNext & { slug: string }) | null = (() => {
    if (!restingAfter) return null;
    const loose = sets.filter((set) => !set.blockId);

    const onSameMovement = loose.filter((set) => set.exerciseSlug === restingAfter);
    const remaining = onSameMovement.filter((set) => !set.completed);
    if (remaining.length > 0) {
      const name = exerciseBySlug.get(restingAfter)?.name ?? restingAfter;
      const doneHere = onSameMovement.length - remaining.length;
      return {
        slug: restingAfter,
        sameMovement: true,
        label: `Set ${doneHere + 1} of ${onSameMovement.length} · ${name}`,
      };
    }

    const next = loose.find((set) => !set.completed);
    if (!next) return null;
    return {
      slug: next.exerciseSlug,
      sameMovement: false,
      label: exerciseBySlug.get(next.exerciseSlug)?.name ?? next.exerciseSlug,
    };
  })();

  const jumpToNext = () => {
    const slug = upNext?.slug;
    endRest();
    if (!slug) return;
    // After the panel has gone, or the scroll lands under where it used to be.
    requestAnimationFrame(() => {
      document
        .getElementById(`movement-${slug}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  /** "10 × Burpee" lines for the timer, so a round can be read off the screen mid-effort. */
  const movementLines = (groups: Group[]): string[] =>
    groups.flatMap((group) =>
      group.sets.map((set) => {
        const name = exerciseBySlug.get(group.slug)?.name ?? group.slug;
        const reps = set.values.reps;
        const time = set.values.timeSec;
        const distance = set.values.distanceM;
        if (reps) return `${reps} × ${name}`;
        if (time) return `${formatClock(time)} ${name}`;
        if (distance) return `${distance} m ${name}`;
        return name;
      }),
    );

  return (
    <>
      {/*
        The strip belongs to a workout in progress, not to one being edited.
        
        Gated on the session being unfinished rather than on the screen being editable: in
        edit mode its Start button would set a clock running on a workout that ended weeks
        ago, and elapsed time is derived from that timestamp, so it would climb from then on.
        There is nothing to time about correcting a number after the fact.
      */}
      {!finished && (
        <>
          <PinnedTimer
            session={session}
            now={now}
            timer={timer}
            onExpand={() => setTimerExpanded(true)}
            onCloseBlock={() => {
              setActiveBlockId(null);
              setTimerExpanded(false);
            }}
          />
          {/* Holds the space the fixed strip occupies, so the title is not underneath it. */}
          <div className="pinned-spacer" />
        </>
      )}

      <header className="page-head">
        <div className="grow">
          {readOnly ? (
            <h1 className="session-title-static">{session.name}</h1>
          ) : (
            <input
              className="session-title"
              value={session.name}
              aria-label="Session name"
              onChange={(event) => void loggedSessionRepo.update(session.id, { name: event.target.value })}
            />
          )}
          <div className="subtitle">
            {formatDayLabel(session.date)} · {completedCount} of {sets.length} sets done
          </div>
        </div>
        {finished && (
          <button className="btn sm" onClick={() => setEditing((on) => !on)}>
            {readOnly ? '✎ Edit' : 'Done'}
          </button>
        )}
      </header>

      {readOnly ? (
        <div className="card tight">
          <span className="review-note">
            Finished workout — reviewing. Tap Edit to change anything.
          </span>
          {(session.durationMin || session.sessionRpe || session.feel) && (
            <div className="tiny faint" style={{ marginTop: '0.35rem' }}>
              {[
                session.durationMin && `${session.durationMin} min`,
                session.sessionRpe && `effort ${session.sessionRpe}`,
                session.feel && `felt ${session.feel}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          {session.notes && (
            <div className="small muted" style={{ marginTop: '0.35rem' }}>
              {session.notes}
            </div>
          )}
        </div>
      ) : (
        <div className="card tight">
          {finished && (
            <div className="review-note" style={{ marginBottom: '0.5rem' }}>
              Editing a finished workout. Changes save as you make them.
            </div>
          )}
          <button className="btn sm block" onClick={() => setCreatingBlock('new')}>
            ⏱ Add block
          </button>

          <button
            className="btn sm block"
            style={{ marginTop: '0.5rem' }}
            onClick={() => setEditingEquipment(true)}
          >
            🎒 {sessionTags ? 'Custom equipment' : (activeEquipment?.name ?? 'Equipment')} ·{' '}
            {sessionAvailable.size} movements
          </button>
        </div>
      )}

      {sections.length === 0 && (
        <div className="empty">
          <span className="glyph">🏋️</span>
          <p>Nothing logged{readOnly ? ' in this one' : ' yet'}.</p>
          {!readOnly && (
            <p className="small faint">Add a movement, or start an AMRAP or EMOM block.</p>
          )}
        </div>
      )}

      {sections.map((section) =>
        section.kind === 'exercise' ? (
          <ExerciseGroup
            key={section.key}
            id={`movement-${section.group.slug}`}
            slug={section.group.slug}
            sets={section.group.sets}
            exercise={exerciseBySlug.get(section.group.slug)}
            units={units}
            previous={history?.get(section.group.slug)}
            readOnly={readOnly}
            onSetValue={setValue}
            onToggle={toggleComplete}
            onRemoveSet={removeSet}
            onAddSet={addSet}
            onRemoveExercise={(slug) => removeExerciseFrom(slug)}
            onSwapExercise={setSwappingSlug}
            onShowInfo={setInfoSlug}
          />
        ) : (
          <section className="card block-card" key={section.key}>
            <div className="card-head">
              <div className="grow">
                <h3 className="truncate">{blockTitle(section.block)}</h3>
                <div className="tiny faint">
                  {section.block.label ? `${blockShape(section.block)} · ` : ''}
                  {section.groups.length === 0
                    ? 'Add the movements that make up one round'
                    : describeMovements(
                        section.groups.flatMap((g) => g.sets),
                        exerciseBySlug,
                      )}
                </div>
              </div>
              {section.block.rounds != null && (
                <span className="pill accent">{plural(section.block.rounds, 'round')}</span>
              )}
            </div>

            {/* Only ever compared against itself — see the note in namedWorkouts.ts. */}
            {(() => {
              const past = section.block.sourceTemplateId
                ? (blockHistories?.get(section.block.sourceTemplateId) ?? []).filter(
                    (r) => r.sessionId !== session.id,
                  )
                : [];
              if (past.length === 0) return null;
              const last = past[0];
              return (
                <div className="tiny faint" style={{ marginBottom: '0.4rem' }}>
                  Last time ({formatDayLabel(last.date).toLowerCase()}):{' '}
                  {last.rounds != null ? plural(last.rounds, 'round') : ''}
                  {last.rounds != null && last.timeSec ? ' in ' : ''}
                  {last.timeSec ? formatClock(last.timeSec) : ''}
                </div>
              );
            })()}

            {section.groups.length > 0 && <div className="round-recipe-title">Each round</div>}

            {section.groups.map((group) => (
              <ExerciseGroup
                key={group.slug}
                slug={group.slug}
                sets={group.sets}
                exercise={exerciseBySlug.get(group.slug)}
                units={units}
                nested
                readOnly={readOnly}
                onSetValue={setValue}
                onToggle={toggleComplete}
                onRemoveSet={removeSet}
                onAddSet={addSet}
                onRemoveExercise={(slug) => removeExerciseFrom(slug, section.block.id)}
                onSwapExercise={setSwappingSlug}
                onShowInfo={setInfoSlug}
              />
            ))}

            {!readOnly && (
              <>
                <button
                  className="btn sm block"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => setPicking({ blockId: section.block.id })}
                >
                  + Add movement to this block
                </button>

                <button
                  className="btn primary block"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => {
                    setActiveBlockId(section.block.id);
                    setTimerExpanded(true);
                  }}
                >
                  {section.block.timeSec ? 'Open timer' : 'Start timer'}
                </button>

                {/*
                  Second thoughts about the shape are common — you build a for-time piece,
                  look at it, and decide it wants to be an AMRAP. Ungrouping and converting
                  again is the long way round to the same place.
                */}
                <button
                  className="btn sm block"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => setEditingBlockId(section.block.id)}
                >
                  ⏱ Edit timed workout
                </button>
              </>
            )}

            {section.block.timeSec != null && (
              <div className="tiny faint" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                {section.block.rounds != null && `${plural(section.block.rounds, 'round')} · `}
                {formatClock(section.block.timeSec)}
                {(section.block.roundSplitsSec?.length ?? 0) > 1 &&
                  ` · avg round ${formatClock(
                    section.block.roundSplitsSec!.at(-1)! / section.block.roundSplitsSec!.length,
                  )}`}
              </div>
            )}

            {section.groups.length > 0 && !readOnly && (
              <button
                className="btn sm block"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setNamingBlockId(section.block.id)}
              >
                {section.block.sourceTemplateId ? '✎ Rename workout' : '💾 Name & save this workout'}
              </button>
            )}

            {!readOnly && (
              <button
                className="btn ghost sm block"
                style={{ marginTop: '0.25rem' }}
                onClick={async () => {
                  /*
                   * Both halves matter.
                   *
                   * The sets on screen live in local state and are flushed on a debounce, so
                   * the stored copy this reads from can be behind — passing it plain loses
                   * whatever was typed in the last half second. And ungrouping has to be
                   * mirrored locally, because everything that asks "is there loose work here"
                   * counts local blockIds. Without it the movements detach visually while the
                   * controls that act on loose sets — save as a workout, make this timed —
                   * stay hidden, with nothing on screen explaining why.
                   */
                  const blockId = section.block.id;
                  await removeBlock({ ...session, sets }, blockId);
                  mutate(
                    sets.map((set) => (set.blockId === blockId ? { ...set, blockId: undefined } : set)),
                  );
                }}
              >
                Ungroup block
              </button>
            )}
          </section>
        ),
      )}

      {!readOnly && (
        <>
          <button
            className="btn block"
            onClick={() => setPicking({})}
            style={{ marginTop: '0.5rem' }}
          >
            + Add exercise
          </button>

          <button
            className="btn block"
            onClick={() => setSuggesting(true)}
            style={{ marginTop: '0.5rem' }}
          >
            ✨ Suggest a workout
          </button>
        </>
      )}

      {/*
        Saving a workout as a template reads the session without touching it, so it stays
        offered while reviewing — "that one was good, run it again" is a thought you have
        looking back at it, not only in the moment.
      */}
      {looseCount > 0 && (
        <button
          className="btn block"
          style={{ marginTop: '0.5rem' }}
          onClick={() => setNamingSession(true)}
        >
          💾 Save as a workout
        </button>
      )}

      {/* Names all three shapes, because the sheet behind it offers all three. */}
      {looseCount > 0 && !readOnly && (
        <button
          className="btn block"
          style={{ marginTop: '0.5rem' }}
          onClick={() => setCreatingBlock('convert')}
        >
          ⏱ Make this a timed workout
        </button>
      )}

      {/*
        Finish is deliberately NOT the accent colour. The accent belongs to checking off a
        set — the thing done twenty times a session.
      */}
      {!readOnly && (
        <button
          className="btn block finish-btn"
          style={{ marginTop: '0.75rem' }}
          onClick={() => setFinishing(true)}
        >
          {finished ? 'Edit effort, duration & notes' : 'Finish workout'}
        </button>
      )}

      {!readOnly && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button className="btn ghost sm danger" onClick={() => setDiscarding(true)}>
            Discard session
          </button>
        </div>
      )}

      {picking && (
        <ExercisePicker
          onPick={addExercise}
          onClose={() => setPicking(null)}
          available={sessionAvailable}
        />
      )}

      {suggesting && (
        <SuggestWorkoutSheet
          available={sessionAvailable}
          existingSlugs={loggedSlugs}
          onAdd={addSuggested}
          onUseSaved={useSavedSession}
          onClose={() => setSuggesting(false)}
        />
      )}

      {infoSlug && (() => {
        const target = exerciseBySlug.get(infoSlug);
        if (!target) return null;
        return (
          <ExerciseInfoSheet
            exercise={target}
            onClose={() => setInfoSlug(null)}
            onSwap={() => {
              setInfoSlug(null);
              setSwappingSlug(infoSlug);
            }}
          />
        );
      })()}

      {swappingSlug && (() => {
        const target = exerciseBySlug.get(swappingSlug);
        if (!target) return null;
        return (
          <VariationSheet
            exercise={target}
            available={sessionAvailable}
            onClose={() => setSwappingSlug(null)}
            onPick={(next) => swapExercise(swappingSlug, next)}
          />
        );
      })()}

      {namingSession && (
        <AskSheet
          title="Save this workout"
          message="Saved sessions come back from ‘Suggest a workout’, and can be dropped onto a day in your plan."
          input={{
            label: 'Name',
            defaultValue: suggestedName(sets.filter((x) => !x.blockId), exerciseBySlug),
            placeholder: 'Upper A',
            required: true,
          }}
          confirmLabel="Save workout"
          onCancel={() => setNamingSession(false)}
          onConfirm={async (name) => {
            await saveSessionAsWorkout(name.trim(), sets.filter((x) => !x.blockId));
            setNamingSession(false);
          }}
        />
      )}

      {namingBlockId && (() => {
        const target = blocks.find((b) => b.id === namingBlockId);
        const blockSets = sets.filter((x) => x.blockId === namingBlockId);
        if (!target) return null;
        return (
          <AskSheet
            title={target.sourceTemplateId ? 'Rename this workout' : 'Name this workout'}
            message="Saved workouts can be started again from the block menu, dropped onto a day in your plan, and compared against their own history."
            input={{
              label: 'Name',
              defaultValue: target.label ?? suggestedName(blockSets, exerciseBySlug),
              placeholder: 'Cindy',
              required: true,
            }}
            confirmLabel="Save workout"
            onCancel={() => setNamingBlockId(null)}
            onConfirm={async (name) => {
              const fresh = await getSession(session.id);
              if (!fresh) return;
              if (target.sourceTemplateId) {
                await nameBlock(fresh, target.id, name.trim());
              } else {
                const template = await saveBlockAsWorkout(name.trim(), target, blockSets);
                const reread = await getSession(session.id);
                if (reread) await nameBlock(reread, target.id, name.trim(), template.id);
              }
              setNamingBlockId(null);
            }}
          />
        );
      })()}

      {editingEquipment && (
        <SessionEquipmentSheet
          current={sessionTags ?? activeEquipment?.items ?? []}
          isOverridden={Boolean(sessionTags)}
          onClose={() => setEditingEquipment(false)}
          onApply={async (next: EquipmentTag[]) => {
            await loggedSessionRepo.update(session.id, { equipmentTags: next });
            setEditingEquipment(false);
          }}
          onReset={async () => {
            await loggedSessionRepo.update(session.id, { equipmentTags: undefined });
            setEditingEquipment(false);
          }}
        />
      )}

      {creatingBlock && (
        <NewBlockSheet
          title={creatingBlock === 'convert' ? 'Make this a timed workout' : 'Add a timed block'}
          confirmLabel={creatingBlock === 'convert' ? 'Convert workout' : 'Add block'}
          message={
            creatingBlock === 'convert'
              ? 'Each movement becomes one line of a round — in a timed piece the rounds replace the sets, so four sets of one movement collapse to one. Anything already ticked off is kept.'
              : undefined
          }
          onClose={() => setCreatingBlock(null)}
          onPickSaved={
            creatingBlock === 'new'
              ? async (template: SessionTemplate) => {
                  const draft = workoutToDraft(template);
                  if (!draft) return;
                  const created = await addBlock({ ...session, sets }, draft.block);
                  mutate([
                    ...sets,
                    ...draft.items.map((item) => ({
                      id: ulid(),
                      exerciseSlug: item.exerciseSlug,
                      blockId: created.id,
                      setIndex: 0,
                      values: item.values,
                      completed: false,
                    })),
                  ]);
                  setCreatingBlock(null);
                }
              : undefined
          }
          onCreate={async (draft) => {
            if (creatingBlock === 'convert') {
              const converted = await convertSessionToBlock({ ...session, sets }, draft);
              mutate(converted.sets);
            } else {
              await addBlock({ ...session, sets }, draft);
            }
            setCreatingBlock(null);
          }}
        />
      )}

      {editingBlockId && (() => {
        const target = blocks.find((b) => b.id === editingBlockId);
        if (!target) return null;
        return (
          <NewBlockSheet
            title="Edit timed workout"
            confirmLabel="Save changes"
            message="Movements and anything already recorded stay as they are — only the shape of the clock changes."
            initial={target}
            onClose={() => setEditingBlockId(null)}
            onCreate={async (draft) => {
              await updateBlock({ ...session, sets }, editingBlockId, draft);
              setEditingBlockId(null);
            }}
          />
        );
      })()}

      {timer && timerExpanded && (
        <WorkoutTimer
          timer={timer}
          movements={activeSection ? movementLines(activeSection.groups) : []}
          // Collapsing, not stopping. The strip has the clock.
          onClose={() => setTimerExpanded(false)}
          onSave={async (result) => {
            await updateBlock({ ...session, sets }, timer.block.id, {
              rounds: result.rounds,
              roundSplitsSec: result.roundSplitsSec,
              timeSec: result.timeSec,
            });
            setTimerExpanded(false);
            setActiveBlockId(null);
          }}
        />
      )}

      {restEndsAt && (
        <RestTimer
          endsAt={restEndsAt}
          upNext={upNext}
          onExtend={(seconds) => setRestEndsAt((end) => (end ?? Date.now()) + seconds * 1000)}
          onDismiss={endRest}
          onJump={jumpToNext}
        />
      )}

      {discarding && (
        <AskSheet
          title="Discard this session?"
          message="Everything logged here is removed. If it came from a plan, that session goes back to unstarted."
          confirmLabel="Discard"
          danger
          onCancel={() => setDiscarding(false)}
          onConfirm={async () => {
            await deleteSession(session);
            navigate('/today');
          }}
        />
      )}

      {finishing && (
        <FinishSheet
          finished={finished}
          onClose={() => setFinishing(false)}
          onSave={async (details) => {
            await updateSets(session.id, sets);
            await finishSession({ ...session, sets }, details);
            navigate('/history');
          }}
          suggestedMinutes={estimateDurationMin({ ...session, sets })}
          existing={session}
        />
      )}
    </>
  );
}

function FinishSheet({
  onClose,
  onSave,
  suggestedMinutes,
  existing,
  finished,
}: {
  onClose: () => void;
  onSave: (details: {
    sessionRpe?: number;
    feel?: Feel;
    notes?: string;
    durationMin?: number;
  }) => Promise<void>;
  suggestedMinutes: number;
  /** A session finished earlier, so reopening it shows what was entered rather than blanks. */
  existing: LoggedSession;
  /** Already finished: this is an edit of the details, not the end of a workout. */
  finished: boolean;
}) {
  const [rpe, setRpe] = useState<number | undefined>(existing.sessionRpe);
  const [feel, setFeel] = useState<Feel | undefined>(existing.feel);
  const [notes, setNotes] = useState(existing.notes ?? '');
  const [minutes, setMinutes] = useState(String(existing.durationMin ?? suggestedMinutes));
  const [saving, setSaving] = useState(false);

  const load = rpe ? Math.round(rpe * (Number(minutes) || 0)) : null;

  return (
    <Sheet
      title={finished ? 'Workout details' : 'Finish workout'}
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave({
              sessionRpe: rpe,
              feel,
              notes: notes.trim() || undefined,
              durationMin: Number(minutes) || undefined,
            });
          }}
        >
          {saving ? 'Saving…' : finished ? 'Save changes' : 'Save workout'}
        </button>
      }
    >
      <p className="small muted">
        How hard was the whole session? This is what makes running and lifting comparable —
        effort × minutes is the one load number that spans both.
      </p>

      <div className="section-title">Effort</div>
      <div className="chip-row">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
          <button
            key={value}
            className={`chip${rpe === value ? ' on' : ''}`}
            onClick={() => setRpe(value)}
            style={{ minWidth: '44px', justifyContent: 'center' }}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="tiny faint" style={{ marginTop: '0.25rem' }}>
        1 = barely moved · 5 = solid work · 8 = hard · 10 = everything you had
      </div>

      <div className="section-title">Duration</div>
      <div className="row">
        <input
          type="number"
          inputMode="numeric"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          style={{ maxWidth: '7rem' }}
          aria-label="Duration in minutes"
        />
        <span className="muted small">minutes</span>
        {load != null && <span className="pill accent">load {load}</span>}
      </div>

      <div className="section-title">How did it feel?</div>
      <div className="chip-row">
        {FEELS.map((option) => (
          <button
            key={option.value}
            className={`chip${feel === option.value ? ' on' : ''}`}
            onClick={() => setFeel(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="section-title">Notes</div>
      <textarea
        rows={3}
        value={notes}
        placeholder="Anything worth remembering next time…"
        onChange={(event) => setNotes(event.target.value)}
      />
    </Sheet>
  );
}

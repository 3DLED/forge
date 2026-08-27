/**
 * The logging screen — the one that has to work with cold hands between sets.
 *
 * Sets are held in local state and flushed to IndexedDB on a short debounce. Writing on
 * every keystroke would be a transaction per character; writing only at the end would lose
 * a session to a dropped phone. Half a second of lag is the right trade.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../../ui/AppProvider';
import Sheet from '../../ui/Sheet';
import AskSheet from '../../ui/AskSheet';
import ExercisePicker from './ExercisePicker';
import MetricInput, { metricLabel } from './MetricInput';
import RestTimer from './RestTimer';
import {
  deleteSession,
  finishSession,
  getSession,
  lastPerformance,
  updateSets,
} from '../../data/sessions';
import { loggedSessionRepo } from '../../data/repos';
import { ulid } from '../../domain/ids';
import { formatDayLabel } from '../../domain/dates';
import { estimateDurationMin } from '../../domain/training';
import { formatDistance, formatDuration, formatWeight } from '../../domain/units';
import type { Exercise, LoggedSession, LoggedSet, MetricKey, UnitSystem } from '../../domain/types';

const DEFAULT_REST_SEC = 90;

type Feel = NonNullable<LoggedSession['feel']>;

const FEELS: { value: Feel; label: string }[] = [
  { value: 'great', label: '💪 Great' },
  { value: 'good', label: '🙂 Good' },
  { value: 'ok', label: '😐 OK' },
  { value: 'rough', label: '😮‍💨 Rough' },
  { value: 'bad', label: '🥴 Bad' },
];

export default function SessionLogger() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { units, exerciseBySlug } = useApp();

  // Resolves to null when the session genuinely does not exist, so "loading" and "missing"
  // stay distinguishable — useLiveQuery reports undefined until the first read settles.
  const session = useLiveQuery(
    async () => (sessionId ? ((await getSession(sessionId)) ?? null) : null),
    [sessionId],
  );

  const [sets, setSets] = useState<LoggedSet[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const hydrated = useRef(false);

  // Hydrate once. Later live-query updates are this component's own writes coming back.
  useEffect(() => {
    if (session && !hydrated.current) {
      setSets(session.sets);
      hydrated.current = true;
    }
  }, [session]);

  useEffect(() => {
    if (!sets || !sessionId || !hydrated.current) return;
    const timer = setTimeout(() => void updateSets(sessionId, sets), 400);
    return () => clearTimeout(timer);
  }, [sets, sessionId]);

  /** Movements in the order they were added, each with its sets. */
  const groups = useMemo(() => {
    if (!sets) return [];
    const order: string[] = [];
    const bySlug = new Map<string, LoggedSet[]>();
    for (const set of sets) {
      if (!bySlug.has(set.exerciseSlug)) {
        bySlug.set(set.exerciseSlug, []);
        order.push(set.exerciseSlug);
      }
      bySlug.get(set.exerciseSlug)!.push(set);
    }
    return order.map((slug) => ({ slug, sets: bySlug.get(slug)! }));
  }, [sets]);

  const history = useLiveQuery(async () => {
    const slugs = groups.map((g) => g.slug);
    const entries = await Promise.all(
      slugs.map(async (slug) => [slug, await lastPerformance(slug, sessionId)] as const),
    );
    return new Map(entries);
  }, [groups.map((g) => g.slug).join('|'), sessionId]);

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

  const mutate = (next: LoggedSet[]) => setSets(next);

  const addExercise = async (exercise: Exercise) => {
    setPicking(false);
    // Start from what you did last time — far more useful than an empty row.
    const previous = await lastPerformance(exercise.slug, sessionId);
    const seed = previous?.sets.at(-1)?.values ?? {};
    const values = Object.fromEntries(
      exercise.metrics.filter((m) => m !== 'rpe' && seed[m] != null).map((m) => [m, seed[m]]),
    );

    mutate([
      ...sets,
      {
        id: ulid(),
        exerciseSlug: exercise.slug,
        setIndex: 0,
        values,
        completed: false,
      },
    ]);
  };

  const addSet = (slug: string) => {
    const existing = sets.filter((s) => s.exerciseSlug === slug);
    const previous = existing.at(-1);
    const insertAfter = previous ? sets.lastIndexOf(previous) : sets.length - 1;
    const created: LoggedSet = {
      id: ulid(),
      exerciseSlug: slug,
      setIndex: existing.length,
      values: { ...(previous?.values ?? {}) },
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
    // Completing a set starts the clock; un-completing one should not.
    if (target && !target.completed) setRestEndsAt(Date.now() + DEFAULT_REST_SEC * 1000);
  };

  const removeSet = (setId: string) => mutate(sets.filter((s) => s.id !== setId));
  const removeExercise = (slug: string) => mutate(sets.filter((s) => s.exerciseSlug !== slug));

  const completedCount = sets.filter((s) => s.completed).length;

  return (
    <>
      <header className="page-head">
        <div className="grow">
          <input
            className="session-title"
            value={session.name}
            aria-label="Session name"
            onChange={(event) => void loggedSessionRepo.update(session.id, { name: event.target.value })}
          />
          <div className="subtitle">
            {formatDayLabel(session.date)} · {completedCount} of {sets.length} sets done
          </div>
        </div>
      </header>

      {groups.length === 0 && (
        <div className="empty">
          <span className="glyph">🏋️</span>
          <p>Nothing logged yet.</p>
          <p className="small faint">Add a movement to get started.</p>
        </div>
      )}

      {groups.map((group) => {
        const exercise = exerciseBySlug.get(group.slug);
        const metrics = exercise?.metrics ?? (['reps', 'rpe'] as MetricKey[]);
        const previous = history?.get(group.slug);

        return (
          <section className="card" key={group.slug}>
            <div className="card-head">
              <div className="grow">
                <h3 className="truncate">{exercise?.name ?? group.slug}</h3>
                {previous && (
                  <div className="tiny faint">
                    Last {formatDayLabel(previous.session.date).toLowerCase()}:{' '}
                    {summariseSets(previous.sets, metrics, units)}
                  </div>
                )}
              </div>
              <button
                className="btn ghost sm"
                aria-label={`Remove ${exercise?.name ?? group.slug}`}
                onClick={() => removeExercise(group.slug)}
              >
                ✕
              </button>
            </div>

            <div className="set-row" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
              <span className="set-no" />
              <div className="set-fields">
                {metrics.map((metric) => (
                  <span className="field-label" key={metric}>
                    {metricLabel(metric, units)}
                  </span>
                ))}
              </div>
              {/* Must match .set-check exactly, or the labels drift off their columns. */}
              <span style={{ width: 'var(--check-w)' }} />
            </div>

            {group.sets.map((set, index) => (
              <div
                className="set-row"
                key={set.id}
                style={{ gridTemplateColumns: 'auto 1fr auto' }}
              >
                <span className="set-no">{index + 1}</span>
                <div className="set-fields">
                  {metrics.map((metric) => (
                    <MetricInput
                      key={metric}
                      metric={metric}
                      units={units}
                      value={set.values[metric]}
                      onChange={(value) => setValue(set.id, metric, value)}
                    />
                  ))}
                </div>
                <button
                  className={`set-check${set.completed ? ' done' : ''}`}
                  aria-label={set.completed ? `Set ${index + 1} done` : `Mark set ${index + 1} done`}
                  onClick={() => toggleComplete(set.id)}
                  onDoubleClick={() => removeSet(set.id)}
                >
                  ✓
                </button>
              </div>
            ))}

            <div className="row" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
              <button className="btn sm grow" onClick={() => addSet(group.slug)}>
                + Set
              </button>
              {group.sets.length > 1 && (
                <button
                  className="btn sm ghost"
                  onClick={() => removeSet(group.sets.at(-1)!.id)}
                >
                  − Set
                </button>
              )}
            </div>
          </section>
        );
      })}

      <button className="btn block" onClick={() => setPicking(true)} style={{ marginTop: '0.5rem' }}>
        + Add exercise
      </button>

      {/*
        Finish is deliberately NOT the accent colour. The accent belongs to checking off a
        set — the thing done twenty times a session. A glowing button for the once-per-session
        action, sitting above a red destructive one, inverts the hierarchy and puts "discard"
        under the thumb of someone reaching to finish.
      */}
      <button
        className="btn block finish-btn"
        style={{ marginTop: '0.75rem' }}
        onClick={() => setFinishing(true)}
      >
        Finish workout
      </button>

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <button className="btn ghost sm danger" onClick={() => setDiscarding(true)}>
          Discard session
        </button>
      </div>

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

      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />}

      {restEndsAt && (
        <RestTimer
          endsAt={restEndsAt}
          onExtend={(seconds) => setRestEndsAt((end) => (end ?? Date.now()) + seconds * 1000)}
          onDismiss={() => setRestEndsAt(null)}
        />
      )}

      {finishing && (
        <FinishSheet
          onClose={() => setFinishing(false)}
          onSave={async (details) => {
            await updateSets(session.id, sets);
            await finishSession({ ...session, sets }, details);
            navigate('/history');
          }}
          suggestedMinutes={estimateDurationMin({ ...session, sets })}
        />
      )}
    </>
  );
}

function summariseSets(sets: LoggedSet[], metrics: MetricKey[], units: UnitSystem): string {
  if (metrics.includes('distanceM')) {
    const distance = sets.reduce((total, s) => total + (s.values.distanceM ?? 0), 0);
    const time = sets.reduce((total, s) => total + (s.values.timeSec ?? 0), 0);
    return [distance > 0 && formatDistance(distance, units), time > 0 && formatDuration(time)]
      .filter(Boolean)
      .join(' in ');
  }

  const weight = sets[0]?.values.weightKg;
  const reps = sets.map((s) => s.values.reps).filter((r): r is number => r != null);
  if (reps.length > 0) {
    const repText = reps.every((r) => r === reps[0]) ? `${reps.length}×${reps[0]}` : reps.join('/');
    return weight ? `${repText} @ ${formatWeight(weight, units)}` : repText;
  }

  const time = sets.reduce((total, s) => total + (s.values.timeSec ?? 0), 0);
  return time > 0 ? `${sets.length}× ${formatDuration(time / sets.length)}` : `${sets.length} sets`;
}

function FinishSheet({
  onClose,
  onSave,
  suggestedMinutes,
}: {
  onClose: () => void;
  onSave: (details: {
    sessionRpe?: number;
    feel?: Feel;
    notes?: string;
    durationMin?: number;
  }) => Promise<void>;
  suggestedMinutes: number;
}) {
  const [rpe, setRpe] = useState<number | undefined>();
  const [feel, setFeel] = useState<Feel | undefined>();
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState(String(suggestedMinutes));
  const [saving, setSaving] = useState(false);

  const load = rpe ? Math.round(rpe * (Number(minutes) || 0)) : null;

  return (
    <Sheet
      title="Finish workout"
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
          {saving ? 'Saving…' : 'Save workout'}
        </button>
      }
    >
      <p className="small muted">
        How hard was the whole session? This is what makes running and lifting comparable —
        RPE × minutes is the one load number that spans both.
      </p>

      <div className="section-title">Session RPE</div>
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

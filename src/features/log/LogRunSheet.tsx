/**
 * Logging a run that has already happened.
 *
 * The normal session flow is built for work you conduct inside the app — start a clock, tick
 * sets off as you go. A run is the opposite: it is entirely over, and the answers are already
 * sitting on your wrist. Making you open a session, search a 237-movement library, and fill
 * two metric fields to transcribe three numbers is the reason runs quietly stop getting
 * logged at all.
 *
 * So: type, distance, time, effort, save. Pace is computed as you type, because it is the
 * number you actually want to see and the best confirmation that the other two were entered
 * correctly — a fat-fingered distance shows up immediately as a nonsense pace.
 *
 * Effort is required. It is the one figure no import and no watch file can supply, it is
 * half of the training-load calculation the whole Progress view rests on, and standing here
 * just after the run is the only moment anyone actually knows it.
 */

import { useMemo, useState } from 'react';
import Sheet from '../../ui/Sheet';
import { useApp } from '../../ui/AppProvider';
import { logCardioSession } from '../../data/sessions';
import { todayKey, addDays, formatDayLabel } from '../../domain/dates';
import {
  distanceLabel,
  formatPaceFor,
  parseDistanceInput,
  parseDuration,
} from '../../domain/units';
import type { DayKey } from '../../domain/types';

/**
 * Offered as chips, in the order a runner reaches for them. Slugs that are missing from the
 * library are skipped rather than rendering a dead chip.
 */
const CARDIO_SLUGS = [
  'easy-run',
  'long-run',
  'tempo-run',
  'interval-run',
  'recovery-run',
  'trail-run',
  'treadmill-run',
  'hill-repeats',
  'walk',
  'ruck',
  'row-erg',
  'bike-erg',
];

/** Chip labels: the library name minus the word everything here shares. */
function chipLabel(name: string): string {
  return name.replace(/\s*Run$/i, '').trim() || name;
}

export default function LogRunSheet({
  date,
  onSaved,
  onClose,
}: {
  /** Defaults to today; the plan calendar passes the day you tapped. */
  date?: DayKey;
  onSaved: (sessionId: string) => void;
  onClose: () => void;
}) {
  const { units, exerciseBySlug } = useApp();

  const types = useMemo(
    () => CARDIO_SLUGS.map((slug) => exerciseBySlug.get(slug)).filter((e) => e != null),
    [exerciseBySlug],
  );

  const [slug, setSlug] = useState('easy-run');
  const [day, setDay] = useState<DayKey>(date ?? todayKey());
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [rpe, setRpe] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const distanceM = parseDistanceInput(distance, units);
  const timeSec = parseDuration(duration);
  const pace = distanceM && timeSec ? formatPaceFor(distanceM, timeSec, units) : null;

  const exercise = exerciseBySlug.get(slug);
  const canSave = timeSec != null && timeSec > 0 && rpe != null;

  const save = async () => {
    if (!canSave || !exercise) return;
    setSaving(true);
    const session = await logCardioSession({
      exerciseSlug: slug,
      name: exercise.name,
      date: day,
      distanceM: distanceM ?? undefined,
      timeSec: timeSec!,
      rpe,
      notes: notes.trim() || undefined,
    });
    onSaved(session.id);
  };

  const yesterday = addDays(todayKey(), -1);

  return (
    <Sheet
      title="Log a run"
      onClose={onClose}
      footer={
        <button className="btn primary block" disabled={!canSave || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : canSave ? 'Save run' : timeSec ? 'Add an effort' : 'Add a time'}
        </button>
      }
    >
      <div className="chip-row">
        {types.map((option) => (
          <button
            key={option!.slug}
            className={`chip${slug === option!.slug ? ' on' : ''}`}
            onClick={() => setSlug(option!.slug)}
          >
            {chipLabel(option!.name)}
          </button>
        ))}
      </div>

      {/* Runs get logged the next morning as often as not, so yesterday is one tap away. */}
      <div className="chip-row" style={{ marginTop: '0.6rem' }}>
        <button
          className={`chip${day === todayKey() ? ' on' : ''}`}
          onClick={() => setDay(todayKey())}
        >
          Today
        </button>
        <button
          className={`chip${day === yesterday ? ' on' : ''}`}
          onClick={() => setDay(yesterday)}
        >
          Yesterday
        </button>
        {day !== todayKey() && day !== yesterday && (
          <button className="chip on">{formatDayLabel(day)}</button>
        )}
      </div>

      <div className="run-fields">
        <label className="run-field">
          <span className="tiny faint">Distance ({distanceLabel(units)})</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="6.2"
            value={distance}
            onChange={(event) => setDistance(event.target.value)}
            autoFocus
          />
        </label>

        <label className="run-field">
          <span className="tiny faint">Time</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="48:30"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </label>
      </div>

      {/*
        Held open even when empty so the layout does not jump on every keystroke, which on a
        two-field form is most keystrokes.
      */}
      <div className={`run-pace${pace ? ' on' : ''}`}>
        <span className="mono">{pace ?? '—'}</span>
        <span className="tiny faint">
          {distance && distanceM === null
            ? "Didn't recognise that distance"
            : duration && timeSec === null
              ? "Didn't recognise that time — try 48:30"
              : 'pace'}
        </span>
      </div>

      <div className="section-title">How hard was it?</div>
      <div className="chip-row">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
          <button
            key={value}
            className={`chip${rpe === value ? ' on' : ''}`}
            onClick={() => setRpe(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        1 is a walk, 10 is everything you had. This is what your training load is built from,
        so it is worth a moment's thought.
      </p>

      <div className="section-title">Notes</div>
      <input
        type="text"
        placeholder="Felt flat, humid, new shoes…"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
    </Sheet>
  );
}

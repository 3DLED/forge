/**
 * How the app talks to you on a run, and what shape the run has.
 *
 * One screen for both because they are one decision made twice. Choosing "four by eight
 * hundred" and choosing "tell me every kilometre" are the same act of setting up an outing,
 * and splitting them across two screens means setting the session up in one place and then
 * discovering the alerts were wrong for it in another, halfway down the road.
 *
 * Almost everything here is chips rather than fields. This gets opened standing outside in
 * the cold, and a keyboard is the slowest control on a phone; the two places a keyboard is
 * unavoidable are the paces, because there is no useful shortlist of those.
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../ui/PageHeader';
import { useApp } from '../../ui/AppProvider';
import { profileRepo } from '../../data/repos';
import { speechAvailable } from '../../ui/speak';
import { SPLIT_INTERVALS, SPLIT_ORDER, type SplitUnit } from '../../domain/pace';
import { buildRunPlan, describeSegment, SHAPES_FOR, type RunKind, type RunShape } from '../../domain/runPlan';
import { runSettingsFor, shapeFor, withShape, type RunSettings } from '../../domain/runSettings';
import { runKindFor } from '../../domain/generator';
import {
  displayPace,
  distanceLabel,
  formatDistance,
  M_PER_MILE,
  paceInputValue,
  paceLabel,
  parseDistanceInput,
  parsePaceInput,
} from '../../domain/units';
import type { UnitSystem } from '../../domain/types';

/** Whole minutes, because nobody warms up for seven. */
const MINUTES = [0, 5, 10, 15, 20];

/** The reps people actually run, in the units they are usually written in. */
const WORK_DISTANCES: Record<UnitSystem, { m: number; label: string }[]> = {
  metric: [
    { m: 200, label: '200 m' },
    { m: 400, label: '400 m' },
    { m: 800, label: '800 m' },
    { m: 1000, label: '1 km' },
    { m: 1600, label: '1600 m' },
  ],
  imperial: [
    { m: 200, label: '200 m' },
    { m: M_PER_MILE / 4, label: '¼ mi' },
    { m: M_PER_MILE / 2, label: '½ mi' },
    { m: M_PER_MILE, label: '1 mi' },
  ],
};

const FLOAT_DISTANCES = [100, 200, 400, 600, 800];

const REPS = [3, 4, 5, 6, 8, 10, 12];

/** Tolerances offered in the pace unit on screen, stored per kilometre like everything else. */
const TOLERANCES = [10, 15, 20, 30];

const SHAPES: Record<RunShape['kind'], { label: string; hint: string }> = {
  open: { label: 'Just run', hint: 'No structure. Splits and alerts still work.' },
  steady: { label: 'Steady', hint: 'One distance at one pace.' },
  tempo: { label: 'Tempo', hint: 'Warm-up, a hard middle, cool-down.' },
  intervals: { label: 'Intervals', hint: 'Reps with a jog between them.' },
};

/**
 * The three kinds of run, named as the runs themselves rather than as categories.
 *
 * Shown only when this screen was opened from More, where there is no run in hand to say
 * which one is being set up. Coming from a run block the answer is already known, and asking
 * again would be the app forgetting where you just came from.
 */
const KINDS: { kind: RunKind; label: string }[] = [
  { kind: 'steady', label: 'Easy or long' },
  { kind: 'tempo', label: 'Tempo' },
  { kind: 'intervals', label: 'Intervals' },
];

/** A sensible starting point for each shape, so switching never lands on an empty form. */
function blankShape(kind: RunShape['kind'], units: UnitSystem): RunShape {
  const mile = units === 'imperial';
  switch (kind) {
    case 'open':
      return { kind: 'open' };
    case 'steady':
      return { kind: 'steady', distanceM: mile ? M_PER_MILE * 5 : 8000, targetSecPerKm: 330 };
    case 'tempo':
      return { kind: 'tempo', warmupSec: 600, distanceM: mile ? M_PER_MILE * 3 : 5000, targetSecPerKm: 270, cooldownSec: 600 };
    case 'intervals':
      return {
        kind: 'intervals',
        warmupSec: 600,
        reps: 4,
        workM: 800,
        workSecPerKm: 260,
        floatM: 400,
        floatSecPerKm: 420,
        cooldownSec: 600,
      };
  }
}

export default function RunSettingsView() {
  const { profile, units, exerciseBySlug } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const settings = runSettingsFor(units, profile.run);

  /*
   * Which run this screen is about.
   *
   * The cog on a run block passes the movement, so an easy run opens on the easy-run setup and
   * never offers a rep count — the question has no answer on a Sunday long run, and a screen
   * full of fields that do not apply is how a setup screen stops being read. Opened from More
   * there is no run in hand, so the kind becomes something you pick.
   */
  const forSlug = params.get('for');
  const forExercise = forSlug ? exerciseBySlug.get(forSlug) : undefined;
  const scoped = forExercise != null;
  const [picked, setPicked] = useState<RunKind>('steady');
  const kind = forExercise ? runKindFor(forExercise) : picked;

  const shape = shapeFor(settings, kind);
  const offered = SHAPES_FOR[kind];

  const patch = (change: Partial<RunSettings>) =>
    void profileRepo.update(profile.id, { run: { ...settings, ...change } });

  const setShape = (next: RunShape) =>
    void profileRepo.update(profile.id, { run: withShape(settings, kind, next) });

  const plan = buildRunPlan(shape);

  /*
   * Split intervals are offered in the units you use first, but not exclusively: people run
   * a metric track in an imperial country, and a five kilometre race is a five kilometre race
   * wherever you live.
   */
  const intervals = [...SPLIT_ORDER].sort((a, b) => {
    const mine = (u: SplitUnit) => (SPLIT_INTERVALS[u].units === units ? 0 : 1);
    return mine(a) - mine(b);
  });

  return (
    <>
      <PageHeader
        title="Run alerts"
        subtitle="What gets said while you are out, and what you are running"
        action={
          <button className="btn ghost sm" onClick={() => navigate(-1)}>
            Back
          </button>
        }
      />

      {!speechAvailable() && (
        <div className="card tight">
          <p className="small">
            This browser cannot speak, so cues will appear on screen only. Everything below still
            decides what gets shown.
          </p>
        </div>
      )}

      <div className="section-title">Voice</div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button
          className={`btn grow${settings.voice ? ' primary' : ''}`}
          onClick={() => patch({ voice: true })}
        >
          Speak cues
        </button>
        <button
          className={`btn grow${settings.voice ? '' : ' primary'}`}
          onClick={() => patch({ voice: false })}
        >
          Silent
        </button>
      </div>
      <p className="tiny faint">
        Silent keeps every cue on screen and says none of them — for a race, a group run, or a
        track session where someone is already shouting at you.
      </p>

      <div className="section-title">Splits</div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button
          className={`btn grow${settings.splits ? ' primary' : ''}`}
          onClick={() => patch({ splits: true })}
        >
          On
        </button>
        <button
          className={`btn grow${settings.splits ? '' : ' primary'}`}
          onClick={() => patch({ splits: false })}
        >
          Off
        </button>
      </div>

      {settings.splits && (
        <>
          <div className="chip-row" style={{ marginTop: '0.6rem' }}>
            {intervals.map((interval) => (
              <button
                key={interval}
                className={`chip${settings.splitUnit === interval ? ' on' : ''}`}
                onClick={() => patch({ splitUnit: interval })}
              >
                {SPLIT_INTERVALS[interval].short}
              </button>
            ))}
          </div>
          <p className="tiny faint">
            {SPLIT_INTERVALS[settings.splitUnit].label}, with the pace for that piece alone and how
            it compares to your target. Distance rather than a timer, so standing at a crossing
            does not count.
          </p>
        </>
      )}

      <div className="section-title">Pace alerts</div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button
          className={`btn grow${settings.paceAlerts ? ' primary' : ''}`}
          onClick={() => patch({ paceAlerts: true })}
        >
          On
        </button>
        <button
          className={`btn grow${settings.paceAlerts ? '' : ' primary'}`}
          onClick={() => patch({ paceAlerts: false })}
        >
          Off
        </button>
      </div>

      {settings.paceAlerts && (
        <>
          <PaceField
            label={`Target pace (${paceLabel(units)})`}
            value={settings.targetSecPerKm}
            units={units}
            onChange={(targetSecPerKm) => patch({ targetSecPerKm })}
          />

          <div className="tiny faint" style={{ marginTop: '0.6rem' }}>
            Say something once I am off by
          </div>
          <div className="chip-row">
            {TOLERANCES.map((seconds) => {
              const secPerKm = units === 'imperial' ? seconds / (M_PER_MILE / 1000) : seconds;
              const chosen = Math.abs(displayPace(settings.toleranceSecPerKm, units) - seconds) < 1;
              return (
                <button
                  key={seconds}
                  className={`chip${chosen ? ' on' : ''}`}
                  onClick={() => patch({ toleranceSecPerKm: secPerKm })}
                >
                  {seconds}s
                </button>
              );
            })}
          </div>
          <p className="tiny faint">
            Drifting is normal, so this waits — half a minute off pace before it says anything, and
            longer before it says the same thing twice.
          </p>
        </>
      )}

      <div className="section-title">
        {scoped ? `Structure for ${forExercise!.name.toLowerCase()}` : 'Run structure'}
      </div>

      {/* Only where the screen does not already know which run you are setting up. */}
      {!scoped && (
        <>
          <div className="chip-row">
            {KINDS.map((option) => (
              <button
                key={option.kind}
                className={`chip${kind === option.kind ? ' on' : ''}`}
                onClick={() => setPicked(option.kind)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="tiny faint">
            Each kind of run keeps its own setup, so a track session does not turn Sunday's long
            run into four by eight hundred.
          </p>
        </>
      )}

      <div className="chip-row" style={{ marginTop: scoped ? 0 : '0.6rem' }}>
        {offered.map((option) => (
          <button
            key={option}
            className={`chip${shape.kind === option ? ' on' : ''}`}
            onClick={() => setShape(blankShape(option, units))}
          >
            {SHAPES[option].label}
          </button>
        ))}
      </div>
      <p className="tiny faint">{SHAPES[shape.kind].hint}</p>

      {shape.kind === 'steady' && (
        <>
          <DistanceField
            key="steady-distance"
            label={`Distance (${distanceLabel(units)})`}
            value={shape.distanceM}
            units={units}
            onChange={(distanceM) => setShape({ ...shape, distanceM })}
          />
          <PaceField
            key="steady-pace"
            label={`Pace (${paceLabel(units)})`}
            value={shape.targetSecPerKm}
            units={units}
            onChange={(targetSecPerKm) => setShape({ ...shape, targetSecPerKm })}
          />
        </>
      )}

      {shape.kind === 'tempo' && (
        <>
          <MinutesRow
            label="Warm up"
            value={shape.warmupSec}
            onChange={(warmupSec) => setShape({ ...shape, warmupSec })}
          />
          <DistanceField
            key="tempo-distance"
            label={`Tempo distance (${distanceLabel(units)})`}
            value={shape.distanceM}
            units={units}
            onChange={(distanceM) => setShape({ ...shape, distanceM: distanceM ?? shape.distanceM })}
          />
          <PaceField
            key="tempo-pace"
            label={`Tempo pace (${paceLabel(units)})`}
            value={shape.targetSecPerKm}
            units={units}
            onChange={(pace) => setShape({ ...shape, targetSecPerKm: pace ?? shape.targetSecPerKm })}
          />
          <MinutesRow
            label="Cool down"
            value={shape.cooldownSec}
            onChange={(cooldownSec) => setShape({ ...shape, cooldownSec })}
          />
        </>
      )}

      {shape.kind === 'intervals' && (
        <>
          <MinutesRow
            label="Warm up"
            value={shape.warmupSec}
            onChange={(warmupSec) => setShape({ ...shape, warmupSec })}
          />

          <div className="tiny faint" style={{ marginTop: '0.6rem' }}>
            Reps
          </div>
          <div className="chip-row">
            {REPS.map((reps) => (
              <button
                key={reps}
                className={`chip${shape.reps === reps ? ' on' : ''}`}
                onClick={() => setShape({ ...shape, reps })}
              >
                {reps}
              </button>
            ))}
          </div>

          <div className="tiny faint" style={{ marginTop: '0.6rem' }}>
            Each rep
          </div>
          <div className="chip-row">
            {WORK_DISTANCES[units].map((option) => (
              <button
                key={option.label}
                className={`chip${Math.abs(shape.workM - option.m) < 1 ? ' on' : ''}`}
                onClick={() => setShape({ ...shape, workM: option.m })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <PaceField
            key="rep-pace"
            label={`Rep pace (${paceLabel(units)})`}
            value={shape.workSecPerKm}
            units={units}
            onChange={(pace) => setShape({ ...shape, workSecPerKm: pace ?? shape.workSecPerKm })}
          />

          <div className="tiny faint" style={{ marginTop: '0.6rem' }}>
            Jog between
          </div>
          <div className="chip-row">
            {FLOAT_DISTANCES.map((metres) => (
              <button
                key={metres}
                className={`chip${shape.floatM === metres ? ' on' : ''}`}
                onClick={() => setShape({ ...shape, floatM: metres })}
              >
                {metres} m
              </button>
            ))}
          </div>
          <PaceField
            key="jog-pace"
            label={`Jog pace (${paceLabel(units)})`}
            value={shape.floatSecPerKm}
            units={units}
            onChange={(pace) => setShape({ ...shape, floatSecPerKm: pace ?? shape.floatSecPerKm })}
          />

          <MinutesRow
            label="Cool down"
            value={shape.cooldownSec}
            onChange={(cooldownSec) => setShape({ ...shape, cooldownSec })}
          />
        </>
      )}

      {/*
        The session read back as sentences, in the same words it will be spoken in. A list of
        fields can be right in every box and still describe a session nobody meant to run.
      */}
      {plan && (
        <div className="card tight" style={{ marginTop: '0.8rem' }}>
          <div className="row between">
            <strong>{plan.name}</strong>
            <span className="tiny faint">{plan.segments.length} pieces</span>
          </div>
          <ol className="run-plan-list">
            {plan.segments.map((segment, index) => (
              <li key={index} className="small">
                {describeSegment(segment, units)}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

/** Minutes as chips. Timed pieces are always round numbers of them in practice. */
function MinutesRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (seconds: number) => void;
}) {
  return (
    <>
      <div className="tiny faint" style={{ marginTop: '0.6rem' }}>
        {label}
      </div>
      <div className="chip-row">
        {MINUTES.map((minutes) => (
          <button
            key={minutes}
            className={`chip${value === minutes * 60 ? ' on' : ''}`}
            onClick={() => onChange(minutes * 60)}
          >
            {minutes === 0 ? 'None' : `${minutes} min`}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * A pace, typed.
 *
 * Held as text while you edit it rather than parsed on every keystroke: "8:" is halfway to a
 * valid pace, and a field that erases itself the moment you type a colon is unusable. The
 * stored value only moves when what is typed means something.
 */
/*
 * Both typed fields below hold their text locally and are therefore only seeded once, when
 * they mount. That is right while you are typing and wrong when the value beneath them is
 * replaced — which happens on every switch between shapes. Keys make the switch a remount, so
 * the two cases stay separate instead of one silently defeating the other.
 */
function PaceField({
  label,
  value,
  units,
  onChange,
}: {
  label: string;
  value: number | undefined;
  units: UnitSystem;
  onChange: (secPerKm: number | undefined) => void;
}) {
  const [text, setText] = useState(value == null ? '' : paceInputValue(value, units));
  const parsed = parsePaceInput(text, units);

  return (
    <label className="run-field" style={{ marginTop: '0.6rem' }}>
      <span className="tiny faint">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder={units === 'imperial' ? '8:30' : '5:20'}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (event.target.value.trim() === '') onChange(undefined);
          else {
            const next = parsePaceInput(event.target.value, units);
            if (next != null) onChange(next);
          }
        }}
      />
      {text.trim() !== '' && parsed == null && (
        <span className="tiny faint">Minutes and seconds, like 8:30</span>
      )}
    </label>
  );
}

/** A distance, in whichever unit is on screen, stored in metres. */
function DistanceField({
  label,
  value,
  units,
  onChange,
}: {
  label: string;
  value: number | undefined;
  units: UnitSystem;
  onChange: (metres: number | undefined) => void;
}) {
  const [text, setText] = useState(
    value == null ? '' : String(Number((units === 'imperial' ? value / M_PER_MILE : value / 1000).toFixed(2))),
  );
  const parsed = parseDistanceInput(text, units);

  return (
    <label className="run-field" style={{ marginTop: '0.6rem' }}>
      <span className="tiny faint">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        placeholder={units === 'imperial' ? '3.1' : '5'}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          const next = parseDistanceInput(event.target.value, units);
          if (next != null) onChange(next);
        }}
      />
      {text.trim() !== '' && parsed != null && (
        <span className="tiny faint">{formatDistance(parsed, units)}</span>
      )}
    </label>
  );
}

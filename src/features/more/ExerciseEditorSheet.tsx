/**
 * Adding a movement the library does not have.
 *
 * The form asks what a movement *uses* and *how it moves*, not what category it is. Category
 * and body region are derived from those two answers everywhere else in the app, deliberately,
 * so they can never drift out of step with the fields that decide them. Typing a category
 * instead would produce a movement that sits outside equipment filtering, outside the
 * suggester, and outside the injury log — present in the list and connected to nothing.
 *
 * The write-up is optional. Something you invented on a Tuesday does not need three paragraphs
 * to be loggable, and an empty description is better than a form nobody finishes.
 */

import { useState } from 'react';
import Sheet from '../../ui/Sheet';
import { exerciseRepo } from '../../data/repos';
import { CATEGORY_LABELS, categoryOf } from '../../domain/categories';
import { BAND_LABELS, bandOf } from '../../domain/difficulty';
import { REGION_LABELS, regionOf } from '../../domain/regions';
import { ulid } from '../../domain/ids';
import type {
  EquipmentTag,
  Exercise,
  MetricKey,
  Modality,
  MovementPattern,
} from '../../domain/types';

/** The kit most custom movements actually use. The full tag list is not a useful question. */
const EQUIPMENT: { tag: EquipmentTag; label: string }[] = [
  { tag: 'bodyweight', label: 'Bodyweight' },
  { tag: 'kettlebell', label: 'Kettlebell' },
  { tag: 'dumbbell', label: 'Dumbbell' },
  { tag: 'barbell', label: 'Barbell' },
  { tag: 'pullupBar', label: 'Pull-up bar' },
  { tag: 'bench', label: 'Bench' },
  { tag: 'box', label: 'Box' },
  { tag: 'sandbag', label: 'Sandbag' },
  { tag: 'jumpRope', label: 'Jump rope' },
  { tag: 'floor', label: 'Floor' },
];

const PATTERNS: { pattern: MovementPattern; label: string }[] = [
  { pattern: 'squat', label: 'Squat' },
  { pattern: 'hinge', label: 'Hinge' },
  { pattern: 'lunge', label: 'Lunge' },
  { pattern: 'pushHorizontal', label: 'Push (forward)' },
  { pattern: 'pushVertical', label: 'Push (overhead)' },
  { pattern: 'pullHorizontal', label: 'Pull (row)' },
  { pattern: 'pullVertical', label: 'Pull (chin)' },
  { pattern: 'core', label: 'Core' },
  { pattern: 'carry', label: 'Carry' },
  { pattern: 'fullBody', label: 'Full body' },
  { pattern: 'gait', label: 'Run / walk' },
];

const MEASURES: { metrics: MetricKey[]; label: string; blurb: string }[] = [
  { metrics: ['weightKg', 'reps'], label: 'Weight & reps', blurb: 'A loaded lift.' },
  { metrics: ['reps'], label: 'Reps', blurb: 'Bodyweight, counted.' },
  { metrics: ['timeSec'], label: 'Time held', blurb: 'A plank, a hang, a wall sit.' },
  { metrics: ['distanceM', 'timeSec'], label: 'Distance & time', blurb: 'A run, a row, a carry.' },
];

export default function ExerciseEditorSheet({
  existing,
  onClose,
  onSaved,
}: {
  /** Editing one you made earlier, rather than adding a new one. */
  existing?: Exercise;
  onClose: () => void;
  onSaved: (exercise: Exercise) => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [equipment, setEquipment] = useState<EquipmentTag[]>(
    existing?.equipment ?? ['bodyweight'],
  );
  const [pattern, setPattern] = useState<MovementPattern>(existing?.pattern ?? 'squat');
  const [metrics, setMetrics] = useState<MetricKey[]>(existing?.metrics ?? ['weightKg', 'reps']);
  const [level, setLevel] = useState(existing?.level ?? 3);
  const [muscles, setMuscles] = useState(existing?.primaryMuscles.join(', ') ?? '');
  const [setup, setSetup] = useState(existing?.coaching?.setup ?? '');
  const [cues, setCues] = useState(existing?.coaching?.cues.join('\n') ?? '');
  const [fault, setFault] = useState(existing?.coaching?.fault ?? '');
  const [saving, setSaving] = useState(false);

  const toggleEquipment = (tag: EquipmentTag) =>
    setEquipment((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );

  /* Enough to derive the category and region, so the preview can be honest before saving. */
  const preview = {
    equipment,
    pattern,
    metrics,
    level,
  } as Exercise;

  const modality: Modality =
    pattern === 'gait' ? 'cardio' : metrics.includes('timeSec') && metrics.length === 1 ? 'strength' : 'strength';

  const usable = name.trim().length > 0 && equipment.length > 0;

  const save = async () => {
    setSaving(true);
    const cueList = cues
      .split('\n')
      .map((cue) => cue.trim())
      .filter(Boolean);

    const fields = {
      name: name.trim(),
      modality,
      pattern,
      equipment,
      metrics,
      primaryMuscles: muscles
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
      secondaryMuscles: [],
      unilateral: false,
      substitutes: [],
      progression: { easier: [], harder: [] },
      isCustom: true,
      common: false,
      isAccessory: false,
      level,
      // Unloaded movements move your own mass; without this they score no volume at all.
      bodyweightFactor: metrics.includes('weightKg') ? 0 : 0.6,
      coaching:
        setup.trim() || cueList.length > 0 || fault.trim()
          ? { setup: setup.trim(), cues: cueList, fault: fault.trim() }
          : undefined,
    };

    const saved = existing
      ? await exerciseRepo.update(existing.id, fields)
      : await exerciseRepo.create({ ...fields, slug: `custom-${ulid().toLowerCase()}` } as never);

    onSaved(saved as Exercise);
  };

  return (
    <Sheet
      title={existing ? `Edit ${existing.name}` : 'Add a movement'}
      onClose={onClose}
      footer={
        <button className="btn primary block" disabled={!usable || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Add it'}
        </button>
      }
    >
      <div className="section-title">Name</div>
      <input
        value={name}
        placeholder="Bulgarian bag spin"
        aria-label="Movement name"
        onChange={(event) => setName(event.target.value)}
      />

      <div className="section-title">What it needs</div>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {EQUIPMENT.map(({ tag, label }) => (
          <button
            key={tag}
            className={`chip${equipment.includes(tag) ? ' on' : ''}`}
            onClick={() => toggleEquipment(tag)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        Everything selected has to be in an equipment profile for this to be offered there.
      </p>

      <div className="section-title">How it moves</div>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {PATTERNS.map(({ pattern: option, label }) => (
          <button
            key={option}
            className={`chip${pattern === option ? ' on' : ''}`}
            onClick={() => setPattern(option)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="section-title">What it records</div>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {MEASURES.map(({ metrics: option, label }) => (
          <button
            key={label}
            className={`chip${metrics.join() === option.join() ? ' on' : ''}`}
            onClick={() => setMetrics(option)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        {MEASURES.find((m) => m.metrics.join() === metrics.join())?.blurb} This decides which
        boxes appear when you log it, and which kind of test it takes.
      </p>

      <div className="section-title">How hard</div>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {[1, 2, 3, 4, 5].map((option) => (
          <button
            key={option}
            className={`chip${level === option ? ' on' : ''}`}
            onClick={() => setLevel(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        {BAND_LABELS[bandOf(level as 1 | 2 | 3 | 4 | 5)]} — across the whole library, not within
        its pattern.
      </p>

      <div className="card tight" style={{ marginTop: '0.75rem' }}>
        <div className="small">
          Files as <strong>{CATEGORY_LABELS[categoryOf(preview)]}</strong> ·{' '}
          <strong>{REGION_LABELS[regionOf(preview)]}</strong>
        </div>
        <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
          Worked out from the kit and the pattern, so filtering, suggestions and the injury log
          all understand it without being told separately.
        </div>
      </div>

      <div className="section-title">What it trains</div>
      <input
        value={muscles}
        placeholder="shoulders, core"
        aria-label="Muscles trained"
        onChange={(event) => setMuscles(event.target.value)}
      />

      <div className="section-title">Set up</div>
      <textarea
        rows={2}
        value={setup}
        placeholder="Where you and the kit start. Optional."
        aria-label="Set up"
        onChange={(event) => setSetup(event.target.value)}
      />

      <div className="section-title">How to do it</div>
      <textarea
        rows={3}
        value={cues}
        placeholder={'One cue per line, in the order they happen.'}
        aria-label="How to do it"
        onChange={(event) => setCues(event.target.value)}
      />

      <div className="section-title">Watch for</div>
      <textarea
        rows={2}
        value={fault}
        placeholder="The one thing that usually goes wrong. Optional."
        aria-label="Watch for"
        onChange={(event) => setFault(event.target.value)}
      />
    </Sheet>
  );
}

/**
 * Multi-week programs.
 *
 * A plan template does not name dates or weekdays. It names *slots* — "a long run", "a push
 * day" — and the scheduler places them on real days that your availability and blackouts
 * actually allow. That separation is what lets one marathon plan work for someone who runs
 * Tuesday/Thursday/Saturday and someone who runs Monday/Wednesday/Sunday.
 *
 * Progression is deliberately narrow. Only the things that genuinely *must* change week to
 * week are modelled here — long-run distance, chiefly — because strength progression belongs
 * to the athlete and the bar, not to a template guessing what you can lift in week nine.
 */

import type {
  EquipmentTag,
  GoalKind,
  Modality,
  SlotProgression,
  Weekday,
} from '../../domain/types';

export type { SlotProgression } from '../../domain/types';

export interface PlanSlot {
  templateSlug: string;
  /** Used to match the slot against a day's allowed modalities. */
  modality: Modality;
  /** Lower numbers are placed earlier in the week. */
  order: number;
  progression?: SlotProgression;
  /** Slot only appears from this week onward (1-indexed). */
  fromWeek?: number;
  /**
   * Pinned to this weekday, for a plan whose days were chosen rather than fitted.
   *
   * Unused by the seeded plans, which say how many days they want and let the app find room.
   * See `placeSlotsInWeek` for what a pinned day does and does not override.
   */
  weekday?: Weekday;
}

export interface SeedPlanTemplate {
  slug: string;
  name: string;
  description: string;
  goal: GoalKind;
  /** null means ongoing — no end date, repeats until you stop it. */
  weeks: number | null;
  daysPerWeek: number;
  slots: PlanSlot[];
  /** Every Nth week is a deload. */
  deloadEvery?: number;
  /** Volume multiplier applied on deload weeks. */
  deloadFactor?: number;
  /** Final N weeks scale down toward race day. */
  taperWeeks?: number;
  tags: string[];
  /** What this plan really wants you to own. Informational — substitution still applies. */
  needs?: EquipmentTag[];
}

const slot = (
  templateSlug: string,
  modality: Modality,
  order: number,
  progression?: SlotProgression,
): PlanSlot => ({ templateSlug, modality, order, progression });

/** Long-run progression: the one curve that matters in every distance plan. */
const longRun = (
  exerciseSlug: string,
  startKm: number,
  maxKm: number,
  weeklyRate = 0.08,
): SlotProgression => ({
  exerciseSlug,
  metric: 'distanceM',
  startValue: startKm * 1000,
  weeklyRate,
  maxValue: maxKm * 1000,
});

export const SEED_PLAN_TEMPLATES: SeedPlanTemplate[] = [
  // --- general strength ----------------------------------------------------
  {
    slug: 'full-body-3x',
    name: 'Full Body, 3× a week',
    description:
      'Three rotating full-body days. The best return per hour if you train three times a week, and the easiest plan to miss a day of without derailing.',
    goal: 'strength',
    weeks: null,
    daysPerWeek: 3,
    tags: ['strength', 'beginner-friendly', 'ongoing'],
    slots: [
      slot('full-body-a', 'strength', 1),
      slot('full-body-b', 'strength', 2),
      slot('full-body-c', 'strength', 3),
    ],
    deloadEvery: 6,
    deloadFactor: 0.6,
  },
  {
    slug: 'upper-lower-4x',
    name: 'Upper / Lower, 4× a week',
    description:
      'Two upper days and two lower days. More volume per muscle than full body without the six-day commitment of a full split.',
    goal: 'strength',
    weeks: null,
    daysPerWeek: 4,
    tags: ['strength', 'intermediate', 'ongoing'],
    slots: [
      slot('upper-a', 'strength', 1),
      slot('lower-a', 'strength', 2),
      slot('upper-b', 'strength', 3),
      slot('lower-b', 'strength', 4),
    ],
    deloadEvery: 6,
    deloadFactor: 0.6,
  },
  {
    slug: 'ppl-6x',
    name: 'Push / Pull / Legs, 6× a week',
    description:
      'The classic six-day split, run twice through. High volume and high commitment — it falls apart fast if you can only train four days.',
    goal: 'physique',
    weeks: null,
    daysPerWeek: 6,
    tags: ['strength', 'hypertrophy', 'advanced', 'ongoing'],
    slots: [
      slot('push-a', 'strength', 1),
      slot('pull-a', 'strength', 2),
      slot('legs-a', 'strength', 3),
      slot('push-b', 'strength', 4),
      slot('pull-b', 'strength', 5),
      slot('legs-b', 'strength', 6),
    ],
    deloadEvery: 6,
    deloadFactor: 0.6,
  },
  {
    slug: 'ppl-3x',
    name: 'Push / Pull / Legs, 3× a week',
    description:
      'The same split at a sustainable cadence — each day comes round once a week. A good landing spot when six days stops being realistic.',
    goal: 'strength',
    weeks: null,
    daysPerWeek: 3,
    tags: ['strength', 'ongoing'],
    slots: [
      slot('push-a', 'strength', 1),
      slot('pull-a', 'strength', 2),
      slot('legs-a', 'strength', 3),
    ],
    deloadEvery: 6,
    deloadFactor: 0.6,
  },
  {
    slug: 'bodyweight-3x',
    name: 'Bodyweight Only, 3× a week',
    description:
      'No equipment at all. Progress comes from the movement ladder — harder leverage and less assistance — rather than from adding load.',
    goal: 'strength',
    weeks: null,
    daysPerWeek: 3,
    tags: ['bodyweight', 'no-equipment', 'travel', 'ongoing'],
    slots: [
      slot('bodyweight-full-a', 'strength', 1),
      slot('bodyweight-full-b', 'strength', 2),
      slot('bodyweight-full-a', 'strength', 3),
    ],
    deloadEvery: 6,
    deloadFactor: 0.7,
  },
  {
    slug: 'kettlebell-3x',
    name: 'Kettlebell Only, 3× a week',
    description:
      'Built for one or two bells and a floor. Swings, get-ups, presses and carries, with a grip finisher on every day.',
    goal: 'strength',
    weeks: null,
    daysPerWeek: 3,
    tags: ['kettlebell', 'minimal-equipment', 'ongoing'],
    needs: ['kettlebell'],
    slots: [
      slot('kettlebell-full-body', 'strength', 1),
      slot('conditioning-circuit', 'strength', 2),
      slot('kettlebell-full-body', 'strength', 3),
    ],
    deloadEvery: 6,
    deloadFactor: 0.7,
  },

  // --- running -------------------------------------------------------------
  {
    slug: 'couch-to-5k',
    name: 'First 5K',
    description:
      'Nine weeks from not running to running five kilometres. Every run is easy — the only thing that increases is how long you go.',
    goal: 'race',
    weeks: 9,
    daysPerWeek: 3,
    tags: ['running', '5k', 'beginner'],
    needs: ['road'],
    slots: [
      slot('run-easy', 'cardio', 1, longRun('easy-run', 1.6, 4, 0.12)),
      slot('run-easy', 'cardio', 2, longRun('easy-run', 1.6, 4, 0.12)),
      slot('run-long', 'cardio', 3, longRun('long-run', 2.4, 5.5, 0.12)),
    ],
    deloadEvery: 4,
    deloadFactor: 0.7,
    taperWeeks: 1,
  },
  {
    slug: '5k-improver',
    name: '5K — Get Faster',
    description:
      'Eight weeks of speed work on top of an easy-running base. Assumes you can already run 5K without stopping.',
    goal: 'race',
    weeks: 8,
    daysPerWeek: 4,
    tags: ['running', '5k', 'intermediate'],
    needs: ['road'],
    slots: [
      slot('run-easy', 'cardio', 1, longRun('easy-run', 5, 8)),
      slot('run-intervals', 'cardio', 2),
      slot('run-tempo', 'cardio', 3),
      slot('run-long', 'cardio', 4, longRun('long-run', 8, 14)),
    ],
    deloadEvery: 4,
    deloadFactor: 0.7,
    taperWeeks: 1,
  },
  {
    slug: 'half-marathon',
    name: 'Half Marathon',
    description:
      'Twelve weeks to 21.1K. Long run grows about 8% a week to 19K, with a down week every fourth and a two-week taper into race day.',
    goal: 'race',
    weeks: 12,
    daysPerWeek: 4,
    tags: ['running', 'half-marathon', 'intermediate'],
    needs: ['road'],
    slots: [
      slot('run-easy', 'cardio', 1, longRun('easy-run', 6, 10)),
      slot('run-tempo', 'cardio', 2),
      slot('run-easy', 'cardio', 3, longRun('easy-run', 6, 10)),
      slot('run-long', 'cardio', 4, longRun('long-run', 10, 19)),
    ],
    deloadEvery: 4,
    deloadFactor: 0.7,
    taperWeeks: 2,
  },
  {
    slug: 'marathon',
    name: 'Marathon',
    description:
      'Sixteen weeks to 42.2K. Five days a week, long run building to 32K, three-week waves with a down week, and a proper three-week taper.',
    goal: 'race',
    weeks: 16,
    daysPerWeek: 5,
    tags: ['running', 'marathon', 'advanced'],
    needs: ['road'],
    slots: [
      slot('run-easy', 'cardio', 1, longRun('easy-run', 8, 13)),
      slot('run-intervals', 'cardio', 2),
      slot('run-easy', 'cardio', 3, longRun('easy-run', 8, 13)),
      slot('run-tempo', 'cardio', 4),
      slot('run-long', 'cardio', 5, longRun('long-run', 16, 32, 0.07)),
    ],
    deloadEvery: 4,
    deloadFactor: 0.65,
    taperWeeks: 3,
  },

  // --- hybrid and obstacle racing -----------------------------------------
  {
    slug: 'hybrid-run-lift',
    name: 'Hybrid — Run & Lift',
    description:
      'Two full-body strength days and two runs a week, indefinitely. For staying strong and keeping a running base without training for anything in particular.',
    goal: 'general',
    weeks: null,
    daysPerWeek: 4,
    tags: ['hybrid', 'running', 'strength', 'ongoing'],
    slots: [
      slot('full-body-a', 'strength', 1),
      slot('run-easy', 'cardio', 2, longRun('easy-run', 5, 8)),
      slot('full-body-b', 'strength', 3),
      slot('run-long', 'cardio', 4, longRun('long-run', 8, 16)),
    ],
    deloadEvery: 6,
    deloadFactor: 0.65,
  },
  {
    slug: 'spartan-ocr',
    name: 'Spartan / OCR',
    description:
      'Twelve weeks for obstacle racing. Hills and trail instead of track, grip work on every strength day, and burpees on tired legs — because that is when they actually happen.',
    goal: 'race',
    weeks: 12,
    daysPerWeek: 4,
    tags: ['ocr', 'spartan', 'hybrid', 'grip'],
    slots: [
      slot('kettlebell-full-body', 'strength', 1),
      slot('run-hills', 'cardio', 2),
      slot('ocr-burpee-conditioning', 'strength', 3),
      slot('ocr-long-run-finisher', 'cardio', 4, longRun('trail-run', 8, 18)),
    ],
    deloadEvery: 4,
    deloadFactor: 0.7,
    taperWeeks: 2,
  },
  {
    slug: 'hyrox-prep',
    name: 'Hyrox Prep',
    description:
      'Twelve weeks of compromised running — the thing that actually decides a Hyrox. Strength, a race simulation, intervals, and one long run each week.',
    goal: 'race',
    weeks: 12,
    daysPerWeek: 4,
    tags: ['hyrox', 'hybrid', 'race'],
    slots: [
      slot('hyrox-strength', 'strength', 1),
      slot('run-intervals', 'cardio', 2),
      slot('hyrox-sim', 'cardio', 3),
      slot('run-long', 'cardio', 4, longRun('long-run', 8, 16)),
    ],
    deloadEvery: 4,
    deloadFactor: 0.7,
    taperWeeks: 2,
  },
];

export const SEED_PLAN_TEMPLATE_BY_SLUG = new Map(SEED_PLAN_TEMPLATES.map((p) => [p.slug, p]));

import { describe, expect, it } from 'vitest';
import { generatePlan, materialisePrescription } from './planning';
import { SEED_EXERCISES } from '../data/seed/exercises';
import { SEED_SESSION_TEMPLATES } from '../data/seed/sessionTemplates';
import type { SeedPlanTemplate } from '../data/seed/planTemplates';
import type { SeedSessionTemplate } from '../data/seed/sessionTemplates';
import type { AvailabilityRule, Exercise, Modality, PrescribedItem, Weekday } from './types';

const ALL: Modality[] = ['strength', 'cardio', 'mobility', 'skill'];

const openWeek: AvailabilityRule[] = Array.from({ length: 7 }, (_, i) => ({
  weekday: i as Weekday,
  allowedModalities: ALL,
}));

/** The real library, so a substitution or a missing slug shows up here rather than in use. */
const exerciseBySlug = new Map<string, Exercise>(
  SEED_EXERCISES.map((e) => [e.slug, e as Exercise]),
);
const everything = new Set(SEED_EXERCISES.map((e) => e.slug));
const templateBySlug = new Map(SEED_SESSION_TEMPLATES.map((t) => [t.slug, t]));

const liftSession: SeedSessionTemplate = {
  slug: 'test-lift',
  name: 'Test Lift',
  modalities: ['strength'],
  estimatedMinutes: 45,
  blocks: [
    {
      style: 'straight',
      items: [{ ex: 'back-squat', sets: 3, reps: [8, 12], rpe: 8, restSec: 90 }],
    },
  ],
};

const runSession: SeedSessionTemplate = {
  slug: 'test-run',
  name: 'Test Run',
  modalities: ['cardio'],
  estimatedMinutes: 40,
  blocks: [{ style: 'straight', items: [{ ex: 'run', distanceM: 8000, paceSecPerKm: 330 }] }],
};

const firstItem = (seed: SeedSessionTemplate, primaryGoal?: Parameters<typeof materialisePrescription>[1]['primaryGoal']): PrescribedItem =>
  materialisePrescription(seed, {
    weekIndex: 1,
    factor: 1,
    exerciseBySlug,
    available: everything,
    primaryGoal,
  }).prescription.blocks[0].items[0];

describe('the goal shaping a prescription', () => {
  it('leaves a template untouched when no goal has been chosen', () => {
    expect(firstItem(liftSession)).toMatchObject({ repRange: [8, 12], restSec: 90 });
  });

  it('leaves a template untouched for general fitness', () => {
    expect(firstItem(liftSession, 'general')).toMatchObject({ repRange: [8, 12], restSec: 90 });
  });

  it('pulls reps down and rest up for strength', () => {
    const item = firstItem(liftSession, 'strength');
    expect(item.repRange![0]).toBeLessThan(8);
    expect(item.restSec!).toBeGreaterThan(90);
  });

  it('pushes reps up and rest down for endurance', () => {
    const item = firstItem(liftSession, 'endurance');
    expect(item.repRange![0]).toBeGreaterThan(8);
    expect(item.restSec!).toBeLessThan(90);
  });

  it('lifts heavy for fat loss, exactly as it does for strength', () => {
    // Ids are minted per item, so the dose is what gets compared.
    const dose = (item: PrescribedItem) => ({ ...item, id: undefined });
    expect(dose(firstItem(liftSession, 'fatLoss'))).toEqual(dose(firstItem(liftSession, 'strength')));
  });

  /**
   * A nudge, not a replacement. Landing exactly on the scheme would make every plan
   * prescribe the same thing and throw away the reason one was chosen over another.
   */
  it('moves toward the scheme without landing on it', () => {
    const item = firstItem(liftSession, 'strength');
    // The strength scheme is 3–5; the template asked for 8–12.
    expect(item.repRange![0]).toBeGreaterThan(3);
    expect(item.repRange![0]).toBeLessThan(8);
  });

  it('never prescribes fewer than one rep', () => {
    const single: SeedSessionTemplate = {
      ...liftSession,
      blocks: [{ style: 'straight', items: [{ ex: 'back-squat', sets: 5, reps: 1, restSec: 20 }] }],
    };
    const item = firstItem(single, 'strength');
    expect(item.reps!).toBeGreaterThanOrEqual(1);
    expect(item.restSec!).toBeGreaterThanOrEqual(15);
  });

  /** A long run does not get shorter because you said "build muscle". */
  it('never touches distance or pace', () => {
    for (const goal of ['strength', 'muscle', 'endurance', 'fatLoss'] as const) {
      expect(firstItem(runSession, goal)).toMatchObject({ distanceM: 8000, paceSecPerKm: 330 });
    }
  });
});

describe('the goal shaping a week', () => {
  const plan = (goal: SeedPlanTemplate['goal'], tags: string[] = []): SeedPlanTemplate =>
    ({
      slug: 'test-plan',
      name: 'Test Plan',
      description: '',
      goal,
      tags,
      weeks: 2,
      daysPerWeek: 2,
      slots: [
        { templateSlug: 'full-body-a', modality: 'strength', order: 1 },
        { templateSlug: 'full-body-b', modality: 'strength', order: 2 },
      ],
    }) as SeedPlanTemplate;

  const build = (template: SeedPlanTemplate, primaryGoal?: 'fatLoss' | 'strength') =>
    generatePlan({
      template,
      startDate: '2026-01-04',
      weeks: 2,
      availability: openWeek,
      exceptions: [],
      weekStartsOn: 0,
      exerciseBySlug,
      available: everything,
      sessionTemplateBySlug: templateBySlug,
      primaryGoal,
    });

  it('adds a conditioning session a week for fat loss', () => {
    const without = build(plan('strength'), 'strength');
    const with_ = build(plan('strength'), 'fatLoss');

    expect(with_.sessions.length - without.sessions.length).toBe(2); // one per week
  });

  it('leaves a race plan exactly as written', () => {
    const without = build(plan('race'), 'strength');
    const with_ = build(plan('race'), 'fatLoss');

    expect(with_.sessions).toHaveLength(without.sessions.length);
  });

  it('leaves a hybrid-race plan alone too', () => {
    const without = build(plan('strength', ['hyrox']), 'strength');
    const with_ = build(plan('strength', ['hyrox']), 'fatLoss');

    expect(with_.sessions).toHaveLength(without.sessions.length);
  });

  /**
   * An added session is a preference, not part of the programme. When the week has no room
   * it simply does not happen, and the plan is not reported as broken for it.
   */
  it('never reports an added session it could not place as a conflict', () => {
    const twoDaysOnly: AvailabilityRule[] = Array.from({ length: 7 }, (_, i) => ({
      weekday: i as Weekday,
      allowedModalities: i === 1 || i === 3 ? ALL : [],
    }));

    const result = generatePlan({
      template: plan('strength'),
      startDate: '2026-01-04',
      weeks: 1,
      availability: twoDaysOnly,
      exceptions: [],
      weekStartsOn: 0,
      exerciseBySlug,
      available: everything,
      sessionTemplateBySlug: templateBySlug,
      primaryGoal: 'fatLoss',
    });

    // Both real sessions placed; the extra had nowhere to go and said nothing about it.
    expect(result.sessions).toHaveLength(2);
    expect(result.conflicts).toEqual([]);
  });
});

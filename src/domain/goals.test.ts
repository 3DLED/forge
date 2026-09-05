import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIMARY_GOAL,
  PRIMARY_GOALS,
  acceptsExtraConditioning,
  extraConditioningFor,
  goalSpec,
  rankByGoal,
} from './goals';
import type { GoalKind } from './types';

describe('goalSpec', () => {
  it('treats an unanswered goal as no bias at all', () => {
    expect(goalSpec(undefined)).toBe(PRIMARY_GOALS[DEFAULT_PRIMARY_GOAL]);
    expect(goalSpec(undefined).extraConditioning).toBe(0);
  });

  /**
   * The evidence-led decision, and the one most likely to be "corrected" later by someone
   * reaching for light circuits: in a deficit, load is what preserves muscle and strength.
   */
  it('keeps fat loss on the heavy scheme', () => {
    expect(goalSpec('fatLoss').lifting).toBe('strength');
  });

  it('says out loud why fat loss lifts heavy', () => {
    expect(goalSpec('fatLoss').note).toBeTruthy();
    expect(goalSpec('fatLoss').note).toMatch(/protects muscle/i);
  });

  it('adds conditioning for fat loss and endurance, and for nothing else', () => {
    expect(goalSpec('fatLoss').extraConditioning).toBeGreaterThan(0);
    expect(goalSpec('endurance').extraConditioning).toBeGreaterThan(0);
    expect(goalSpec('strength').extraConditioning).toBe(0);
    expect(goalSpec('muscle').extraConditioning).toBe(0);
    expect(goalSpec('general').extraConditioning).toBe(0);
  });

  it('maps each goal to a lifting dose', () => {
    expect(goalSpec('strength').lifting).toBe('strength');
    expect(goalSpec('muscle').lifting).toBe('muscle');
    expect(goalSpec('endurance').lifting).toBe('endurance');
    expect(goalSpec('general').lifting).toBe('muscle');
  });
});

describe('acceptsExtraConditioning', () => {
  /**
   * A plan built around an event already decided its conditioning — that is most of what a
   * race plan is. Adding to it would override a choice rather than express a preference.
   */
  it('refuses to add anything to a race plan', () => {
    expect(acceptsExtraConditioning('race')).toBe(false);
  });

  it('refuses hybrid-race plans, however they are tagged', () => {
    expect(acceptsExtraConditioning('general', ['hybridRace'])).toBe(false);
    expect(acceptsExtraConditioning('strength', ['ocr'])).toBe(false);
  });

  it('allows open-ended plans', () => {
    expect(acceptsExtraConditioning('general')).toBe(true);
    expect(acceptsExtraConditioning('strength')).toBe(true);
    expect(acceptsExtraConditioning('physique', ['hybrid'])).toBe(true);
  });
});

describe('extraConditioningFor', () => {
  it('adds a session to an open-ended plan when the goal asks', () => {
    expect(extraConditioningFor('fatLoss', 'strength')).toBe(1);
  });

  it('adds nothing to a race plan even when the goal asks', () => {
    expect(extraConditioningFor('fatLoss', 'race')).toBe(0);
    expect(extraConditioningFor('endurance', 'general', ['hybridRace'])).toBe(0);
  });

  it('adds nothing when the goal does not ask', () => {
    expect(extraConditioningFor('strength', 'general')).toBe(0);
    expect(extraConditioningFor(undefined, 'general')).toBe(0);
  });
});

describe('rankByGoal', () => {
  const templates = [
    { slug: 'race-a', goal: 'race' as GoalKind },
    { slug: 'strength-a', goal: 'strength' as GoalKind },
    { slug: 'physique-a', goal: 'physique' as GoalKind },
    { slug: 'general-a', goal: 'general' as GoalKind },
  ];

  it('leads with the kinds the goal prefers', () => {
    const ranked = rankByGoal(templates, 'strength');
    expect(ranked[0].goal).toBe('strength');
  });

  it('puts race plans first for an endurance athlete', () => {
    expect(rankByGoal(templates, 'endurance')[0].goal).toBe('race');
  });

  it('keeps every template, never filters', () => {
    expect(rankByGoal(templates, 'muscle')).toHaveLength(templates.length);
  });

  /** A catalogue that reshuffles unrecognisably on every change is one you stop scanning. */
  it('leaves the library order alone within a rank', () => {
    const many = [
      { slug: 'first', goal: 'general' as GoalKind },
      { slug: 'second', goal: 'general' as GoalKind },
      { slug: 'third', goal: 'general' as GoalKind },
    ];
    expect(rankByGoal(many, 'strength').map((t) => t.slug)).toEqual(['first', 'second', 'third']);
  });

  it('changes nothing when no goal has been chosen', () => {
    const ranked = rankByGoal(templates, undefined);
    // 'general' is the only preferred kind, so only it is promoted.
    expect(ranked[0].goal).toBe('general');
    expect(ranked).toHaveLength(templates.length);
  });
});

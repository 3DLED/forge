import { describe, expect, it } from 'vitest';
import {
  SEVERITIES,
  activeInjuries,
  affectsExercise,
  affectsPrescription,
  injuriesAffecting,
  isActive,
  planRest,
  recoverable,
  suggestedRestUntil,
} from './injuries';
import type { Injury } from './injuries';
import type { Exercise, Prescription } from './types';

const TODAY = '2026-03-10';

const injury = (over: Partial<Injury> = {}): Injury => ({
  id: 'i1',
  region: 'upper',
  label: 'left shoulder',
  severity: 'sore',
  startDate: TODAY,
  restUntil: '2026-03-20',
  ...over,
});

/** Region is derived from pattern, so the pattern is all a fixture needs. */
const ex = (slug: string, pattern: Exercise['pattern']): Exercise =>
  ({ slug, pattern }) as Exercise;

const bench = ex('bench-press', 'pushHorizontal');
const squat = ex('back-squat', 'squat');
const run = ex('run', 'gait');
const plank = ex('plank', 'core');

const bySlug = new Map([
  [bench.slug, bench],
  [squat.slug, squat],
  [run.slug, run],
  [plank.slug, plank],
]);

const prescription = (slugs: string[]): Prescription => ({
  name: 'Session',
  modalities: ['strength'],
  blocks: [
    {
      id: 'b1',
      style: 'straight',
      items: slugs.map((slug, i) => ({ id: `i${i}`, exerciseSlug: slug, load: { kind: 'unspecified' } })),
    },
  ],
});

const planned = (id: string, date: string, slugs: string[], status = 'planned') => ({
  id,
  date,
  status,
  prescription: prescription(slugs),
});

describe('suggested rest', () => {
  it('counts forward from the day it happened', () => {
    expect(suggestedRestUntil('2026-03-10', 'twinge')).toBe('2026-03-13');
  });

  it('proposes longer the worse you rated it', () => {
    expect(SEVERITIES.twinge.suggestedDays).toBeLessThan(SEVERITIES.sore.suggestedDays);
    expect(SEVERITIES.sore.suggestedDays).toBeLessThan(SEVERITIES.unusable.suggestedDays);
  });
});

describe('isActive', () => {
  it('is active through the last day of the window, inclusive', () => {
    expect(isActive(injury({ restUntil: TODAY }), TODAY)).toBe(true);
  });

  it('is over the day after the window', () => {
    expect(isActive(injury({ restUntil: '2026-03-09' }), TODAY)).toBe(false);
  });

  /** Healing early is the whole point of being able to resolve one. */
  it('is over the moment it is resolved, whatever the window said', () => {
    expect(isActive(injury({ restUntil: '2099-01-01', resolvedDate: TODAY }), TODAY)).toBe(false);
  });

  it('filters a list down to the ones still current', () => {
    const list = [
      injury({ id: 'current' }),
      injury({ id: 'expired', restUntil: '2026-01-01' }),
      injury({ id: 'healed', resolvedDate: '2026-03-01' }),
    ];
    expect(activeInjuries(list, TODAY).map((i) => i.id)).toEqual(['current']);
  });
});

describe('what an injury reaches', () => {
  it('matches movements that load the same area', () => {
    expect(affectsExercise(injury({ region: 'upper' }), bench)).toBe(true);
  });

  /** The premise: an injury stops one area, not training. */
  it('leaves other areas alone', () => {
    const shoulder = injury({ region: 'upper' });
    expect(affectsExercise(shoulder, squat)).toBe(false);
    expect(affectsExercise(shoulder, run)).toBe(false);
    expect(affectsExercise(shoulder, plank)).toBe(false);
  });

  it('says nothing about a movement it cannot find', () => {
    expect(affectsExercise(injury(), undefined)).toBe(false);
  });

  it('reports every current injury a movement runs into', () => {
    const list = [
      injury({ id: 'shoulder', region: 'upper' }),
      injury({ id: 'knee', region: 'lower' }),
      injury({ id: 'old', region: 'upper', restUntil: '2026-01-01' }),
    ];
    expect(injuriesAffecting(list, bench, TODAY).map((i) => i.id)).toEqual(['shoulder']);
  });

  /** One affected movement is enough; a session is done as a whole. */
  it('flags a session when any one movement loads the area', () => {
    const mixed = prescription(['back-squat', 'bench-press']);
    expect(affectsPrescription(injury({ region: 'upper' }), mixed, bySlug)).toBe(true);
  });

  it('leaves a session alone when none of it touches the area', () => {
    const legs = prescription(['back-squat']);
    expect(affectsPrescription(injury({ region: 'upper' }), legs, bySlug)).toBe(false);
  });
});

describe('planRest', () => {
  const sessions = [
    planned('upper', '2026-03-12', ['bench-press']),
    planned('lower', '2026-03-13', ['back-squat']),
    planned('run', '2026-03-14', ['run']),
  ];

  it('stands down only the sessions that load the area', () => {
    const rest = planRest({ injury: injury(), sessions, exerciseBySlug: bySlug, from: TODAY });

    expect(rest.affected.map((a) => a.session.id)).toEqual(['upper']);
    expect(rest.unaffected).toBe(2);
  });

  it('ignores sessions beyond the rest window', () => {
    const later = [...sessions, planned('after', '2026-04-01', ['bench-press'])];
    const rest = planRest({ injury: injury(), sessions: later, exerciseBySlug: bySlug, from: TODAY });

    expect(rest.affected.map((a) => a.session.id)).toEqual(['upper']);
  });

  it('ignores sessions already behind you', () => {
    const past = [planned('yesterday', '2026-03-09', ['bench-press']), ...sessions];
    const rest = planRest({ injury: injury(), sessions: past, exerciseBySlug: bySlug, from: TODAY });

    expect(rest.affected.map((a) => a.session.id)).toEqual(['upper']);
  });

  /** Work already done is a record of what happened and is never rewritten. */
  it('never touches a session that is completed or already skipped', () => {
    const done = [
      planned('done', '2026-03-12', ['bench-press'], 'completed'),
      planned('gone', '2026-03-13', ['bench-press'], 'skipped'),
    ];
    const rest = planRest({ injury: injury(), sessions: done, exerciseBySlug: bySlug, from: TODAY });

    expect(rest.affected).toEqual([]);
    expect(rest.unaffected).toBe(0);
  });

  it('stands nothing down for an injury to an area you never train that week', () => {
    const rest = planRest({
      injury: injury({ region: 'core' }),
      sessions,
      exerciseBySlug: bySlug,
      from: TODAY,
    });

    expect(rest.affected).toEqual([]);
    expect(rest.unaffected).toBe(3);
  });
});

describe('recoverable', () => {
  it('offers back the skipped sessions still ahead of you', () => {
    const sessions = [
      planned('a', '2026-03-12', ['bench-press'], 'skipped'),
      planned('b', '2026-03-14', ['bench-press'], 'skipped'),
    ];
    expect(recoverable(sessions, TODAY).map((s) => s.id)).toEqual(['a', 'b']);
  });

  /** Putting one back on a day that has gone would be scheduling work you cannot do. */
  it('does not offer back a day that has already passed', () => {
    const sessions = [planned('gone', '2026-03-01', ['bench-press'], 'skipped')];
    expect(recoverable(sessions, TODAY)).toEqual([]);
  });

  it('leaves sessions that were never skipped alone', () => {
    const sessions = [planned('a', '2026-03-12', ['bench-press'], 'planned')];
    expect(recoverable(sessions, TODAY)).toEqual([]);
  });
});

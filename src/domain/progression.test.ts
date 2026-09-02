import { describe, expect, it } from 'vitest';
import { BEAT_BY, EASY_RPE, HARD_RPE, suggestProgression } from './progression';
import { nextLoadAbove, nextLoadBelow } from './equipment';
import type { Exercise, LoggedSession, LoggedSet, MetricKey } from './types';

const barbell = {
  slug: 'back-squat',
  metrics: ['weightKg', 'reps'] as MetricKey[],
  pattern: 'squat',
} as Exercise;

const pushUp = {
  slug: 'push-up',
  metrics: ['reps'] as MetricKey[],
  pattern: 'pushHorizontal',
} as Exercise;

const set = (values: LoggedSet['values']): LoggedSet =>
  ({ id: Math.random().toString(), exerciseSlug: 'back-squat', setIndex: 0, values, completed: true }) as LoggedSet;

function session(over: {
  date: string;
  rpe?: number;
  reps?: number;
  loadKg?: number;
  slug?: string;
  ended?: boolean;
}): LoggedSession {
  const values: LoggedSet['values'] = { reps: over.reps ?? 8 };
  if (over.loadKg) values.weightKg = over.loadKg;

  return {
    id: over.date,
    date: over.date,
    name: 'Session',
    sessionRpe: over.rpe,
    endedAt: over.ended === false ? undefined : `${over.date}T11:00:00.000Z`,
    sets: [{ ...set(values), exerciseSlug: over.slug ?? 'back-squat' }],
  } as LoggedSession;
}

const suggest = (sessions: LoggedSession[], over: { exercise?: Exercise; loads?: number[] } = {}) =>
  suggestProgression({
    exercise: over.exercise ?? barbell,
    sessions,
    repRange: [8, 12],
    loads: over.loads,
  });

describe('staying quiet', () => {
  it('says nothing without any history', () => {
    expect(suggest([])).toBeUndefined();
  });

  it('says nothing when the session went as prescribed and felt ordinary', () => {
    expect(suggest([session({ date: '2026-03-01', rpe: 7, reps: 10, loadKg: 100 })])).toBeUndefined();
  });

  it('ignores a session that was never finished', () => {
    expect(
      suggest([session({ date: '2026-03-01', rpe: 4, reps: 10, loadKg: 100, ended: false })]),
    ).toBeUndefined();
  });

  it('ignores other movements', () => {
    expect(
      suggest([session({ date: '2026-03-01', rpe: 4, reps: 10, loadKg: 100, slug: 'bench-press' })]),
    ).toBeUndefined();
  });
});

describe('adding after an easy session', () => {
  /** Double progression: the range gets climbed before anything heavier goes on the bar. */
  it('adds a rep while there is range left', () => {
    const suggestion = suggest([session({ date: '2026-03-01', rpe: EASY_RPE, reps: 9, loadKg: 100 })]);

    expect(suggestion).toMatchObject({ direction: 'up', change: 'reps', reps: 10 });
  });

  it('adds load once the top of the range is reached', () => {
    const suggestion = suggest(
      [session({ date: '2026-03-01', rpe: 5, reps: 12, loadKg: 100 })],
      { loads: [90, 100, 110] },
    );

    expect(suggestion).toMatchObject({ direction: 'up', change: 'load', loadKg: 110 });
  });

  /** Resetting the reps is what makes double progression a cycle rather than a ratchet. */
  it('drops the reps back to the bottom of the range when load goes up', () => {
    const suggestion = suggest(
      [session({ date: '2026-03-01', rpe: 5, reps: 12, loadKg: 100 })],
      { loads: [90, 100, 110] },
    );

    expect(suggestion?.reps).toBe(8);
  });

  it('says nothing at the top of the rack', () => {
    expect(
      suggest([session({ date: '2026-03-01', rpe: 5, reps: 12, loadKg: 110 })], {
        loads: [90, 100, 110],
      }),
    ).toBeUndefined();
  });

  /** A bodyweight movement at the top of its range needs a harder variation, not a number. */
  it('says nothing for bodyweight work already at the top of the range', () => {
    expect(
      suggest([session({ date: '2026-03-01', rpe: 5, reps: 12, slug: 'push-up' })], {
        exercise: pushUp,
      }),
    ).toBeUndefined();
  });

  it('treats the easy threshold as inclusive', () => {
    expect(suggest([session({ date: '2026-03-01', rpe: EASY_RPE, reps: 9, loadKg: 100 })])
      ?.direction).toBe('up');
    expect(suggest([session({ date: '2026-03-01', rpe: EASY_RPE + 1, reps: 9, loadKg: 100 })]))
      .toBeUndefined();
  });
});

describe('the 2-for-2 rule', () => {
  const beating = (date: string) => session({ date, reps: 12 + BEAT_BY, loadKg: 100 });

  /** One good day is not a trend, which is the whole point of the rule being conservative. */
  it('does not add after a single session over target', () => {
    expect(suggest([beating('2026-03-08')])).toBeUndefined();
  });

  it('adds load after two consecutive sessions over target', () => {
    const suggestion = suggest([beating('2026-03-08'), beating('2026-03-01')], {
      loads: [90, 100, 110],
    });

    expect(suggestion).toMatchObject({ direction: 'up', change: 'load', loadKg: 110 });
  });

  it('does not add when only the most recent session beat the target', () => {
    expect(
      suggest([beating('2026-03-08'), session({ date: '2026-03-01', reps: 12, loadKg: 100 })]),
    ).toBeUndefined();
  });

  it('needs the target beaten by the full margin', () => {
    const justOver = (date: string) => session({ date, reps: 12 + BEAT_BY - 1, loadKg: 100 });
    expect(suggest([justOver('2026-03-08'), justOver('2026-03-01')])).toBeUndefined();
  });

  /** It is deliberately blind to how the session felt — that is the other trigger's job. */
  it('applies without any effort rating at all', () => {
    expect(suggest([beating('2026-03-08'), beating('2026-03-01')])?.direction).toBe('up');
  });
});

describe('backing off after a hard session', () => {
  it('takes a rep off after a session that took everything', () => {
    const suggestion = suggest([session({ date: '2026-03-01', rpe: HARD_RPE, reps: 10, loadKg: 100 })]);

    expect(suggestion).toMatchObject({ direction: 'down', change: 'reps', reps: 9 });
  });

  it('drops the load when already at the bottom of the range', () => {
    const suggestion = suggest(
      [session({ date: '2026-03-01', rpe: 10, reps: 8, loadKg: 100 })],
      { loads: [90, 100, 110] },
    );

    expect(suggestion).toMatchObject({ direction: 'down', change: 'load', loadKg: 90, reps: 12 });
  });

  /** Missing the prescribed reps is a signal in itself, rating or no rating. */
  it('backs off when the reps were missed, however it felt', () => {
    const suggestion = suggest(
      [session({ date: '2026-03-01', reps: 5, loadKg: 100 })],
      { loads: [90, 100, 110] },
    );

    expect(suggestion).toMatchObject({ direction: 'down', change: 'load', loadKg: 90 });
  });

  /**
   * Both signals at once is the unambiguous case, and checking "was it easy" first would let a
   * missed session that happened to go unrated slip past as no signal at all.
   */
  it('backs off rather than adding when a session was both hard and short', () => {
    expect(
      suggest([session({ date: '2026-03-01', rpe: 10, reps: 4, loadKg: 100 })], {
        loads: [90, 100, 110],
      })?.direction,
    ).toBe('down');
  });

  it('says nothing at the bottom of the rack', () => {
    expect(
      suggest([session({ date: '2026-03-01', rpe: 10, reps: 8, loadKg: 90 })], {
        loads: [90, 100, 110],
      }),
    ).toBeUndefined();
  });
});

describe('next load helpers', () => {
  it('finds the next bell up and down', () => {
    expect(nextLoadAbove(24, [16, 24, 32])).toBe(32);
    expect(nextLoadBelow(24, [16, 24, 32])).toBe(16);
  });

  it('reports the ends of the rack', () => {
    expect(nextLoadAbove(32, [16, 24, 32])).toBeUndefined();
    expect(nextLoadBelow(16, [16, 24, 32])).toBeUndefined();
  });

  /** No rack means anything is loadable, so it steps by an NSCA-sized increment. */
  it('steps by a couple of kilos with no rack defined', () => {
    expect(nextLoadAbove(100)).toBe(102.5);
    expect(nextLoadBelow(100)).toBe(97.5);
  });

  it('never proposes a load of nothing', () => {
    expect(nextLoadBelow(2)).toBeUndefined();
  });
});

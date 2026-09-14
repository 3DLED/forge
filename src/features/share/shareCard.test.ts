/**
 * What the share card says. The painting cannot run here; the decisions about content can,
 * and they are where a wrong card would come from.
 */

import { describe, expect, it } from 'vitest';
import { cardData } from './shareCard';
import { encodeSeries } from '../../domain/series';
import { formatPace } from '../../domain/units';
import type { Exercise, LoggedSession, LoggedSet } from '../../domain/types';

const exercise = (slug: string, name: string, pattern: string): Exercise =>
  ({ slug, name, pattern, metrics: [], bodyweightFactor: 0, unilateral: false }) as unknown as Exercise;

const bySlug = new Map<string, Exercise>([
  ['easy-run', exercise('easy-run', 'Easy Run', 'gait')],
  ['kb-swing', exercise('kb-swing', 'Kettlebell Swing', 'hinge')],
  ['push-up', exercise('push-up', 'Push-Up', 'pushHorizontal')],
]);

const t = (english: string) => english;

const session = (over: Partial<LoggedSession>): LoggedSession =>
  ({
    id: 's',
    date: '2026-09-13',
    name: 'Sunday run',
    sets: [],
    createdAt: '2026-09-13T09:00:00.000Z',
    updatedAt: '2026-09-13T09:00:00.000Z',
    startedAt: '2026-09-13T09:00:00.000Z',
    endedAt: '2026-09-13T10:00:00.000Z',
    ...over,
  }) as LoggedSession;

const set = (exerciseSlug: string, values: LoggedSet['values'], over: Partial<LoggedSet> = {}): LoggedSet => ({
  id: `${exerciseSlug}-${Math.random()}`,
  exerciseSlug,
  setIndex: 0,
  values,
  completed: true,
  ...over,
});

/** 3.2 km at five minutes a kilometre, traced every hundred metres. */
const trace = encodeSeries(Array.from({ length: 32 }, (_, i) => (i + 1) * 30));
const run = (over: Partial<LoggedSet> = {}) =>
  session({ sets: [set('easy-run', { distanceM: 3200, timeSec: 960 }, { runTrace: trace, ...over })] });

describe('a run card', () => {
  it('leads with distance, time and average pace', () => {
    const data = cardData(run(), { bySlug, units: 'metric', t });
    expect(data.kind).toBe('run');
    expect(data.stats.map((stat) => stat.label)).toEqual(['Distance', 'Time', 'Avg pace']);
    expect(data.stats[2].value).toBe(formatPace(300, 'metric'));
  });

  /* The trace is stored so splits can follow whatever units the reader has now. */
  it('draws splits in the unit on screen', () => {
    const metric = cardData(run(), { bySlug, units: 'metric', t });
    expect(metric.splits.map((split) => split.label)).toEqual(['Km 1', 'Km 2', 'Km 3', expect.any(String)]);
    expect(metric.splits[3].partial).toBe(true);

    const imperial = cardData(run(), { bySlug, units: 'imperial', t });
    expect(imperial.splits[0].label).toBe('Mile 1');
    expect(imperial.splits).toHaveLength(2);
  });

  /* A run from before traces were kept must not show an evenly paced run nobody ran. */
  it('shows no splits for a run recorded without a trace', () => {
    expect(cardData(run({ runTrace: undefined }), { bySlug, units: 'metric', t }).splits).toEqual([]);
  });

  it('carries heart rate with its minute-by-minute curve', () => {
    const data = cardData(
      { ...run(), avgHrBpm: 151, maxHrBpm: 172, hrPerMinute: encodeSeries([140, 150, 0, 160]) },
      { bySlug, units: 'metric', t },
    );
    expect(data.heart).toEqual({ avg: 151, max: 172, curve: [140, 150, 0, 160] });
  });

  it('leaves heart rate off entirely when the watch was not there', () => {
    expect(cardData(run(), { bySlug, units: 'metric', t }).heart).toBeNull();
  });
});

describe('a workout card', () => {
  const workout = session({
    name: 'Kettlebells',
    durationMin: 40,
    sets: [
      set('kb-swing', { reps: 20, weightKg: 24 }),
      set('kb-swing', { reps: 20, weightKg: 24 }),
      set('kb-swing', { reps: 20, weightKg: 24 }),
      set('push-up', { reps: 15 }),
      set('push-up', { reps: 15 }, { completed: false }),
    ],
  });

  it('leads with duration, sets and volume', () => {
    const data = cardData(workout, { bySlug, units: 'metric', t });
    expect(data.kind).toBe('workout');
    expect(data.stats.map((stat) => stat.label)).toEqual(['Duration', 'Sets', 'Volume']);
    expect(data.stats[0].value).toBe('40:00');
    expect(data.stats[1].value).toBe('4');
  });

  it('names what was done most, counting only finished sets', () => {
    expect(cardData(workout, { bySlug, units: 'metric', t }).highlights).toEqual([
      '3 × Kettlebell Swing',
      '1 × Push-Up',
    ]);
  });

  it('has no splits', () => {
    expect(cardData(workout, { bySlug, units: 'metric', t }).splits).toEqual([]);
  });
});

/**
 * @vitest-environment jsdom
 *
 * The tracker, driven by a receiver we control.
 *
 * The pure engines are tested next door; what is left here is everything that only exists
 * because a real run has a subscription and a clock — which is also where the bug that
 * prompted these tests lived. On a prescribed recovery jog at 11:16, the drift alert was
 * comparing against the standing easy-run target of 8:00 and shouting "pick it up, 196
 * seconds slow" at somebody running exactly what they had been told to run.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunTracker } from './useRunTracker';
import { buildRunPlan } from '../../domain/runPlan';
import { runSettingsFor, type RunSettings } from '../../domain/runSettings';
import type { Fix } from '../../domain/pace';
import type { LocationSource } from '../../data/locationSource';

/** Metres per degree of latitude, near enough for a route that only runs north. */
const M_PER_DEG = 111_320;

/**
 * A receiver on a leash.
 *
 * Runs due north from a fixed point at whatever speed it is told, one fix a second, and moves
 * the clock with it — the tracker reads `Date.now()` for elapsed time, so a simulation that
 * only moved the fixes would report a run that took no time at all.
 */
function fakeReceiver(startedAt: number) {
  let onFix: ((fix: Fix | null, error: Error | null) => void) | null = null;
  const state = { at: startedAt, lat: 51.5, speedMps: 1000 / 300 };

  const source: LocationSource = {
    available: () => true,
    watch: async (_options, handler) => {
      onFix = handler;
      return { stop: async () => { onFix = null; } };
    },
  };

  const advance = (seconds: number, secPerKm?: number) => {
    if (secPerKm != null) state.speedMps = 1000 / secPerKm;
    for (let i = 0; i < seconds; i += 1) {
      state.at += 1000;
      state.lat += state.speedMps / M_PER_DEG;
      vi.setSystemTime(state.at);
      onFix?.({ at: state.at, lat: state.lat, lon: -0.12, accuracy: 5, speed: state.speedMps }, null);
    }
  };

  return { source, advance, fail: (message: string) => onFix?.(null, new Error(message)) };
}

const START = 1_700_000_000_000;

const settings = (over: Partial<RunSettings> = {}): RunSettings => ({
  ...runSettingsFor('metric'),
  ...over,
});

/** Four by four hundred, so a whole session fits inside a test. */
const reps = buildRunPlan({
  kind: 'intervals',
  warmupSec: 120,
  reps: 4,
  workM: 400,
  workSecPerKm: 240,
  floatM: 200,
  floatSecPerKm: 480,
  cooldownSec: 0,
})!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

async function trackerFor(options: { settings: RunSettings; plan?: typeof reps | null }) {
  const receiver = fakeReceiver(START);
  const rendered = renderHook(() =>
    useRunTracker({
      settings: options.settings,
      units: 'metric',
      plan: options.plan ?? null,
      source: receiver.source,
    }),
  );

  act(() => rendered.result.current.start());
  // The watch is opened by a promise, so it is not listening until that has settled.
  await act(async () => {});
  return { ...rendered, receiver };
}

describe('measuring a run', () => {
  it('accumulates distance and time as fixes arrive', async () => {
    const { result, receiver } = await trackerFor({ settings: settings() });

    act(() => receiver.advance(300, 300));

    // A kilometre in five minutes, give or take the metre a one-second fix rate costs.
    expect(result.current.distanceM).toBeGreaterThan(990);
    expect(result.current.distanceM).toBeLessThan(1010);
    expect(result.current.elapsedSec).toBeCloseTo(300, 0);
    expect(result.current.averageSecPerKm).toBeGreaterThan(295);
    expect(result.current.averageSecPerKm).toBeLessThan(305);
  });

  /* Standing still already costs no distance; the clock is the part that has to be told. */
  it('holds the clock across a pause and does not lose the distance', async () => {
    const { result, receiver } = await trackerFor({ settings: settings() });

    act(() => receiver.advance(120, 300));
    const distance = result.current.distanceM;

    act(() => result.current.pause());
    act(() => vi.setSystemTime(START + 600_000));

    expect(result.current.elapsedSec).toBeCloseTo(120, 0);
    expect(result.current.distanceM).toBe(distance);
  });

  it('surfaces a receiver that gave up rather than showing zeroes', async () => {
    const { result, receiver } = await trackerFor({ settings: settings() });

    act(() => receiver.fail('Location permission was refused.'));
    expect(result.current.error).toContain('permission');
  });
});

describe('what it says about pace', () => {
  /*
   * The bug these tests exist for. Running the prescribed 8:00/km recovery while the standing
   * target says 4:00/km is not being slow — it is doing what the session said.
   */
  it('judges a piece against its own target, not the standing one', async () => {
    const { result, receiver } = await trackerFor({
      settings: settings({ paceAlerts: true, targetSecPerKm: 240, toleranceSecPerKm: 15 }),
      plan: reps,
    });

    /*
     * Two minutes of warm-up, the 400 run at exactly its 4:00, then the float at exactly its
     * 8:00. Each leg is sized to its own piece rather than to a round number of seconds: the
     * target changes the instant a piece ends, so a leg that overran would be judging the
     * next piece by this one's number — which is the very bug under test, inverted.
     */
    act(() => receiver.advance(120, 300)); // warm-up ends; 400 m covered, rep one begins
    act(() => receiver.advance(96, 240)); // the whole 400, on its prescribed pace
    act(() => receiver.advance(85, 480)); // 177 m of the 200 float, on its prescribed pace

    const complaints = result.current.notes.filter((note) => note.kind === 'drift');
    expect(complaints).toHaveLength(0);
  });

  it('still complains when the piece itself is being run wrong', async () => {
    const { result, receiver } = await trackerFor({
      settings: settings({ paceAlerts: true, targetSecPerKm: 240, toleranceSecPerKm: 15 }),
      plan: reps,
    });

    act(() => receiver.advance(120, 300));
    // Into the first rep, prescribed at 4:00/km, run at 5:30 — and not out the other side.
    act(() => receiver.advance(90, 330));

    const complaints = result.current.notes.filter((note) => note.kind === 'drift');
    expect(complaints.length).toBeGreaterThan(0);
    expect(complaints[0].text).toContain('Pick it up');
  });

  /* Off has to mean off, including where the session supplies a number of its own. */
  it('says nothing about pace when alerts are switched off', async () => {
    const { result, receiver } = await trackerFor({
      settings: settings({ paceAlerts: false }),
      plan: reps,
    });

    act(() => receiver.advance(120, 300));
    act(() => receiver.advance(90, 330));

    expect(result.current.notes.filter((note) => note.kind === 'drift')).toHaveLength(0);
  });

  /*
   * A warm-up carries no target on purpose. Falling back to the standing one would nag
   * somebody for jogging gently during the ten minutes whose entire job is jogging gently.
   */
  it('leaves a piece alone when the session set no pace for it', async () => {
    const { result, receiver } = await trackerFor({
      settings: settings({ paceAlerts: true, targetSecPerKm: 240, toleranceSecPerKm: 15 }),
      plan: reps,
    });

    act(() => receiver.advance(115, 400));
    expect(result.current.notes.filter((note) => note.kind === 'drift')).toHaveLength(0);
  });

  /* Without a session, the standing target is the whole point of the feature. */
  it('uses the standing target on a run with no shape to it', async () => {
    const { result, receiver } = await trackerFor({
      settings: settings({ paceAlerts: true, targetSecPerKm: 240, toleranceSecPerKm: 15 }),
      plan: null,
    });

    act(() => receiver.advance(120, 330));

    const complaints = result.current.notes.filter((note) => note.kind === 'drift');
    expect(complaints.length).toBeGreaterThan(0);
    expect(complaints[0].text).toContain('Pick it up');
  });

  it('announces each piece as it starts', async () => {
    const { result, receiver } = await trackerFor({ settings: settings(), plan: reps });

    act(() => receiver.advance(120, 300));

    const calls = result.current.notes.filter((note) => note.kind === 'segment');
    expect(calls[0].text).toContain('Next, run 400 metres at 4:00 /km');
  });

  it('keeps quiet about the session when segment cues are off', async () => {
    const { result, receiver } = await trackerFor({
      settings: settings({ segmentCues: false }),
      plan: reps,
    });

    act(() => receiver.advance(120, 300));
    expect(result.current.notes.filter((note) => note.kind === 'segment')).toHaveLength(0);
  });
});

describe('reading the session as a whole', () => {
  it('records what each finished piece actually cost', async () => {
    const { result, receiver } = await trackerFor({ settings: settings(), plan: reps });

    act(() => receiver.advance(120, 300));
    act(() => receiver.advance(100, 240));

    expect(result.current.finished[0]).toMatchObject({ index: 0, seconds: 120 });
    expect(result.current.finished[1].index).toBe(1);
    expect(result.current.finished[1].distanceM).toBe(400);
  });

  it('reports which piece is being run and what is left of it', async () => {
    const { result, receiver } = await trackerFor({ settings: settings(), plan: reps });

    act(() => receiver.advance(120, 300));
    act(() => receiver.advance(50, 240));

    expect(result.current.progress?.index).toBe(1);
    expect(result.current.progress?.remainingM).toBeGreaterThan(180);
    expect(result.current.progress?.remainingM).toBeLessThan(220);
  });

  it('has nothing to report about a plan when there is not one', async () => {
    const { result, receiver } = await trackerFor({ settings: settings(), plan: null });

    act(() => receiver.advance(300, 300));
    expect(result.current.progress).toBeNull();
    expect(result.current.finished).toHaveLength(0);
  });
});

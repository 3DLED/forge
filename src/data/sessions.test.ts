/**
 * The data layer, against a real Dexie talking to an in-memory IndexedDB.
 *
 * Everything here covers something that actually broke in use. The set-collapsing rule, the
 * detach-on-ungroup and the stopwatch banking were each shipped wrong once, and each looked
 * fine on screen while being wrong in the record — which is exactly the kind of failure no
 * amount of clicking through the app reliably catches.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, type StoredLoggedSession } from '../db/db';
import {
  convertSessionToBlock,
  finishSession,
  removeBlock,
  sessionElapsedSec,
  startFromPlanned,
} from './sessions';
import type { LoggedSession, LoggedSet } from '../domain/types';

function set(id: string, exerciseSlug: string, over: Partial<LoggedSet> = {}): LoggedSet {
  return { id, exerciseSlug, setIndex: 0, values: { reps: 8 }, completed: false, ...over };
}

async function seed(sets: LoggedSet[], over: Partial<LoggedSession> = {}): Promise<LoggedSession> {
  const session = {
    id: 'S1',
    date: '2026-01-05',
    name: 'Test session',
    sets,
    blocks: [],
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-05T10:00:00.000Z',
    ...over,
    // The table's multi-entry index, normally stamped by the repo layer on the way in.
    exerciseSlugs: [...new Set(sets.map((s) => s.exerciseSlug))],
  } as StoredLoggedSession;

  await db.loggedSessions.put(session);
  return session;
}

const reread = async () => (await db.loggedSessions.get('S1'))!;
const blocksOf = async () => (await reread()).blocks ?? [];

beforeEach(async () => {
  await db.loggedSessions.clear();
  await db.plannedSessions.clear();
  await db.changes.clear();
});

describe('convertSessionToBlock', () => {
  const threeByFour = () =>
    ['push-up', 'row', 'pike-push-up'].flatMap((slug) =>
      Array.from({ length: 4 }, (_, i) => set(`${slug}-${i}`, slug, { setIndex: i })),
    );

  it('collapses each movement to one row, because the rounds are the sets', async () => {
    const session = await seed(threeByFour());
    expect(session.sets).toHaveLength(12);

    await convertSessionToBlock(session, { style: 'amrap', capSec: 720 });

    const after = await reread();
    expect(after.sets).toHaveLength(3);
    expect(after.sets.map((s) => s.exerciseSlug)).toEqual(['push-up', 'row', 'pike-push-up']);
  });

  it('puts the round recipe inside the new block', async () => {
    const session = await seed(threeByFour());
    const { block } = await convertSessionToBlock(session, { style: 'amrap', capSec: 720 });

    const after = await reread();
    expect(after.sets.every((s) => s.blockId === block.id)).toBe(true);
    expect(after.sets.every((s) => !s.completed)).toBe(true);
    expect(await blocksOf()).toHaveLength(1);
  });

  /**
   * Collapsing is a tidying rule, and it must never apply to work that happened. A ticked-off
   * set is a fact about the training; the empty rows below it are only a plan.
   *
   * Work already done also stays *out* of the block. Two sets of push-ups you finished before
   * deciding to make the rest an AMRAP are two sets of push-ups, not a line of a round, and
   * filing them inside the block attributes them to a score they had no part in.
   */
  it('leaves completed sets loose, and gives the block a clean recipe row', async () => {
    const session = await seed([
      set('a', 'push-up', { completed: true, values: { reps: 12 } }),
      set('b', 'push-up', { completed: true, values: { reps: 10 } }),
      set('c', 'push-up'),
      set('d', 'push-up'),
    ]);

    const { block } = await convertSessionToBlock(session, { style: 'amrap', capSec: 720 });

    const after = await reread();
    const loose = after.sets.filter((s) => !s.blockId);
    const inBlock = after.sets.filter((s) => s.blockId === block.id);

    expect(loose.map((s) => s.values.reps)).toEqual([12, 10]);
    expect(loose.every((s) => s.completed)).toBe(true);
    expect(inBlock).toHaveLength(1);
    expect(inBlock[0]).toMatchObject({ exerciseSlug: 'push-up', completed: false });
  });

  /* The completed work has to come first, or it renders below the block it happened before. */
  it('orders the finished work above the block', async () => {
    const session = await seed([
      set('a', 'push-up', { completed: true }),
      set('b', 'push-up'),
      set('c', 'row'),
    ]);

    await convertSessionToBlock(session, { style: 'amrap', capSec: 720 });

    const after = await reread();
    expect(after.sets.map((s) => Boolean(s.blockId))).toEqual([false, true, true]);
  });

  /* Nothing done yet is the ordinary case: no stray loose section, just the round. */
  it('leaves nothing loose when no set was completed', async () => {
    const session = await seed(threeByFour());
    await convertSessionToBlock(session, { style: 'amrap', capSec: 720 });

    expect((await reread()).sets.filter((s) => !s.blockId)).toHaveLength(0);
  });

  it('takes the round target from the first row of each movement', async () => {
    const session = await seed([
      set('a', 'push-up', { completed: true, values: { reps: 15 } }),
      set('b', 'push-up', { values: { reps: 8 } }),
    ]);

    const { block } = await convertSessionToBlock(session, { style: 'amrap', capSec: 720 });

    const recipe = (await reread()).sets.find((s) => s.blockId === block.id)!;
    expect(recipe.values.reps).toBe(15);
  });

  /**
   * The logger keeps its own copy of the sets and flushes it on a debounce. Handed only the
   * block, it re-parents what it already had and writes the un-collapsed list straight back
   * over this a moment later — which is exactly what happened the first time.
   */
  it('hands back the sets it wrote, not just the block', async () => {
    const session = await seed(threeByFour());
    const result = await convertSessionToBlock(session, { style: 'amrap', capSec: 720 });

    expect(result.sets).toHaveLength(3);
    expect(result.sets).toEqual((await reread()).sets);
  });

  it('leaves sets belonging to another block untouched', async () => {
    const session = await seed(
      [
        set('x', 'burpee', { blockId: 'existing' }),
        set('a', 'push-up'),
        set('b', 'push-up'),
      ],
      { blocks: [{ id: 'existing', style: 'emom', intervalSec: 60, targetRounds: 10 }] },
    );

    const { block } = await convertSessionToBlock(session, { style: 'amrap', capSec: 720 });

    const after = await reread();
    expect(after.sets.find((s) => s.id === 'x')?.blockId).toBe('existing');
    // The loose push-ups become one recipe row in the new block; the EMOM is not touched.
    expect(after.sets.filter((s) => s.blockId === block.id)).toHaveLength(1);
    expect(await blocksOf()).toHaveLength(2);
  });
});

describe('removeBlock', () => {
  it('keeps the movements and detaches them back to the flat list', async () => {
    const session = await seed(
      [set('a', 'push-up', { blockId: 'b1' }), set('b', 'row', { blockId: 'b1' })],
      { blocks: [{ id: 'b1', style: 'amrap', capSec: 720 }] },
    );

    await removeBlock(session, 'b1');

    const after = await reread();
    expect(await blocksOf()).toHaveLength(0);
    expect(after.sets).toHaveLength(2);
    // The flag every "is there loose work here" check counts.
    expect(after.sets.every((s) => s.blockId === undefined)).toBe(true);
  });

  it('leaves other blocks and their sets alone', async () => {
    const session = await seed(
      [set('a', 'push-up', { blockId: 'b1' }), set('b', 'row', { blockId: 'b2' })],
      {
        blocks: [
          { id: 'b1', style: 'amrap', capSec: 720 },
          { id: 'b2', style: 'emom', intervalSec: 60, targetRounds: 10 },
        ],
      },
    );

    await removeBlock(session, 'b1');

    const after = await reread();
    expect((await blocksOf()).map((b) => b.id)).toEqual(['b2']);
    expect(after.sets.find((s) => s.id === 'b')?.blockId).toBe('b2');
  });
});

describe('finishSession', () => {
  it('stops the clock and banks what was on it', async () => {
    const session = await seed([], {
      elapsedSec: 100,
      runningSince: new Date(Date.now() - 60_000).toISOString(),
    });

    await finishSession(session, { sessionRpe: 7, durationMin: 45 });

    const after = await reread();
    expect(after.runningSince).toBeNull();
    expect(after.elapsedSec).toBeGreaterThanOrEqual(159);
    expect(after.elapsedSec).toBeLessThanOrEqual(162);
  });

  /**
   * The elapsed time is derived from runningSince, so a finished workout that keeps that
   * timestamp reports a longer duration every time it is read.
   */
  it('leaves a finished session frozen rather than still counting', async () => {
    const session = await seed([], {
      elapsedSec: 0,
      runningSince: new Date(Date.now() - 30_000).toISOString(),
    });

    await finishSession(session, {});

    const after = await reread();
    const first = sessionElapsedSec(after, Date.now());
    const later = sessionElapsedSec(after, Date.now() + 60_000);
    expect(later).toBe(first);
  });

  it('records the details it was given', async () => {
    const session = await seed([]);
    await finishSession(session, { sessionRpe: 8, durationMin: 52, feel: 'good', notes: 'hot' });

    const after = await reread();
    expect(after).toMatchObject({ sessionRpe: 8, durationMin: 52, feel: 'good', notes: 'hot' });
    expect(after.endedAt).toBeTruthy();
  });

  /**
   * Reopening a workout to correct its notes must not restamp when it ended. The first finish
   * is the one that happened.
   */
  it('keeps the original end time when the details are edited later', async () => {
    const endedAt = '2026-01-05T11:30:00.000Z';
    await seed([], { endedAt });

    await finishSession(await reread(), { notes: 'corrected weeks later' });

    expect((await reread()).endedAt).toBe(endedAt);
  });

  it('marks the planned session it came from as completed', async () => {
    await db.plannedSessions.put({
      id: 'P1',
      date: '2026-01-05',
      status: 'planned',
      prescription: { name: 'Full Body A', modalities: ['strength'], blocks: [] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as never);

    const session = await seed([], { plannedSessionId: 'P1' });
    await finishSession(session, { sessionRpe: 7, durationMin: 40 });

    const planned = await db.plannedSessions.get('P1');
    expect(planned).toMatchObject({ status: 'completed', loggedSessionId: 'S1' });
  });
});

/**
 * Starting a planned day twice.
 *
 * A planned session keeps its `planned` status the whole time it is being logged, so the
 * Start control never goes away — on Today, in the day sheet, in the week sheet. Tapping it
 * again used to build a second logged session over the top of the first and repoint the plan
 * at it, quietly orphaning everything already recorded against the day.
 */
describe('starting a planned session', () => {
  const plan = async (over: Record<string, unknown> = {}) => {
    await db.plannedSessions.put({
      id: 'P1',
      date: '2026-01-05',
      status: 'planned',
      prescription: {
        name: 'Full Body A',
        modalities: ['strength'],
        blocks: [
          {
            id: 'B1',
            style: 'straight',
            items: [{ id: 'I1', exerciseSlug: 'back-squat', sets: 3, reps: 5, load: { kind: 'unspecified' } }],
          },
        ],
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...over,
    } as never);
    return (await db.plannedSessions.get('P1'))!;
  };

  it('creates a session the first time', async () => {
    const session = await startFromPlanned(await plan());

    expect(session.plannedSessionId).toBe('P1');
    expect(await db.loggedSessions.count()).toBe(1);
    expect((await db.plannedSessions.get('P1'))!.loggedSessionId).toBe(session.id);
  });

  it('resumes the one already underway instead of starting a second', async () => {
    const first = await startFromPlanned(await plan());
    const again = await startFromPlanned((await db.plannedSessions.get('P1'))!);

    expect(again.id).toBe(first.id);
    expect(await db.loggedSessions.count()).toBe(1);
  });

  /* Everything logged so far has to survive being handed back. */
  it('resumes with the sets that were already logged against it', async () => {
    const first = await startFromPlanned(await plan());
    await db.loggedSessions.update(first.id, {
      sets: [set('done', 'back-squat', { completed: true, values: { reps: 5, weightKg: 100 } })],
    });

    const again = await startFromPlanned((await db.plannedSessions.get('P1'))!);

    expect(again.sets).toHaveLength(1);
    expect(again.sets[0]).toMatchObject({ id: 'done', completed: true });
  });

  /* A finished day is history; training it again is a new session, not a resumption. */
  it('starts a fresh session when the previous one was finished', async () => {
    const first = await startFromPlanned(await plan());
    await db.loggedSessions.update(first.id, { endedAt: '2026-01-05T11:00:00.000Z' });

    const again = await startFromPlanned((await db.plannedSessions.get('P1'))!);

    expect(again.id).not.toBe(first.id);
    expect(await db.loggedSessions.count()).toBe(2);
  });

  /* A dangling link must not stop the day being started at all. */
  it('starts a fresh session when the link points at nothing', async () => {
    const session = await startFromPlanned(await plan({ loggedSessionId: 'GONE' }));

    expect(session.id).not.toBe('GONE');
    expect(await db.loggedSessions.count()).toBe(1);
  });
});

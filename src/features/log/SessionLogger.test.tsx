/**
 * @vitest-environment jsdom
 *
 * The logging screen, rendered for real against a real database.
 *
 * Every case here is a bug that shipped. They share one shape: the logger holds its own copy
 * of the sets and flushes it on a debounce, so a write that goes straight to the database can
 * be silently overwritten a moment later by what the component still had in memory. That
 * failure is invisible to a unit test of either side on its own — the data layer is correct,
 * the component is correct, and the pair is wrong — which is the whole reason this file
 * renders the real thing instead of mocking anything.
 *
 * Assertions that matter check the stored record, not the screen. Three of these bugs looked
 * perfectly fine in the UI while being wrong in what was saved.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionLogger from './SessionLogger';
import { renderRoute, resetDatabase, seedSession, set, storedSession } from '../../test/harness';

/** Longer than the logger's 400ms write debounce, which is what undid an earlier fix. */
const PAST_THE_DEBOUNCE = 900;

const openLogger = () =>
  renderRoute('/log/S1', '/log/:sessionId', <SessionLogger />);

const settle = () => new Promise((resolve) => setTimeout(resolve, PAST_THE_DEBOUNCE));

beforeEach(async () => {
  await resetDatabase();
});

describe('a workout in progress', () => {
  it('starts the session clock the first time a set is ticked off', async () => {
    const user = userEvent.setup();
    await seedSession([set('a', 'push-up')]);
    await openLogger();

    expect((await storedSession()).runningSince).toBeUndefined();

    await user.click(await screen.findByRole('button', { name: /mark set 1 done/i }));

    await waitFor(async () => {
      expect((await storedSession()).runningSince).toBeTruthy();
    });
  });

  /**
   * The clock is started once, at the beginning. Pausing later is a deliberate act — you
   * racked the bar to take a call — and finishing the next set must not quietly undo it.
   */
  it('does not restart a clock that was deliberately paused', async () => {
    const user = userEvent.setup();
    await seedSession([set('a', 'push-up'), set('b', 'push-up', { setIndex: 1 })], {
      elapsedSec: 120,
    });
    await openLogger();

    await user.click(await screen.findByRole('button', { name: /mark set 2 done/i }));
    await settle();

    expect((await storedSession()).runningSince).toBeFalsy();
  });

  it('records the tick itself, not just the clock', async () => {
    const user = userEvent.setup();
    await seedSession([set('a', 'push-up')]);
    await openLogger();

    await user.click(await screen.findByRole('button', { name: /mark set 1 done/i }));

    await waitFor(async () => {
      expect((await storedSession()).sets[0].completed).toBe(true);
    });
  });
});

describe('turning a workout into a timed block', () => {
  const threeMovements = () =>
    ['push-up', 'burpee', 'air-squat'].flatMap((slug) =>
      Array.from({ length: 4 }, (_, i) => set(`${slug}-${i}`, slug, { setIndex: i })),
    );

  /**
   * The bug this exists for: the conversion collapsed the sets in the database correctly, the
   * screen showed the collapse, and then the logger's own copy of all twelve was written back
   * over it once the debounce fired.
   */
  it('collapses to one row per movement, and it stays collapsed', async () => {
    const user = userEvent.setup();
    await seedSession(threeMovements());
    await openLogger();

    await user.click(await screen.findByRole('button', { name: /make this a timed workout/i }));
    await user.click(await screen.findByRole('button', { name: /convert workout/i }));

    await waitFor(async () => {
      expect((await storedSession()).sets).toHaveLength(3);
    });

    // The moment the earlier fix came undone.
    await settle();
    expect((await storedSession()).sets).toHaveLength(3);
  });

  it('offers every shape, not only the one the button used to name', async () => {
    const user = userEvent.setup();
    await seedSession(threeMovements());
    await openLogger();

    await user.click(await screen.findByRole('button', { name: /make this a timed workout/i }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('AMRAP')).toBeInTheDocument();
    expect(within(sheet).getByText('EMOM')).toBeInTheDocument();
    expect(within(sheet).getByText('For time')).toBeInTheDocument();
  });
});

describe('ungrouping a timed block', () => {
  /**
   * John's report. Ungrouping detached the movements on screen but left every one of them
   * carrying the old blockId in local state, so both controls that act on loose sets stayed
   * hidden with nothing explaining why — and leaving the session was the only way back.
   */
  it('brings back the controls that act on loose sets', async () => {
    const user = userEvent.setup();
    await seedSession(
      [set('a', 'push-up', { blockId: 'b1' }), set('b', 'burpee', { blockId: 'b1' })],
      { blocks: [{ id: 'b1', style: 'forTime', capSec: 720 }] },
    );
    await openLogger();

    expect(screen.queryByRole('button', { name: /make this a timed workout/i })).toBeNull();

    await user.click(await screen.findByRole('button', { name: /ungroup block/i }));

    expect(
      await screen.findByRole('button', { name: /make this a timed workout/i }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /save as a workout/i })).toBeInTheDocument();
  });

  it('detaches the movements in the record, not only on screen', async () => {
    const user = userEvent.setup();
    await seedSession(
      [set('a', 'push-up', { blockId: 'b1' }), set('b', 'burpee', { blockId: 'b1' })],
      { blocks: [{ id: 'b1', style: 'forTime', capSec: 720 }] },
    );
    await openLogger();

    await user.click(await screen.findByRole('button', { name: /ungroup block/i }));
    await settle();

    const stored = await storedSession();
    expect(stored.blocks).toHaveLength(0);
    expect(stored.sets).toHaveLength(2);
    expect(stored.sets.every((s) => !s.blockId)).toBe(true);
  });
});

describe('a workout that is already finished', () => {
  const finished = () =>
    seedSession([set('a', 'push-up', { completed: true })], {
      endedAt: '2026-01-05T11:00:00.000Z',
      durationMin: 45,
      sessionRpe: 7,
    });

  it('opens as a record rather than a live screen', async () => {
    await finished();
    await openLogger();

    expect(await screen.findByText(/finished workout — reviewing/i)).toBeInTheDocument();
    // The tick is still shown, as a span — what must be gone is anything you can press.
    expect(screen.getByLabelText(/set 1 done/i).tagName).toBe('SPAN');
    expect(screen.queryByRole('button', { name: /set 1 done/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^\+ add exercise$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /discard session/i })).toBeNull();
  });

  it('shows the values without offering them for editing', async () => {
    await finished();
    await openLogger();

    const fields = await screen.findAllByLabelText(/reps/i);
    expect(fields.every((f) => (f as HTMLInputElement).readOnly)).toBe(true);
  });

  /**
   * The strip's Start button would set a clock running on a workout that ended weeks ago, and
   * elapsed time is derived from that timestamp — so it would climb from then on.
   */
  it('never shows the running clock, even once unlocked for editing', async () => {
    const user = userEvent.setup();
    await finished();
    const { container } = await openLogger();

    expect(container.querySelector('.pinned-timer')).toBeNull();

    await user.click(await screen.findByRole('button', { name: /edit/i }));

    expect(await screen.findByRole('button', { name: /^done$/i })).toBeInTheDocument();
    expect(container.querySelector('.pinned-timer')).toBeNull();
  });

  it('unlocks the controls when editing is chosen', async () => {
    const user = userEvent.setup();
    await finished();
    await openLogger();

    await user.click(await screen.findByRole('button', { name: /edit/i }));

    expect(await screen.findByRole('button', { name: /set 1 done/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^\+ add exercise$/i })).toBeInTheDocument();
  });

  /**
   * The write-up stays readable — knowing how a movement is done is useful long after the
   * session. What it must not carry is the swap, which would rewrite what you actually did.
   */
  it('still explains a movement, without offering to change it', async () => {
    const user = userEvent.setup();
    await finished();
    await openLogger();

    await user.click(await screen.findByRole('button', { name: /^push-up$/i }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).queryByRole('button', { name: /swap for another version/i })).toBeNull();
  });

  it('offers the swap again once editing is chosen', async () => {
    const user = userEvent.setup();
    await finished();
    await openLogger();

    await user.click(await screen.findByRole('button', { name: /edit/i }));
    await user.click(await screen.findByRole('button', { name: /^push-up$/i }));

    const sheet = await screen.findByRole('dialog');
    expect(
      within(sheet).getByRole('button', { name: /swap for another version/i }),
    ).toBeInTheDocument();
  });

  /**
   * A finished session is a record until it is deliberately unlocked, so nothing on the
   * review screen may reach the database.
   */
  it('cannot be changed while it is being reviewed', async () => {
    const before = await finished();
    await openLogger();
    await settle();

    const after = await storedSession();
    expect(after.sets).toEqual(before.sets);
    expect(after.endedAt).toBe(before.endedAt);
  });
});

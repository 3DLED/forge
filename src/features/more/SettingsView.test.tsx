/**
 * @vitest-environment jsdom
 *
 * Changing your week, and what it does to the plan.
 *
 * This is the most destructive thing a settings screen does in this app — it rewrites dates
 * across the calendar and takes sessions off it. So the tests care about two things above all:
 * that nothing is written before you agree to it, and that work you have already done is
 * never touched.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsView from './SettingsView';
import { db } from '../../db/db';
import { renderRoute, resetDatabase } from '../../test/harness';
import { addDays, todayKey, weekDays } from '../../domain/dates';
import type { Modality, PlannedSession, PlannedStatus } from '../../domain/types';

/** This week's Monday, Wednesday and Friday, whenever the suite happens to run. */
const thisWeek = () => weekDays(addDays(todayKey(), 14), 0);

async function seedPlanned(
  entries: { id: string; date: string; modalities?: Modality[]; status?: PlannedStatus }[],
): Promise<void> {
  await db.plannedSessions.bulkPut(
    entries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      status: entry.status ?? 'planned',
      prescription: {
        name: entry.id,
        modalities: entry.modalities ?? ['strength'],
        blocks: [],
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })) as PlannedSession[],
  );
}

const openSettings = () => renderRoute('/more/settings', '/more/settings', <SettingsView />);

/**
 * The availability row for one weekday.
 *
 * Matched on the heading element rather than the text alone: "Sunday" and "Monday" also
 * appear as the week-start chips further up the screen.
 */
async function availabilityRow(weekday: string): Promise<HTMLElement> {
  const headings = await screen.findAllByText(weekday);
  const heading = headings.find((el) => el.tagName === 'STRONG');
  if (!heading) throw new Error(`No availability row for ${weekday}`);
  return heading.closest('div')!.parentElement as HTMLElement;
}

type User = ReturnType<typeof userEvent.setup>;

/** Turns every kind of training off for one weekday, the way you would by hand. */
async function closeDay(user: User, weekday: string) {
  const row = await availabilityRow(weekday);
  for (const chip of [...row.querySelectorAll('.chip.on')]) {
    await user.click(chip);
  }
}

/** Leaves one weekday lifting only, so a run has nowhere to go. */
async function strengthOnly(user: User, weekday: string) {
  const row = await availabilityRow(weekday);
  for (const chip of [...row.querySelectorAll('.chip.on')]) {
    if (chip.textContent?.trim() !== 'Strength') await user.click(chip);
  }
}

const dateOf = async (id: string) => (await db.plannedSessions.get(id))!.date;

beforeEach(async () => {
  await resetDatabase();
});

describe('changing your weekly availability', () => {
  it('says nothing while the plan still fits', async () => {
    const [, mon] = thisWeek();
    await seedPlanned([{ id: 'a', date: mon }]);
    await openSettings();

    expect(screen.queryByRole('button', { name: /see what would move/i })).toBeNull();
  });

  it('raises a notice once a planned day stops working', async () => {
    const user = userEvent.setup();
    const [, , , wed] = thisWeek();
    await seedPlanned([{ id: 'a', date: wed }]);
    await openSettings();

    await closeDay(user, 'Wednesday');

    expect(
      await screen.findByRole('button', { name: /see what would move/i }),
    ).toBeInTheDocument();
  });

  /**
   * The whole reason this is a preview and not a toggle: closing a day must not rewrite the
   * calendar on its own.
   */
  it('changes nothing until the move is agreed to', async () => {
    const user = userEvent.setup();
    const [, , , wed] = thisWeek();
    await seedPlanned([{ id: 'a', date: wed }]);
    await openSettings();

    await closeDay(user, 'Wednesday');
    await screen.findByRole('button', { name: /see what would move/i });

    expect(await dateOf('a')).toBe(wed);
  });

  it('leaves the plan alone when the preview is declined', async () => {
    const user = userEvent.setup();
    const [, , , wed] = thisWeek();
    await seedPlanned([{ id: 'a', date: wed }]);
    await openSettings();

    await closeDay(user, 'Wednesday');
    await user.click(await screen.findByRole('button', { name: /see what would move/i }));
    await user.click(await screen.findByRole('button', { name: /leave the plan alone/i }));

    expect(await dateOf('a')).toBe(wed);
  });

  it('moves the session once the preview is accepted', async () => {
    const user = userEvent.setup();
    const [, , , wed, thu] = thisWeek();
    await seedPlanned([{ id: 'a', date: wed }]);
    await openSettings();

    await closeDay(user, 'Wednesday');
    await user.click(await screen.findByRole('button', { name: /see what would move/i }));

    const sheet = await screen.findByRole('dialog');
    await user.click(within(sheet).getByRole('button', { name: /move them/i }));

    await waitFor(async () => {
      expect(await dateOf('a')).toBe(thu);
    });
  });

  it('drops the notice once the plan fits again', async () => {
    const user = userEvent.setup();
    const [, , , wed] = thisWeek();
    await seedPlanned([{ id: 'a', date: wed }]);
    await openSettings();

    await closeDay(user, 'Wednesday');
    await user.click(await screen.findByRole('button', { name: /see what would move/i }));
    await user.click(await screen.findByRole('button', { name: /move them/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /see what would move/i })).toBeNull();
    });
  });

  /** Work you already did is the record of what happened, and is never rearranged. */
  it('never touches a session that was already completed', async () => {
    const user = userEvent.setup();
    const [, , , wed] = thisWeek();
    await seedPlanned([{ id: 'done', date: wed, status: 'completed' }]);
    await openSettings();

    await closeDay(user, 'Wednesday');

    expect(screen.queryByRole('button', { name: /see what would move/i })).toBeNull();
    expect(await dateOf('done')).toBe(wed);
  });

  it('names what it would drop when nothing in the week can take it', async () => {
    const user = userEvent.setup();
    const [, , , wed] = thisWeek();
    await seedPlanned([{ id: 'Long Run', date: wed, modalities: ['cardio'] }]);
    await openSettings();

    // Every other day lifts only, so a run has nowhere left to go.
    for (const day of ['Sunday', 'Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday']) {
      await strengthOnly(user, day);
    }
    await closeDay(user, 'Wednesday');

    await user.click(await screen.findByRole('button', { name: /see what would move/i }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(/coming off the calendar/i)).toBeInTheDocument();
    expect(within(sheet).getByText('Long Run')).toBeInTheDocument();
  });

  it('soft-deletes a dropped session rather than destroying it', async () => {
    const user = userEvent.setup();
    const [, , , wed] = thisWeek();
    await seedPlanned([{ id: 'Long Run', date: wed, modalities: ['cardio'] }]);
    await openSettings();

    for (const day of ['Sunday', 'Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday']) {
      await strengthOnly(user, day);
    }
    await closeDay(user, 'Wednesday');

    await user.click(await screen.findByRole('button', { name: /see what would move/i }));
    await user.click(await screen.findByRole('button', { name: /move them/i }));

    await waitFor(async () => {
      expect((await db.plannedSessions.get('Long Run'))?.deletedAt).toBeTruthy();
    });
  });
});

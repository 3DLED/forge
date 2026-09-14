/**
 * @vitest-environment jsdom
 *
 * The tour, inside the real app shell.
 *
 * Written for the bug a walkthrough found and no unit test could have: pressing Done navigated
 * home, and the tour's own effect then ran once more on its way out and sent the app back to
 * the last tab. Everything looked finished and the person was left on More. So the assertions
 * are about where the app ends up, checked after it has had time to change its mind.
 */

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../../App';
import { AppProvider } from '../../ui/AppProvider';
import { bootstrap } from '../../data/bootstrap';
import { profileRepo } from '../../data/repos';

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

const where = () => screen.getByTestId('where').textContent;
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

/** An install that has finished setup and not yet seen the tour. */
async function openTour() {
  await bootstrap();
  const [profile] = await profileRepo.all();
  await profileRepo.update(profile.id, { onboardedAt: new Date().toISOString(), touredAt: undefined });

  render(
    <AppProvider>
      <MemoryRouter initialEntries={['/today']}>
        <App />
        <Where />
      </MemoryRouter>
    </AppProvider>,
  );
  return screen.findByRole('dialog', { name: 'Today' }, { timeout: 30_000 });
}

async function tourStamped(): Promise<boolean> {
  const [profile] = await profileRepo.all();
  return Boolean(profile.touredAt);
}

describe('the tour', () => {
  it('opens each tab in turn, then leaves you on Today', async () => {
    await openTour();

    const expected = [
      ['Today', '/today'],
      ['Plan', '/plan'],
      ['History', '/history'],
      ['Progress', '/progress'],
      ['More', '/more'],
    ] as const;

    for (const [title, path] of expected) {
      const dialog = await screen.findByRole('dialog', { name: title });
      await waitFor(() => expect(where()).toBe(path));
      await userEvent.click(within(dialog).getByRole('button', { name: title === 'More' ? 'Done' : 'Next' }));
    }

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await settle();
    expect(where()).toBe('/today');
    expect(await tourStamped()).toBe(true);
  }, 60_000);

  it('skipping also leaves you on Today, and stays there', async () => {
    const dialog = await openTour();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));

    const second = await screen.findByRole('dialog', { name: 'Plan' });
    await waitFor(() => expect(where()).toBe('/plan'));
    await userEvent.click(within(second).getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await settle();
    expect(where()).toBe('/today');
    expect(await tourStamped()).toBe(true);
  }, 60_000);
});

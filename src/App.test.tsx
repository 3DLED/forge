/**
 * @vitest-environment jsdom
 *
 * That one broken screen is not a broken app.
 *
 * The boundary itself is tested next door. What this file defends is where it sits: inside
 * the main element and outside the tab bar, keyed on the path. Move it up one level to wrap
 * the whole shell and every test there still passes while this one fails — which is the
 * mistake worth catching, because the fallback would look identical and the way out would be
 * gone.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './ui/AppProvider';

/* Progress is the throwing one purely because it is a tab you can navigate away from. */
vi.mock('./features/progress/ProgressView', () => ({
  default: () => {
    throw new Error('barbell is not iterable');
  },
}));
vi.mock('./data/backup', () => ({
  exportBackup: async () => ({ outcome: 'saved' as const, filename: 'forge.json' }),
}));

let quiet: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => quiet.mockRestore());

async function openProgress() {
  const view = render(
    <AppProvider>
      <MemoryRouter initialEntries={['/progress']}>
        <App />
      </MemoryRouter>
    </AppProvider>,
  );
  await waitFor(() => expect(view.queryByText('Loading…')).toBeNull(), { timeout: 15000 });
  return view;
}

describe('a screen that throws', () => {
  it('leaves every other tab a tap away', async () => {
    await openProgress();

    expect(screen.getByRole('heading', { name: 'This screen hit a problem' })).toBeTruthy();
    for (const tab of ['Today', 'Plan', 'History', 'Progress', 'More']) {
      expect(screen.getByRole('link', { name: new RegExp(tab) })).toBeTruthy();
    }
  });

  /*
   * A boundary holds its error until something remounts it. Without the key on the path, the
   * crash from Progress would still be on screen after tapping Today — one bad screen would
   * eat the whole app after all, just more slowly.
   */
  it('clears the crash on the way to somewhere else', async () => {
    await openProgress();

    await userEvent.click(screen.getByRole('link', { name: /Today/ }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'This screen hit a problem' })).toBeNull(),
    );
  });
});

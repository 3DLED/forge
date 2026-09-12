/**
 * @vitest-environment jsdom
 *
 * What a crash leaves behind.
 *
 * The thing under test is not really the boundary, which is twenty lines of React's own API.
 * It is the promise the fallback makes: that a screen falling over leaves the rest of the app
 * reachable, that the export button is on the screen where somebody most wants it, and that
 * the error text is readable rather than swallowed. Those are the parts a later refactor can
 * quietly take away.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';
import CrashScreen from './CrashScreen';

const exportBackup = vi.fn(async () => ({ outcome: 'saved' as const, filename: 'forge.json' }));
vi.mock('../data/backup', () => ({ exportBackup: () => exportBackup() }));

function Boom({ throws }: { throws: boolean }): React.ReactElement {
  if (throws) throw new Error('kettlebell is not a function');
  return <p>the screen</p>;
}

/* React prints the caught error and its component stack. Expected here, and very loud. */
let quiet: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  exportBackup.mockClear();
  exportBackup.mockResolvedValue({ outcome: 'saved', filename: 'forge.json' });
});
afterEach(() => quiet.mockRestore());

const boundary = (throws: boolean) =>
  render(
    <ErrorBoundary
      fallback={({ error, reset }) => <CrashScreen error={error} scope="screen" reset={reset} />}
    >
      <Boom throws={throws} />
    </ErrorBoundary>,
  );

describe('a screen that throws', () => {
  it('renders its children untouched when nothing goes wrong', () => {
    boundary(false);
    expect(screen.getByText('the screen')).toBeTruthy();
  });

  it('shows the crash screen instead of unmounting the tree', () => {
    boundary(true);
    expect(screen.getByRole('heading', { name: 'This screen hit a problem' })).toBeTruthy();
  });

  /*
   * The blank page a crash used to leave says, as loudly as anything can, that everything is
   * gone. Saying otherwise is the first job of the screen that replaces it.
   */
  it('says the training data survived, because the blank page implied it had not', () => {
    boundary(true);
    expect(screen.getByText(/training data is safe/i)).toBeTruthy();
  });

  it('offers the backup, which is the one thing worth doing at that moment', async () => {
    boundary(true);
    await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
    expect(exportBackup).toHaveBeenCalled();
    expect(await screen.findByText(/forge\.json/)).toBeTruthy();
  });

  /*
   * The export reads the database, which may be exactly what broke. A crash screen that
   * crashes is worse than no crash screen at all.
   */
  it('survives the export itself failing', async () => {
    exportBackup.mockRejectedValue(new Error('database is gone too'));
    boundary(true);
    await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
    expect(await screen.findByText('Could not save the file.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'This screen hit a problem' })).toBeTruthy();
  });

  it('keeps the error text, folded away until asked for', async () => {
    boundary(true);
    expect(screen.queryByText(/kettlebell is not a function/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText(/kettlebell is not a function/)).toBeTruthy();
  });

  it('translates when it was handed a translator', () => {
    render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <CrashScreen
            error={error}
            scope="screen"
            reset={reset}
            t={(english) => (english === 'This screen hit a problem' ? 'Vaya' : english)}
          />
        )}
      >
        <Boom throws />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Vaya' })).toBeTruthy();
  });

  /*
   * An app-level crash took the navigation with it, so there is nowhere to go back to and
   * reloading is the only move. A screen-level one has a tab bar underneath it, and talking
   * somebody out of the whole app over one bad page would be the wrong advice.
   */
  it('offers a reload only when the crash took the navigation with it', () => {
    boundary(true);
    expect(screen.queryByRole('button', { name: 'Reload the app' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Try this screen again' })).toBeTruthy();

    render(
      <ErrorBoundary
        fallback={({ error, reset }) => <CrashScreen error={error} scope="app" reset={reset} />}
      >
        <Boom throws />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: 'Reload the app' })).toBeTruthy();
  });
});

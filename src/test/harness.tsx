/**
 * Renders a real screen against a real database.
 *
 * These are integration tests on purpose. The bugs this layer exists to catch — three of them
 * so far — all lived in the seam between a component's local state and what actually reached
 * IndexedDB, and every one of them looked correct on screen while being wrong in the record.
 * A shallow render with a mocked data layer would have reproduced none of them, because the
 * mock would have agreed with the component.
 *
 * So: real Dexie over an in-memory IndexedDB, the real AppProvider, the real router.
 */

import { render, waitFor, type RenderResult } from '@testing-library/react';
import { expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { db } from '../db/db';
import { AppProvider } from '../ui/AppProvider';
import type { LoggedSession, LoggedSet } from '../domain/types';
import type { StoredLoggedSession } from '../db/db';

/**
 * Clears what a test writes, and nothing that bootstrap seeded.
 *
 * The exercise library, the profile and the equipment profiles are deliberately left alone.
 * `bootstrap()` memoises in a module-level promise so it runs once per test file — wiping its
 * output between tests leaves AppProvider with no profile and no way to get one, and every
 * later render sits on "Loading…" until the timeout. Leaving the seed also makes the run
 * considerably faster, since seeding 237 exercises per test is not free.
 */
export async function resetDatabase(): Promise<void> {
  const written = [
    db.loggedSessions,
    db.plannedSessions,
    db.plans,
    db.calendarExceptions,
    db.bodyMetrics,
    db.changes,
  ];
  await Promise.all(written.map((table) => table.clear()));
}

export function set(id: string, exerciseSlug: string, over: Partial<LoggedSet> = {}): LoggedSet {
  return { id, exerciseSlug, setIndex: 0, values: { reps: 10 }, completed: false, ...over };
}

/** Writes a session straight to the table, standing in for one you had been logging. */
export async function seedSession(
  sets: LoggedSet[],
  over: Partial<LoggedSession> = {},
): Promise<StoredLoggedSession> {
  const session = {
    id: 'S1',
    date: new Date().toISOString().slice(0, 10),
    name: 'Test session',
    sets,
    blocks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
    exerciseSlugs: [...new Set(sets.map((s) => s.exerciseSlug))],
  } as StoredLoggedSession;

  await db.loggedSessions.put(session);
  return session;
}

export const storedSession = async (id = 'S1') => (await db.loggedSessions.get(id))!;

/**
 * Mounts a screen at a route and waits for the app to finish booting.
 *
 * AppProvider seeds the exercise library on first run and renders a loading state until it
 * lands, so every test would otherwise begin by asserting against "Loading…".
 */
export async function renderRoute(
  path: string,
  route: string,
  element: ReactElement,
): Promise<RenderResult> {
  const view = render(
    <AppProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );

  await waitFor(() => expect(view.queryByText('Loading…')).toBeNull(), { timeout: 15000 });
  return view;
}

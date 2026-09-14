/**
 * Who sees first-run setup.
 *
 * The rule that matters is the one that is easy to get backwards: an install that was already
 * training before setup existed must never be sent through it, and a genuinely new install that
 * closed the app halfway through setup must see it again. Each test re-imports bootstrap, since
 * it runs once per page load, against the same in-memory database.
 */

import { describe, expect, it, vi } from 'vitest';

async function launch() {
  vi.resetModules();
  const { bootstrap } = await import('./bootstrap');
  return bootstrap();
}

describe('first-run setup', () => {
  it('leaves a brand-new install to go through setup', async () => {
    const { profile, firstRun } = await launch();
    expect(firstRun).toBe(true);
    expect(profile.onboardedAt).toBeUndefined();
  }, 60_000);

  /* Closing the app mid-setup is not finishing it. */
  it('still offers setup on the next launch if it was never finished', async () => {
    const { profile, firstRun } = await launch();
    expect(firstRun).toBe(false);
    expect(profile.onboardedAt).toBeUndefined();
  }, 60_000);

  it('treats an install from before setup existed as already set up', async () => {
    vi.resetModules();
    const { db } = await import('../db/db');
    // What an existing install looks like to the first launch with this code in it.
    await db.meta.delete('onboardingSettled');

    const { profile } = await launch();
    expect(profile.onboardedAt).toBeTruthy();
    expect(profile.touredAt).toBeTruthy();

    const { profileRepo } = await import('./repos');
    const [stored] = await profileRepo.all();
    expect(stored.onboardedAt).toBeTruthy();
  }, 60_000);
});

/**
 * What jsdom does not provide, and the app quietly relies on.
 *
 * One setup file serves every test, but the domain tests run in plain Node where there is no
 * `window` to patch — so everything DOM-shaped is loaded and applied only when a DOM exists.
 * Importing the testing library unconditionally would fail the arithmetic tests on a global
 * they never touch.
 */

// Every environment gets an in-memory IndexedDB: jsdom does not ship one, and Node has none
// at all. Imported here rather than per-file so a test can never half-boot the database.
import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';

if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');

  // jsdom has no layout, so scrolling is not implemented at all. The rest panel's
  // jump-to-next calls this, and an unimplemented method is a TypeError, not a no-op.
  Element.prototype.scrollIntoView = vi.fn();

  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  afterEach(() => {
    cleanup();
  });
}

/*
 * Audio and vibration are deliberately left absent rather than stubbed.
 *
 * `beep.ts` checks for AudioContext and returns early without it, and `buzz` optional-chains
 * `navigator.vibrate` — so their absence exercises the same path a browser without audio
 * takes. Faking them would be testing the fake.
 */

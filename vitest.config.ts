import { defineConfig } from 'vitest/config';

/**
 * Kept apart from vite.config.ts on purpose.
 *
 * The app build carries the React plugin and the PWA service-worker generator, neither of
 * which a domain test has any use for — running tests through that config means every run
 * pays for a service worker nobody reads. Nothing here is UI: these cover the arithmetic and
 * the data layer, which is where the logic that can silently go wrong actually lives.
 */
export default defineConfig({
  test: {
    // Node by default; component tests opt into jsdom with a docblock, so a pure arithmetic
    // test does not pay for a DOM it never touches.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
    // Dexie tests share one fake IndexedDB per file, so files must not interleave.
    fileParallelism: false,
    // Booting the real AppProvider seeds the exercise library, which is not instant.
    testTimeout: 20000,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `--mode native` builds the bundle that goes inside the Capacitor shell.
 *
 * The only difference is the service worker, and it has to go. Android serves the webview
 * from https://localhost, so the worker registers happily and then precaches two megabytes of
 * assets that are already sitting on disk inside the APK — paying twice for the same files.
 * Worse, it keeps serving them: after an app update the on-disk assets change and a cached
 * worker carries on answering from the old ones, which is an app that silently never updates.
 *
 * Offline is not the reason it exists here either. A native build is already local; there is
 * no network for it to survive the loss of.
 */
export default defineConfig(({ mode }) => {
  const native = mode === 'native';

  return {
  // Relative base so the built app works from a GitHub Pages subpath
  // (username.github.io/repo-name/) without hardcoding the repo name.
  base: './',
  plugins: [
    react(),
    !native &&
      VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Forge — Training Tracker',
        short_name: 'Forge',
        description: 'Offline-first planner and log for running, lifting, and hybrid training.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The whole app is precached, so it opens with no network at all.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        /*
         * Except the movement animations, which are the one thing too big to hold.
         *
         * The app precaches because opening with no network is the premise; that works
         * because the app is under a megabyte. The licensed exercise set is around 120 KB
         * per animation, so a few hundred of them would put tens of megabytes into the
         * install before the first screen appeared. They are cached as they are viewed
         * instead — see the runtime rule below and `data/exerciseMedia`.
         *
         * Written as a glob rather than relying on the extension list above because the
         * source set is GIF today and PNG is already precached: converting the media to a
         * still image would otherwise silently pull the whole library into the install.
         */
        /*
         * And the Spanish translations, for the same reason one step removed.
         *
         * They are dynamically imported, which keeps them out of the main bundle but not out
         * of the precache manifest: Workbox precaches every emitted asset, so an install
         * reading English was downloading half a megabyte of Spanish prose it would never
         * open, and that number grows with every movement translated.
         *
         * Matched on the emitted chunk names, which carry a content hash, so the glob has to
         * be a prefix rather than the exact filename.
         */
        globIgnores: [
          '**/exercise-media/**',
          '**/assets/prose.es-*.js',
          '**/assets/names.es-*.js',
        ],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            /*
             * Fetched the first time the app is set to Spanish, then kept.
             *
             * Without this rule the chunks would be excluded from the install and never
             * cached at all, which would trade a download every English user did not want
             * for a Spanish app that stops working on a train.
             */
            urlPattern: /\/assets\/(?:prose|names)\.es-[^/]*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'translations',
              // A rebuild changes the hash, so an old one is only ever dead weight.
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/exercise-media\/.*\.(?:gif|webp|png)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-media',
              // They never change: a new drawing would arrive under a new id.
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      /*
       * Never watch the purchased ExerciseDB set.
       *
       * It is half a gigabyte of GIFs sitting inside the project folder, and the dev server
       * died on it: the watcher opened the combined JSON while OneDrive had it locked and
       * took the whole process down with an EBUSY. Nothing in there is source — the importer
       * reads it on demand and copies what it needs into `public/exercise-media` — so there
       * is nothing to gain by watching it and a crash to lose.
       */
      ignored: ['**/ExerciseDBstarter/**', '**/exercise-media/**'],
    },
  },
  };
});

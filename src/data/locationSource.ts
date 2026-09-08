/**
 * Where fixes come from.
 *
 * One interface, two implementations, and only one of them exists yet. The browser gives
 * positions while the app is in front of you, which is enough to build and judge everything
 * about pace alerts except the part that happens with the screen off. The other implementation
 * is `@capacitor-community/background-geolocation`, added when there is an Android build to
 * run it in.
 *
 * The shape below is deliberately the plugin's rather than the browser's: a watcher started
 * with options, a callback taking `(location, error)`, and a handle to stop it. The browser
 * version is bent to fit that, not the other way round, so the swap is a new file rather than
 * a change to everything that consumes it.
 *
 * The one field that matters is `speed`. The receiver computes it from Doppler shift on the
 * carrier rather than by differencing positions, which makes it a far steadier number than
 * anything derivable from coordinates — see `domain/pace`. Both sources report it, both
 * sometimes cannot, and the pace engine handles the gap.
 */

import type { Fix } from '../domain/pace';

export interface WatchOptions {
  /**
   * Shown in the Android notification that keeps the process alive.
   *
   * Required by the platform rather than by us: a foreground service has to say what it is
   * doing, which is the deal that gets you location with the screen off.
   */
  backgroundTitle?: string;
  backgroundMessage?: string;
  /** Metres of movement before another fix is delivered. Zero means every one. */
  distanceFilter?: number;
}

export interface LocationWatch {
  stop: () => Promise<void>;
}

export interface LocationSource {
  /** Whether this device can do it at all, before anything is promised on screen. */
  available: () => boolean;
  watch: (
    options: WatchOptions,
    onFix: (fix: Fix | null, error: Error | null) => void,
  ) => Promise<LocationWatch>;
}

/**
 * The browser's own geolocation, over HTTPS or localhost.
 *
 * Real GPS, real speed, real accuracy — everything except surviving the screen going off,
 * which is exactly the boundary between what can be built now and what needs the native shell.
 */
export const browserLocation: LocationSource = {
  available: () => typeof navigator !== 'undefined' && 'geolocation' in navigator,

  async watch(options, onFix) {
    if (!browserLocation.available()) {
      throw new Error('This browser cannot report your location.');
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { coords } = position;
        onFix(
          {
            at: position.timestamp,
            lat: coords.latitude,
            lon: coords.longitude,
            accuracy: coords.accuracy ?? null,
            // Doppler-derived where the receiver managed it, null where it did not.
            speed: coords.speed,
          },
          null,
        );
      },
      (error) => onFix(null, new Error(describe(error))),
      {
        // A run is exactly the case the low-power mode is wrong for.
        enableHighAccuracy: true,
        // Never hand back a cached fix: a stale position looks like standing still.
        maximumAge: 0,
        timeout: 15_000,
      },
    );

    void options;
    return { stop: async () => navigator.geolocation.clearWatch(id) };
  },
};

/** The browser's error codes, in words someone could act on. */
function describe(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission was refused. Allow it for this site and try again.';
    case error.POSITION_UNAVAILABLE:
      return 'No position available — this often means no view of the sky yet.';
    case error.TIMEOUT:
      return 'Took too long to get a fix.';
    default:
      return error.message || 'Location failed.';
  }
}

/**
 * The native receiver, via `@capacitor-community/background-geolocation`.
 *
 * The whole reason `LocationSource` is shaped the way it is. The plugin's own API is
 * `addWatcher(options, callback) -> id` and `removeWatcher({ id })`, which is what the
 * interface above was drawn around — so this is a translation, not an adaptation, and nothing
 * that consumes a location source had to learn a second shape.
 *
 * What it buys over the browser is the only thing the browser cannot do: fixes with the screen
 * off and the app in the background. On Android that requires a foreground service, which
 * requires a notification, which is why `backgroundMessage` is not optional in practice —
 * omitting it is how you ask the plugin for foreground-only updates.
 *
 * Registered through `registerPlugin` rather than imported from the package, so a web build
 * pulls in the type definitions and no code. The plugin has no browser implementation; on the
 * web `browserLocation` is used instead and this is never constructed.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export const nativeLocation: LocationSource = {
  available: () => Capacitor.isNativePlatform(),

  async watch(options, onFix) {
    const id = await BackgroundGeolocation.addWatcher(
      {
        /*
         * Naming the notification is what asks for background updates at all. Without these
         * two the plugin only promises fixes while the app is in front of you, which is the
         * one thing the browser could already do.
         */
        backgroundTitle: options.backgroundTitle ?? 'Forge',
        backgroundMessage: options.backgroundMessage ?? 'Tracking your run',
        requestPermissions: true,
        // Never hand back a fix from before the watcher started: a stale position looks like
        // standing still, and the pace engine would believe it.
        stale: false,
        // Every fix. The pace engine does its own smoothing over a time window, and a
        // distance filter would thin the very samples that smoothing is made of.
        distanceFilter: options.distanceFilter ?? 0,
      },
      (position, error) => {
        if (error) {
          onFix(null, new Error(describeNative(error)));
          return;
        }
        if (!position) return;

        onFix(
          {
            // `time` is nullable in the plugin's own types, and a fix with no timestamp
            // cannot be placed in the window — treating it as "now" is the honest reading.
            at: position.time ?? Date.now(),
            lat: position.latitude,
            lon: position.longitude,
            accuracy: position.accuracy,
            speed: position.speed,
          },
          null,
        );
      },
    );

    return { stop: async () => BackgroundGeolocation.removeWatcher({ id }) };
  },
};

/** The plugin's error codes, in words someone could act on. */
function describeNative(error: { code?: string; message?: string }): string {
  if (error.code === 'NOT_AUTHORIZED') {
    return 'Location permission was refused. Allow it in Settings and start the run again.';
  }
  return error.message || 'Location failed.';
}

/**
 * The right receiver for wherever this is running.
 *
 * A function rather than a constant because `isNativePlatform` is answered by the Capacitor
 * runtime, which is not there at module-evaluation time in every environment — a test
 * importing this file should not have to care.
 */
export function locationSource(): LocationSource {
  return Capacitor.isNativePlatform() ? nativeLocation : browserLocation;
}

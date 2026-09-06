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

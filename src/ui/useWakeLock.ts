/**
 * Keeps the screen on while something is being done with the phone in front of you.
 *
 * Lifted out of the block timer, which is where it started and was too narrow a home. A timed
 * piece is a couple of minutes of an hour-long session; the rest of that hour is straight sets
 * with the phone propped against a wall, and the screen going dark between every set is the
 * thing you notice. Anyone training on bells and bodyweight — most of this app's reason to
 * exist — almost never runs a block timer at all.
 *
 * Only while the page is actually visible, which the browser enforces rather than this code:
 * the lock is dropped the moment the app is backgrounded, so putting the phone in a pocket
 * releases it and nothing is holding a screen awake in the dark. That is also why it has to be
 * retaken on the way back, and why the visibility listener is not optional.
 *
 * Unsupported browsers and a refused request both do without. There is nothing to say about
 * either: the screen dims, which is what would have happened anyway.
 */

import { useEffect } from 'react';

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // Denied or unsupported — not worth surfacing.
      }
    };

    void request();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !sentinel) void request();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
      sentinel = null;
    };
  }, [active]);
}

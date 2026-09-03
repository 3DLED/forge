/**
 * Locking the page behind a sheet, reference counted.
 *
 * Sheets stack. A picker opens the movement editor on top of itself; the block sheet opens a
 * saved-workout list. The obvious implementation — remember `body.overflow`, set `hidden`,
 * put the remembered value back on unmount — breaks the moment two are open at once: the
 * inner sheet remembers the `hidden` the outer one just set, and faithfully restores it on
 * the way out. The page then never scrolls again, on any screen, until the app is restarted.
 *
 * Counting rather than remembering means the lock lifts when the last sheet closes, and the
 * value restored is the one that was there before any sheet opened.
 */

let depth = 0;
let previous = '';

/** Locks the page. Call the returned function to release this holder's claim. */
export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (depth === 0) {
    previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  depth += 1;

  let released = false;
  return () => {
    /*
     * Guarded because React runs effect cleanups twice under StrictMode, and a second release
     * from the same holder would drop the count below what is actually open — unlocking the
     * page while a sheet is still on screen.
     */
    if (released) return;
    released = true;

    depth -= 1;
    if (depth === 0) document.body.style.overflow = previous;
  };
}

/** Test seam: forget any held locks. Not used by the app. */
export function resetScrollLock(): void {
  depth = 0;
  previous = '';
  if (typeof document !== 'undefined') document.body.style.overflow = '';
}

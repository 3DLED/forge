/**
 * Handing a file to the person using the app.
 *
 * A browser does this with an invisible anchor carrying a `download` attribute, and for three
 * years that was the whole of it. Inside the iOS shell it is not merely different, it is
 * nothing: WKWebView has no download handling for a blob URL and Capacitor adds none, so the
 * click lands on the floor. Silently — which is how the export button spent its first release
 * reporting a filename it had not written. That is the worst way for this particular feature
 * to fail, because the file it does not save is the only copy of your training history that
 * would survive losing the phone.
 *
 * Natively the same job takes two steps: write the bytes somewhere the system can reach, then
 * offer them to the share sheet, which is where "Save to Files", AirDrop and mail all live.
 *
 * These plugins are imported normally rather than through `registerPlugin` — unlike the
 * geolocation and speech ones, which have no browser implementation at all and would break a
 * web build on import. Here the web implementations exist; they are simply not what the web
 * path wants.
 */

import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * What became of a save.
 *
 * Three outcomes and not a boolean, because dismissing a share sheet is not a failure and
 * must not be reported as one — nor as a success, which is the bug this file exists to end.
 */
export type SaveOutcome = 'saved' | 'cancelled' | 'failed';

export interface SaveResult {
  outcome: SaveOutcome;
  filename: string;
  /** Present on a failure, in words worth putting on screen. */
  reason?: string;
}

/**
 * A browser genuinely starts the download, and then tells us nothing about it ever again.
 * Reporting `saved` is the honest reading of what we know.
 */
function browserSave(filename: string, text: string, mimeType: string): SaveResult {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download on some mobile browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { outcome: 'saved', filename };
}

/**
 * Dismissing the sheet arrives as a rejection, the same shape an actual failure does.
 *
 * Only the wording separates them, which is not something to be pleased about — but a
 * cancellation reported as an error is a message that says something went wrong every time
 * somebody changes their mind, and people stop reading messages like that.
 */
function wasCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
}

async function nativeSave(filename: string, text: string): Promise<SaveResult> {
  try {
    /*
     * Cache rather than Documents. The file is a courier, not a possession: once it has been
     * handed to the share sheet its job is done, and the system is free to reclaim it whenever
     * it needs the room. Leaving copies of every export in Documents would quietly accumulate
     * the whole training history, several times over, where nothing ever deletes it.
     */
    const written = await Filesystem.writeFile({
      path: filename,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    await Share.share({ title: filename, files: [written.uri] });
    return { outcome: 'saved', filename };
  } catch (error) {
    if (wasCancelled(error)) return { outcome: 'cancelled', filename };
    return {
      outcome: 'failed',
      filename,
      reason: error instanceof Error ? error.message : 'Could not save the file.',
    };
  }
}

/** Saves `text` as `filename`, by whichever route this platform actually has. */
export function saveTextFile(
  filename: string,
  text: string,
  mimeType = 'application/json',
): Promise<SaveResult> {
  return Capacitor.isNativePlatform()
    ? nativeSave(filename, text)
    : Promise.resolve(browserSave(filename, text, mimeType));
}

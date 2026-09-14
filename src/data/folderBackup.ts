/**
 * The automatic backup's bridge to the folder somebody chose in the Files app.
 *
 * The native half is the local plugin in `plugins/folder-backup`. It keeps a bookmark to the
 * folder, so iCloud Drive, Google Drive and OneDrive all work the same way: whichever the
 * folder belongs to, Forge writes one file into it and the provider does the syncing. No
 * account, no sign-in, and no network code in this app.
 *
 * iOS only. Registered through `registerPlugin` rather than imported, like the geolocation
 * bridge, because there is no web implementation to import; everywhere else every call here
 * reports itself unavailable and the screen says so.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

interface FolderBackupPlugin {
  pickFolder(): Promise<{ cancelled: boolean; folder?: string }>;
  status(): Promise<{ folder: string | null; error?: string }>;
  write(options: { filename: string; data: string }): Promise<{ folder: string; bytes: number }>;
  forget(): Promise<void>;
}

const FolderBackup = registerPlugin<FolderBackupPlugin>('FolderBackup');

/**
 * One name, always, so each save replaces the last instead of piling up.
 *
 * The manual export's name without its date: `forge-backup-2026-09-14.json` is a snapshot of a
 * day, and this is the copy that is always current. A dated file per save would fill somebody's
 * cloud drive with hundreds of copies of the same history.
 */
export const AUTO_BACKUP_FILENAME = 'forge-backup.json';

export function folderBackupSupported(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/** Opens the Files picker. Null when the person backed out, which is not an error. */
export async function chooseBackupFolder(): Promise<{ folder: string } | null> {
  if (!folderBackupSupported()) return null;
  const picked = await FolderBackup.pickFolder();
  return picked.cancelled || !picked.folder ? null : { folder: picked.folder };
}

/** The chosen folder's name, or null when none is set or it can no longer be found. */
export async function backupFolder(): Promise<string | null> {
  if (!folderBackupSupported()) return null;
  try {
    return (await FolderBackup.status()).folder;
  } catch {
    return null;
  }
}

export type FolderWrite =
  | { ok: true; folder: string; bytes: number }
  | { ok: false; reason: string; code?: string };

/** Writes the backup over the previous one. Never throws: the app keeps working either way. */
export async function writeFolderBackup(text: string): Promise<FolderWrite> {
  if (!folderBackupSupported()) return { ok: false, reason: 'Not available here.', code: 'UNSUPPORTED' };
  try {
    const written = await FolderBackup.write({ filename: AUTO_BACKUP_FILENAME, data: text });
    return { ok: true, folder: written.folder, bytes: written.bytes };
  } catch (error) {
    const failure = error as { message?: string; code?: string };
    return { ok: false, reason: failure.message ?? 'Could not write the backup.', code: failure.code };
  }
}

export async function forgetBackupFolder(): Promise<void> {
  if (!folderBackupSupported()) return;
  await FolderBackup.forget();
}

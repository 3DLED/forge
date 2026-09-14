/**
 * Keeps the backup in the chosen folder current, without anybody pressing anything.
 *
 * Driven by the change log rather than by a timer. Every write through a repository records a
 * row in `changes`, so the newest sequence number is a precise answer to "has anything
 * happened since the last copy?" A timer would either save an unchanged history over and over
 * into somebody's cloud drive, or miss the session they logged a minute before losing the
 * phone.
 *
 * Two moments to save. After changes have settled, because logging a workout is dozens of
 * writes a second apart and one copy at the end is the one worth having. And on launch, when
 * the log has moved past the last copy, which catches whatever was still settling when the app
 * was last closed. Leaving the app is a third, best-effort chance: iOS may suspend the page
 * before a two-megabyte write finishes, so it is never the only one.
 *
 * Writes that bypass the repositories, such as the heart rate backfill, do not move the log and
 * so wait for the next ordinary change. That is a delay of one workout, not a lost one.
 */

import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getMeta, setMeta } from '../db/repo';
import { buildBackup } from '../data/backup';
import { backupFolder, folderBackupSupported, writeFolderBackup, type FolderWrite } from '../data/folderBackup';

/** When the last automatic copy landed. Shown on the More screen. */
export const AUTO_BACKUP_AT = 'autoBackupAt';
/** Why the last attempt failed, cleared by the next one that works. */
export const AUTO_BACKUP_ERROR = 'autoBackupError';
/** The change-log position the last copy included. */
const AUTO_BACKUP_SEQ = 'autoBackupSeq';

/** Long enough for a set of rows logged in a burst to count as one change. */
const SETTLE_MS = 20_000;

let writing: Promise<FolderWrite> | null = null;

/**
 * Writes the whole backup over the previous copy, one write at a time.
 *
 * A second call while one is running shares its result instead of starting another; two
 * overlapping writes into a sync provider's folder is how a file ends up half one and half
 * the other.
 */
export function backUpNow(): Promise<FolderWrite> {
  if (writing) return writing;
  writing = (async () => {
    const latest = await db.changes.orderBy('seq').last();
    const text = JSON.stringify(await buildBackup(), null, 2);
    const result = await writeFolderBackup(text);
    if (result.ok) {
      await setMeta(AUTO_BACKUP_AT, new Date().toISOString());
      await setMeta(AUTO_BACKUP_ERROR, null);
      await setMeta(AUTO_BACKUP_SEQ, latest?.seq ?? 0);
    } else if (result.code !== 'NO_FOLDER' && result.code !== 'UNSUPPORTED') {
      await setMeta(AUTO_BACKUP_ERROR, result.reason);
    }
    return result;
  })().finally(() => {
    writing = null;
  });
  return writing;
}

/** Saves if a folder is chosen and something has changed since the last copy. */
export async function backUpIfBehind(): Promise<void> {
  if (!folderBackupSupported()) return;
  const [latest, saved, folder] = await Promise.all([
    db.changes.orderBy('seq').last(),
    getMeta<number>(AUTO_BACKUP_SEQ, -1),
    backupFolder(),
  ]);
  if (!folder || latest?.seq == null || latest.seq <= saved) return;
  await backUpNow();
}

export function useAutoBackup(): void {
  const newest = useLiveQuery(() => db.changes.orderBy('seq').last(), []);
  const seq = newest?.seq;

  useEffect(() => {
    if (!folderBackupSupported() || seq == null) return;
    const timer = setTimeout(() => void backUpIfBehind(), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [seq]);

  const listening = useRef(false);
  useEffect(() => {
    if (!folderBackupSupported() || listening.current) return;
    listening.current = true;
    const onLeave = () => {
      if (document.visibilityState === 'hidden') void backUpIfBehind();
    };
    document.addEventListener('visibilitychange', onLeave);
    return () => {
      listening.current = false;
      document.removeEventListener('visibilitychange', onLeave);
    };
  }, []);
}

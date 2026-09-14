/**
 * When the automatic backup writes, against a stubbed folder and a real database.
 *
 * The plugin itself cannot run here, so what is defended is the decision around it: write when
 * the history has moved on since the last copy, and only then. Getting that wrong has no visible
 * symptom at all. Too eager and it quietly pushes the same two megabytes into somebody's cloud
 * drive every launch; too lazy and the copy they reach for after losing the phone is a month old.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderWrite } from '../data/folderBackup';

const supported = vi.fn(() => true);
const folder = vi.fn(async (): Promise<string | null> => 'Forge');
const write = vi.fn(async (_text: string): Promise<FolderWrite> => ({ ok: true, folder: 'Forge', bytes: 10 }));

vi.mock('../data/folderBackup', () => ({
  folderBackupSupported: () => supported(),
  backupFolder: () => folder(),
  writeFolderBackup: (text: string) => write(text),
}));

const { AUTO_BACKUP_AT, AUTO_BACKUP_ERROR, backUpIfBehind, backUpNow } = await import('./useAutoBackup');
const { db } = await import('../db/db');
const { getMeta } = await import('../db/repo');

/** One repository write, as far as the change log is concerned. */
async function somethingChanged(): Promise<void> {
  await db.changes.add({ table: 'loggedSessions', recordId: 'x', op: 'put', at: new Date().toISOString() });
}

beforeEach(async () => {
  await db.changes.clear();
  await db.meta.bulkDelete([AUTO_BACKUP_AT, AUTO_BACKUP_ERROR, 'autoBackupSeq']);
  supported.mockReturnValue(true);
  folder.mockResolvedValue('Forge');
  write.mockReset();
  write.mockResolvedValue({ ok: true, folder: 'Forge', bytes: 10 });
});

describe('deciding to write', () => {
  it('writes once the history has changed since the last copy', async () => {
    await somethingChanged();
    await backUpIfBehind();

    expect(write).toHaveBeenCalledTimes(1);
    expect(await getMeta(AUTO_BACKUP_AT, null)).not.toBeNull();
  });

  /* Every launch runs this check. An unchanged history must not be pushed again. */
  it('does nothing when nothing has changed since the last copy', async () => {
    await somethingChanged();
    await backUpIfBehind();
    write.mockClear();

    await backUpIfBehind();
    expect(write).not.toHaveBeenCalled();
  });

  it('catches up with a change made after the last copy', async () => {
    await somethingChanged();
    await backUpIfBehind();
    write.mockClear();

    await somethingChanged();
    await backUpIfBehind();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('stays quiet until a folder has been chosen', async () => {
    folder.mockResolvedValue(null);
    await somethingChanged();
    await backUpIfBehind();
    expect(write).not.toHaveBeenCalled();
  });

  it('does nothing at all away from an iPhone', async () => {
    supported.mockReturnValue(false);
    await somethingChanged();
    await backUpIfBehind();
    expect(write).not.toHaveBeenCalled();
  });

  /* A failed copy has to try again next time, not be counted as caught up. */
  it('tries again after a write that failed', async () => {
    write.mockResolvedValueOnce({ ok: false, reason: 'Disk full', code: 'WRITE_FAILED' });
    await somethingChanged();
    await backUpIfBehind();

    await backUpIfBehind();
    expect(write).toHaveBeenCalledTimes(2);
  });
});

describe('what it records', () => {
  it('keeps why a write failed, and clears it after one that works', async () => {
    write.mockResolvedValueOnce({ ok: false, reason: 'Disk full', code: 'WRITE_FAILED' });
    await backUpNow();
    expect(await getMeta(AUTO_BACKUP_ERROR, null)).toBe('Disk full');
    expect(await getMeta(AUTO_BACKUP_AT, null)).toBeNull();

    await backUpNow();
    expect(await getMeta(AUTO_BACKUP_ERROR, null)).toBeNull();
    expect(await getMeta(AUTO_BACKUP_AT, null)).not.toBeNull();
  });

  /* Not having chosen a folder is a state, not a fault, and must not show as a warning. */
  it('does not treat a missing folder as an error', async () => {
    write.mockResolvedValueOnce({ ok: false, reason: 'No backup folder has been chosen.', code: 'NO_FOLDER' });
    await backUpNow();
    expect(await getMeta(AUTO_BACKUP_ERROR, null)).toBeNull();
  });

  it('writes the whole backup, readable as the file restore expects', async () => {
    await backUpNow();
    const text = write.mock.calls[0][0];
    const parsed = JSON.parse(text) as { format: number; tables: Record<string, unknown[]> };
    expect(parsed.format).toBe(1);
    expect(Object.keys(parsed.tables)).toContain('loggedSessions');
  });
});

describe('one write at a time', () => {
  /* Two overlapping writes into a sync provider's folder is how a file ends up half of each. */
  it('shares a write already in progress instead of starting another', async () => {
    let finish: (value: FolderWrite) => void = () => {};
    write.mockImplementationOnce(() => new Promise<FolderWrite>((resolve) => { finish = resolve; }));

    const first = backUpNow();
    const second = backUpNow();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    finish({ ok: true, folder: 'Forge', bytes: 10 });

    expect(await first).toEqual(await second);
    expect(write).toHaveBeenCalledTimes(1);
  });
});

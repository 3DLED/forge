/**
 * Export and import.
 *
 * With no server, this file *is* the safety net: it is how training data survives a cleared
 * browser, and how it moves to a new phone. So the format is boring on purpose — plain
 * JSON, one array per table, no compression, readable in any text editor a decade from now.
 */

import { DATA_TABLES, db, type DataTableName } from '../db/db';
import { getMeta, setMeta } from '../db/repo';

export const BACKUP_FORMAT = 1;

export interface BackupFile {
  format: number;
  app: string;
  exportedAt: string;
  seedVersion: number;
  tables: Record<string, unknown[]>;
}

export async function buildBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const name of DATA_TABLES) {
    tables[name] = await db.table(name).toArray();
  }

  return {
    format: BACKUP_FORMAT,
    app: 'forge',
    exportedAt: new Date().toISOString(),
    seedVersion: await getMeta<number>('seedVersion', 0),
    tables,
  };
}

export async function downloadBackup(): Promise<string> {
  const backup = await buildBackup();
  const filename = `forge-backup-${backup.exportedAt.slice(0, 10)}.json`;

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download on some mobile browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return filename;
}

export interface ImportResult {
  imported: Record<string, number>;
  mode: 'merge' | 'replace';
}

function isBackup(value: unknown): value is BackupFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tables' in value &&
    typeof (value as BackupFile).tables === 'object'
  );
}

/**
 * `merge` keeps whatever is already here and lets the newer copy of each record win, which
 * is the right behaviour when restoring onto a device that has been used since the export.
 * `replace` wipes first — for moving to a new phone, where anything present is just seed data.
 */
export async function restoreBackup(
  json: string,
  mode: 'merge' | 'replace' = 'merge',
): Promise<ImportResult> {
  const parsed: unknown = JSON.parse(json);
  if (!isBackup(parsed)) throw new Error('That does not look like a Forge backup file.');
  if (parsed.format > BACKUP_FORMAT) {
    throw new Error('That backup was made by a newer version of the app.');
  }

  const imported: Record<string, number> = {};

  for (const name of DATA_TABLES) {
    const rows = parsed.tables[name];
    if (!Array.isArray(rows)) continue;

    const table = db.table(name as DataTableName);
    if (mode === 'replace') await table.clear();

    if (mode === 'merge') {
      const existing = new Map(
        (await table.toArray()).map((row: { id: string; updatedAt?: string }) => [row.id, row]),
      );
      const winners = rows.filter((row) => {
        const incoming = row as { id: string; updatedAt?: string };
        const current = existing.get(incoming.id);
        return !current || (incoming.updatedAt ?? '') >= (current.updatedAt ?? '');
      });
      await table.bulkPut(winners);
      imported[name] = winners.length;
    } else {
      await table.bulkPut(rows);
      imported[name] = rows.length;
    }
  }

  if (typeof parsed.seedVersion === 'number') {
    await setMeta('seedVersion', parsed.seedVersion);
  }

  return { imported, mode };
}

/** Wipes everything. Used by "start over", and only behind a typed confirmation. */
export async function wipeAllData(): Promise<void> {
  for (const name of DATA_TABLES) await db.table(name).clear();
  await db.changes.clear();
  await db.meta.clear();
}

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
 * How a row is recognised across installs.
 *
 * Ids are ulids minted when a row is created, and bootstrap creates the movement library, the
 * equipment profiles and a user profile afresh on every install. So the same logical row has
 * a different id on each device, and a merge keyed on id cannot tell that the "Full gym" it
 * is importing and the "Full gym" already sitting here are the same profile. It adds both.
 *
 * Done once, that is a duplicate of everything seeded. Done on every reinstall — which is the
 * actual workflow for testing a PWA, since there is no other way to pick up a new build — it
 * is a duplicate per reinstall, forever.
 *
 * Only the seeded tables need this. Everything else exists solely in the backup.
 */
const NATURAL_KEY: Partial<Record<DataTableName, (row: Record<string, unknown>) => string | undefined>> = {
  exercises: (row) => row.slug as string | undefined,
  equipmentProfiles: (row) => row.name as string | undefined,
  // There is only ever one, and everything in the app reads profiles[0].
  profiles: () => 'the-one-profile',
};

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
      const here = (await table.toArray()) as { id: string; updatedAt?: string }[];

      /*
       * Rows this install seeded that the backup is about to supersede.
       *
       * Identified narrowly: the backup does not contain this row by id, but it does contain
       * something with the same natural identity. That is a stand-in created by bootstrap,
       * and keeping it alongside the incoming row is what produces the duplicates. A row the
       * backup has never heard of at all — a profile made on this phone since the export —
       * matches no incoming key and stays exactly where it is.
       */
      const naturalKey = NATURAL_KEY[name as DataTableName];
      if (naturalKey) {
        const incomingIds = new Set(rows.map((row) => (row as { id: string }).id));
        const incomingKeys = new Set(
          rows.map((row) => naturalKey(row as Record<string, unknown>)).filter(Boolean),
        );
        const standIns = (here as { id: string; createdAt?: string; updatedAt?: string }[]).filter(
          (row) =>
            !incomingIds.has(row.id) &&
            incomingKeys.has(naturalKey(row as unknown as Record<string, unknown>)) &&
            /*
             * Untouched since it was written. `create` stamps both timestamps together, so
             * this is exactly "seeded and never edited" — which is what a stand-in is. A
             * profile you set up on this device before restoring is not one, even if it
             * shares a name with something in the backup, and losing it would be a worse
             * bug than the duplicate this is here to prevent. Anything that slips past is
             * collapsed by the repair on next launch, which keeps the richer copy.
             */
            row.createdAt === row.updatedAt,
        );
        if (standIns.length > 0) await table.bulkDelete(standIns.map((row) => row.id));
      }

      const existing = new Map(here.map((row) => [row.id, row]));
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

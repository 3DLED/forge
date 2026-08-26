/**
 * The one place that writes to the database.
 *
 * Every mutation goes through here so that three things are guaranteed everywhere and
 * cannot be forgotten at a call site:
 *   1. `id`, `createdAt`, `updatedAt` are stamped correctly;
 *   2. deletes are soft, and every read filters tombstones out;
 *   3. the change log gets an entry, in the same transaction as the write.
 *
 * Feature code should use the typed repositories in `src/data/`, not Dexie directly.
 */

import type { Table } from 'dexie';
import { db, MAX_CHANGE_LOG } from './db';
import type { Entity, Id, Instant } from '../domain/types';
import { ulid } from '../domain/ids';

/** What a caller supplies when creating a record: the domain fields, nothing bookkeeping. */
export type Draft<T extends Entity> = Omit<T, keyof Entity> & { id?: Id };

/** What a caller supplies when updating: any subset of domain fields. */
export type Patch<T extends Entity> = Partial<Omit<T, keyof Entity>>;

function now(): Instant {
  return new Date().toISOString();
}

function isLive<T extends Entity>(record: T): boolean {
  return !record.deletedAt;
}

async function logChange(table: string, recordId: Id, op: 'put' | 'delete'): Promise<void> {
  await db.changes.add({ table, recordId, op, at: now() });

  // Keep the outbox bounded while there is no sync consuming it.
  const count = await db.changes.count();
  if (count > MAX_CHANGE_LOG) {
    const excess = count - MAX_CHANGE_LOG;
    const stale = await db.changes.orderBy('seq').limit(excess).primaryKeys();
    await db.changes.bulkDelete(stale);
  }
}

export interface Repo<T extends Entity> {
  get(id: Id): Promise<T | undefined>;
  all(): Promise<T[]>;
  create(draft: Draft<T>): Promise<T>;
  update(id: Id, patch: Patch<T>): Promise<T>;
  /** Insert or replace a whole record, preserving `createdAt` when it already exists. */
  put(record: T): Promise<T>;
  bulkPut(records: T[]): Promise<void>;
  /** Soft delete. The row stays, marked with `deletedAt`. */
  remove(id: Id): Promise<void>;
  /** Undo a soft delete. */
  restore(id: Id): Promise<void>;
  count(): Promise<number>;
  table: Table<T, Id>;
}

/**
 * `derive` runs on every write and can add storage-only fields — the derived
 * `exerciseSlugs` index on logged sessions is the one user of it today.
 */
export function createRepo<T extends Entity>(
  table: Table<T, Id>,
  tableName: string,
  derive?: (record: T) => T,
): Repo<T> {
  const prepare = (record: T): T => (derive ? derive(record) : record);

  const repo: Repo<T> = {
    table,

    async get(id) {
      const record = await table.get(id);
      return record && isLive(record) ? record : undefined;
    },

    async all() {
      return (await table.toArray()).filter(isLive);
    },

    async create(draft) {
      const timestamp = now();
      const record = prepare({
        ...(draft as object),
        id: draft.id ?? ulid(),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      } as T);

      await db.transaction('rw', table, db.changes, async () => {
        await table.put(record);
        await logChange(tableName, record.id, 'put');
      });
      return record;
    },

    async update(id, patch) {
      let updated!: T;
      await db.transaction('rw', table, db.changes, async () => {
        const existing = await table.get(id);
        if (!existing) throw new Error(`${tableName}: no record ${id} to update`);
        updated = prepare({ ...existing, ...patch, updatedAt: now() } as T);
        await table.put(updated);
        await logChange(tableName, id, 'put');
      });
      return updated;
    },

    async put(record) {
      let stored!: T;
      await db.transaction('rw', table, db.changes, async () => {
        const existing = await table.get(record.id);
        stored = prepare({
          ...record,
          createdAt: existing?.createdAt ?? record.createdAt ?? now(),
          updatedAt: now(),
        });
        await table.put(stored);
        await logChange(tableName, stored.id, 'put');
      });
      return stored;
    },

    async bulkPut(records) {
      if (records.length === 0) return;
      const timestamp = now();
      const prepared = records.map((r) => prepare({ ...r, updatedAt: timestamp }));
      await db.transaction('rw', table, db.changes, async () => {
        await table.bulkPut(prepared);
        await db.changes.bulkAdd(
          prepared.map((r) => ({ table: tableName, recordId: r.id, op: 'put' as const, at: timestamp })),
        );
      });
    },

    async remove(id) {
      await db.transaction('rw', table, db.changes, async () => {
        const existing = await table.get(id);
        if (!existing) return;
        await table.put({ ...existing, deletedAt: now(), updatedAt: now() });
        await logChange(tableName, id, 'delete');
      });
    },

    async restore(id) {
      await db.transaction('rw', table, db.changes, async () => {
        const existing = await table.get(id);
        if (!existing) return;
        await table.put({ ...existing, deletedAt: null, updatedAt: now() });
        await logChange(tableName, id, 'put');
      });
    },

    async count() {
      return (await repo.all()).length;
    },
  };

  return repo;
}

/** Read a value from the meta table (schema/seed bookkeeping, not user data). */
export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

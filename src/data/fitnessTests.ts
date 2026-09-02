/**
 * Reading and writing benchmark results.
 *
 * A result is written once and never revised: it is what happened on a day, and the whole
 * point of the protocol is that two of them can be compared. Correcting a typo means deleting
 * the record, not editing the number under it.
 */

import { db } from '../db/db';
import { testResultRepo } from './repos';
import { todayKey } from '../domain/dates';
import { oneRepMaxFromThree } from '../domain/fitnessTests';
import { estimate1RM } from '../domain/training';
import type { TestKind, TestResult } from '../domain/fitnessTests';
import type { DayKey, Id } from '../domain/types';

export async function allTestResults(): Promise<TestResult[]> {
  const rows = await db.testResults.toArray();
  return rows
    .filter((row) => !(row as { deletedAt?: string }).deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function resultsFor(exerciseSlug: string): Promise<TestResult[]> {
  const rows = await db.testResults.where('exerciseSlug').equals(exerciseSlug).toArray();
  return rows
    .filter((row) => !(row as { deletedAt?: string }).deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function recordTestResult(draft: {
  exerciseSlug: string;
  kind: TestKind;
  value: number;
  reps?: number;
  sessionId?: Id;
  notes?: string;
  date?: DayKey;
  entry?: 'manual';
}): Promise<TestResult> {
  const date = draft.date ?? todayKey();

  /*
   * The one-rep figure is derived now and stored, not computed on read. Improving the formula
   * later must not silently restate what a test in March said.
   *
   * A hand-entered max carries its own rep count — people know their five rep max as readily
   * as their single — so it converts through the same Epley the rest of the app uses rather
   * than assuming three.
   */
  const estimated1RMKg =
    draft.kind === 'threeRepMax'
      ? oneRepMaxFromThree(draft.value)
      : draft.kind === 'maxLoad'
        ? (estimate1RM(draft.value, draft.reps ?? 1) ?? undefined)
        : undefined;

  return (await testResultRepo.create({
    ...draft,
    date,
    estimated1RMKg,
  } as never)) as unknown as TestResult;
}

export async function deleteTestResult(id: Id): Promise<void> {
  await testResultRepo.remove(id);
}

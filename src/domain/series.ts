/**
 * A list of numbers stored as one line of text.
 *
 * The run trace and the minute-by-minute heart rate are both long lists of small whole numbers,
 * and both end up in a backup written as pretty-printed JSON. There an array puts every element
 * on its own indented line, so a two-hour run's heart rate costs 1.8 KB as an array and about
 * 500 bytes as a string. Measured, not guessed: see the per-minute decision in the backlog.
 */

/** Whole numbers joined by commas. Anything that is not a number is stored as 0. */
export function encodeSeries(values: number[]): string {
  return values.map((value) => (Number.isFinite(value) ? String(Math.round(value)) : '0')).join(',');
}

/** The numbers back. Absent or empty text is an empty list, never an error. */
export function decodeSeries(text: string | null | undefined): number[] {
  if (!text) return [];
  return text.split(',').map((part) => {
    const value = Number(part);
    return Number.isFinite(value) ? value : 0;
  });
}

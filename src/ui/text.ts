/**
 * "1 movements" is the kind of detail that makes an app feel unfinished, and it comes up
 * everywhere a count is rendered. One helper, used at every count.
 */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : pluralForm ?? `${singular}s`}`;
}

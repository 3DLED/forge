/**
 * Theme registry.
 *
 * Only metadata lives here — every colour and measurement is in theme.css, and the preview
 * swatches paint themselves by setting `data-theme` on a wrapper element. Duplicating the
 * palette in TypeScript would guarantee the previews drift from the real thing.
 */

export type ThemeId = 'forge' | 'blueprint' | 'chalk' | 'signal';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  tagline: string;
  /** The argument for choosing it — what it is good at, and what it costs. */
  rationale: string;
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'signal',
    name: 'Signal',
    tagline: 'Readable mid-set',
    rationale:
      'True black, heavy type, big rounded shapes, one vivid accent, and noticeably larger tap targets. Built for the moment you are actually using it: breathing hard, arm at full stretch, hands sweaty. Costs information density — you will scroll more.',
  },
  {
    id: 'forge',
    name: 'Forge',
    tagline: 'Warm, dark, familiar',
    rationale:
      'Dark cards and a warm orange accent — the visual language most training apps use, which makes it instantly legible and completely unsurprising. Denser than Signal, so more fits on screen.',
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    tagline: 'An instrument, not an app',
    rationale:
      'Hairline borders, square corners, monospaced numerals so every figure lines up in a column, and tighter spacing to fit more on screen. Leans into the thing this app is actually better at than its competitors: the data. Costs some warmth — it reads clinical.',
  },
  {
    id: 'chalk',
    name: 'Chalk',
    tagline: 'A training journal',
    rationale:
      'Light warm paper, serif headings, generous spacing, shadows instead of outlines. The only direction here readable in direct sunlight, and the calmest to review a whole training block in. Costs battery on OLED and glares in a dark gym.',
  },
];

export const DEFAULT_THEME: ThemeId = 'signal';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((theme) => theme.id === value);
}

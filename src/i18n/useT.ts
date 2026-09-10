/**
 * The translator, bound to the profile's language.
 *
 * A hook rather than a bare import so that changing the language re-renders every screen that
 * shows words, which is all of them. `useApp` already re-renders on a profile change, so the
 * language arrives by the same route the unit system does and nothing needs its own
 * subscription.
 *
 *     const t = useT();
 *     <h2>{t('Planned for today')}</h2>
 *     <span>{t.count(session.movements.length, 'movement')}</span>
 */

import { useMemo } from 'react';
import { useApp } from '../ui/AppProvider';
import { count, translate } from './copy';

export interface Translator {
  (english: string): string;
  /** "3 movements" — a count and a noun that agrees with it. */
  count: (value: number, noun: string) => string;
}

export function useT(): Translator {
  const { lang } = useApp();
  return useMemo(() => {
    const t = ((english: string) => translate(english, lang)) as Translator;
    t.count = (value: number, noun: string) => count(value, noun, lang);
    return t;
  }, [lang]);
}

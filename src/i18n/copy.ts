/**
 * The interface text, per language.
 *
 * The English string is the key. That is a deliberate choice over opaque identifiers, and it
 * buys three things this codebase cares about more than it cares about tidiness:
 *
 * 1. **The source still reads as English.** `t('Planned for today')` says what appears on
 *    screen. `t('TODAY-003')` says nothing, and every future reader has to go and look it up.
 *    This repo is dense with prose comments for exactly that reason; opaque keys would work
 *    against all of it.
 * 2. **A missing translation degrades to English, not to a broken screen.** There are 515 of
 *    these. Any scheme where a gap shows `MORE-118` to a runner is a scheme that punishes
 *    doing the work incrementally, which is the only way it is going to get done.
 * 3. **No key to keep in sync.** Changing the English changes the key, which orphans the
 *    Spanish — and `npm run copy:check` lists exactly what fell off, which is better than
 *    silently showing a stale translation of a sentence that no longer exists.
 *
 * The cost is that two identical English strings needing different Spanish cannot be told
 * apart. That is rare, and when it happens the fix is a disambiguating suffix in the key:
 * `t('Back|navigation')`, with everything after the bar stripped before display.
 *
 * Counted nouns go through `count` rather than through a key, because "3 movements" is not a
 * string, it is a number and a noun that has to agree with it.
 */

import { ES } from './es';
import type { Language } from '../domain/types';

/** Anything after a bar is context for the translator, never shown. */
const CONTEXT = /\|.*$/;

const CATALOGUES: Partial<Record<Language, Record<string, string>>> = { es: ES };

/**
 * The text for a language, falling back to the English it was keyed on.
 *
 * Callable outside a component, which is why the language is an argument rather than context.
 * Inside a component use `useT`, which binds it to the profile.
 */
export function translate(english: string, lang: Language | undefined): string {
  const catalogue = lang ? CATALOGUES[lang] : undefined;
  const hit = catalogue?.[english];
  return (hit ?? english).replace(CONTEXT, '');
}

/**
 * "3 movements" / "3 movimientos" — a count and a noun that agrees with it.
 *
 * Separate from `translate` because the plural is a property of the noun rather than of the
 * sentence, and because English gets away with adding an s where Spanish sometimes adds es.
 * A noun with no entry falls back to the English rule, which is what keeps a new noun from
 * breaking a screen before anybody has translated it.
 */
export function count(value: number, noun: string, lang: Language | undefined): string {
  const forms = lang ? PLURALS[lang]?.[noun] : undefined;
  if (forms) return `${value} ${value === 1 ? forms[0] : forms[1]}`;
  return `${value} ${value === 1 ? noun : `${noun}s`}`;
}

/** Counted nouns, singular and plural, for languages that need to be told. */
const PLURALS: Partial<Record<Language, Record<string, [string, string]>>> = {
  es: {
    movement: ['movimiento', 'movimientos'],
    exercise: ['ejercicio', 'ejercicios'],
    session: ['sesión', 'sesiones'],
    workout: ['entrenamiento', 'entrenamientos'],
    set: ['serie', 'series'],
    rep: ['repetición', 'repeticiones'],
    piece: ['tramo', 'tramos'],
    day: ['día', 'días'],
    week: ['semana', 'semanas'],
    plan: ['plan', 'planes'],
    test: ['prueba', 'pruebas'],
    item: ['artículo', 'artículos'],
    result: ['resultado', 'resultados'],
    note: ['nota', 'notas'],
    round: ['ronda', 'rondas'],
    minute: ['minuto', 'minutos'],
    second: ['segundo', 'segundos'],
  },
};

/** Every English key that has a translation, for the coverage tool. */
export function translated(lang: Language): Set<string> {
  return new Set(Object.keys(CATALOGUES[lang] ?? {}));
}

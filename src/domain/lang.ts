/**
 * The words, per language.
 *
 * Forge does not have a string table for the things it says on a run, and could not use one.
 * The cues are assembled: "Mile 3 · 8:53 /mi · 6 seconds slow" is four decisions about
 * wording and one about order, and only the wording changes between languages. Translating
 * the finished sentence would mean translating a few thousand of them.
 *
 * So this file holds the pieces, and `runVoice` holds the assembly. What lives here is
 * everything that varies with language and nothing that varies with judgement: the order of
 * a cue, whether the elapsed time is worth saying, when to stay quiet — those are the same
 * decisions in every language and they stay in one place.
 *
 * Three things Spanish needs that English hid:
 *
 * 1. **Gender.** A mile is feminine and a kilometre is masculine, so "Mile 3" and
 *    "Kilometre 3" are `Milla 3` and `Kilómetro 3` — the counted place has to be built by
 *    the language, not by a format string with a noun dropped into it.
 * 2. **Comparatives.** "6 seconds slow" is not an adjective in Spanish, it is a comparison:
 *    `6 segundos más lento`. The English reads like a label and the Spanish has to read like
 *    a sentence.
 * 3. **The decimal mark.** `1.5 millas` is read aloud by a Spanish engine as a sequence of
 *    digits around a full stop. `1,5 millas` is read as a number.
 *
 * Units are deliberately not tied to language. Somebody running in Texas in Spanish wants
 * miles, and the units setting already answers that question on its own.
 */

import type { SegmentKind } from './runPlan';
import type { Language } from './types';

/** Nouns that get counted, and therefore need a plural in whatever language. */
export type CountNoun = 'mile' | 'kilometre' | 'metre' | 'hour' | 'minute' | 'second';

/** The fixed phrases a run is narrated with. */
export type PhraseKey =
  /** Joins an extent to its pace: "5 miles **at** 11:00 /mi". */
  | 'at'
  /** Joins a distance to the time it took: "2 kilometres **in** 8:12". */
  | 'in'
  /** Opens the instruction for the segment starting now. */
  | 'next'
  | 'onPace'
  | 'slow'
  | 'fast'
  | 'pickUp'
  | 'easeBack'
  | 'backOnPace'
  | 'sessionDone'
  | 'runStarted'
  | 'lastOneDone'
  /** An open-ended segment, with no distance and no clock. */
  | 'untilYouSay'
  /** What "/km", "/mi" and "×" should become on the way to a speech engine. */
  | 'perKm'
  | 'perMile'
  | 'by';

export interface Vocabulary {
  /** BCP 47, handed to the speech engine. */
  readonly tag: string;
  /** "3 miles" / "3 millas" — the number and its noun, agreeing. */
  count(noun: CountNoun, value: number): string;
  /** "1.5" / "1,5" — trimmed, and marked the way this language reads a decimal. */
  decimal(value: number): string;
  /** "Mile 3" / "Milla 3" — a counted place, which is where gender turns up. */
  place(unit: 'mile' | 'km', index: number): string;
  /** What to say as each kind of segment starts. */
  readonly verb: Record<SegmentKind, string>;
  readonly phrase: Record<PhraseKey, string>;
  /**
   * Lowercases a sentence so it can be embedded in another one.
   *
   * A hook rather than a call to `toLowerCase`, because it is only safe in languages that do
   * not capitalise nouns. English and Spanish both qualify; German would not.
   */
  lower(text: string): string;
}

// --- English -----------------------------------------------------------------

const EN_NOUNS: Record<CountNoun, [string, string]> = {
  mile: ['mile', 'miles'],
  kilometre: ['kilometre', 'kilometres'],
  metre: ['metre', 'metres'],
  hour: ['hour', 'hours'],
  minute: ['minute', 'minutes'],
  second: ['second', 'seconds'],
};

const EN: Vocabulary = {
  tag: 'en-US',

  count(noun, value) {
    const [one, many] = EN_NOUNS[noun];
    return `${EN.decimal(value)} ${value === 1 ? one : many}`;
  },

  decimal(value) {
    // "1.5" rather than "1.50", and "1" rather than "1.0".
    return String(Number(value.toFixed(2)));
  },

  place(unit, index) {
    return `${unit === 'mile' ? 'Mile' : 'Kilometre'} ${index}`;
  },

  verb: {
    warmup: 'Warm up',
    work: 'Run',
    /*
     * "Jog", not "Recover". Recovery is what the segment is for; jogging is what you do, and
     * an instruction shouted at someone mid-session should name the action. It also matches
     * the word the settings screen uses to set it up.
     */
    recovery: 'Jog',
    steady: 'Steady',
    cooldown: 'Cool down',
  },

  phrase: {
    at: 'at',
    in: 'in',
    next: 'Next,',
    onPace: 'on pace',
    slow: 'slow',
    fast: 'fast',
    pickUp: 'Pick it up',
    easeBack: 'Ease back',
    backOnPace: 'Back on pace',
    sessionDone: 'Session done',
    runStarted: 'Run started',
    lastOneDone: 'Last one done',
    untilYouSay: 'until you say',
    perKm: 'per kilometre',
    perMile: 'per mile',
    by: 'by',
  },

  lower: (text) => text.toLowerCase(),
};

// --- Spanish -----------------------------------------------------------------

/**
 * Neutral Latin American Spanish, which is what a US audience hears.
 *
 * Nothing here is Castilian-specific, so switching would be a matter of taste rather than of
 * comprehension. The one place a real choice was made is `cooldown`: "enfriamiento" is the
 * noun a coach writes on a plan, and "afloja" is what you would say to somebody still moving.
 * These are spoken mid-run, so the instruction wins.
 */
const ES_NOUNS: Record<CountNoun, [string, string]> = {
  mile: ['milla', 'millas'],
  kilometre: ['kilómetro', 'kilómetros'],
  metre: ['metro', 'metros'],
  hour: ['hora', 'horas'],
  minute: ['minuto', 'minutos'],
  second: ['segundo', 'segundos'],
};

const ES: Vocabulary = {
  // Not es-ES: the "419" subtag is Latin America, and it is what picks a Latin American
  // voice on iOS rather than a Peninsular one.
  tag: 'es-419',

  count(noun, value) {
    const [one, many] = ES_NOUNS[noun];
    return `${ES.decimal(value)} ${value === 1 ? one : many}`;
  },

  decimal(value) {
    return String(Number(value.toFixed(2))).replace('.', ',');
  },

  place(unit, index) {
    return `${unit === 'mile' ? 'Milla' : 'Kilómetro'} ${index}`;
  },

  verb: {
    warmup: 'Calienta',
    work: 'Corre',
    recovery: 'Trota',
    steady: 'Ritmo constante',
    cooldown: 'Afloja',
  },

  phrase: {
    at: 'a',
    in: 'en',
    next: 'Ahora,',
    onPace: 'en ritmo',
    // Comparatives, not adjectives: "6 segundos más lento", never "6 segundos lento".
    slow: 'más lento',
    fast: 'más rápido',
    pickUp: 'Aprieta el paso',
    easeBack: 'Afloja un poco',
    backOnPace: 'De vuelta en ritmo',
    sessionDone: 'Sesión terminada',
    runStarted: 'Carrera iniciada',
    lastOneDone: 'Última terminada',
    untilYouSay: 'hasta que digas',
    perKm: 'por kilómetro',
    perMile: 'por milla',
    by: 'por',
  },

  lower: (text) => text.toLowerCase(),
};

const VOCABULARIES: Record<Language, Vocabulary> = { en: EN, es: ES };

/** Every language the app can be set to, in the order a picker should list them. */
export const LANGUAGES: { code: Language; name: string }[] = [
  // Each named in itself, because that is the name somebody looking for it recognises.
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
];

/**
 * The words for a language, falling back to English.
 *
 * Undefined is the ordinary case, not an error: every profile written before this existed has
 * no language on it, and English is what those installs have been running in all along.
 */
export function words(lang: Language | undefined): Vocabulary {
  return (lang && VOCABULARIES[lang]) ?? EN;
}

/** The BCP 47 tag to hand the speech engine. */
export function speechTag(lang: Language | undefined): string {
  return words(lang).tag;
}

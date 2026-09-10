/**
 * The Spanish wording.
 *
 * A separate file from `runVoice.test`, because these are not the same assertions with
 * different strings in them. The English tests are about what a sentence omits; these are
 * about the four things English never had to decide, and each one is a bug that would
 * otherwise reach a runner's ear before anybody noticed:
 *
 * 1. Gender, which "Milla" and "Kilómetro" disagree about.
 * 2. Comparatives, because "6 segundos lento" is not Spanish.
 * 3. The decimal mark, which a speech engine reads aloud.
 * 4. The duration expander, which is what stopped "11:00" being a time of day.
 *
 * There is also one test that nothing here leaks into English, since both languages run
 * through the same assembly.
 */

import { describe, expect, it } from 'vitest';
import { sayChange, sayDrift, saySplit, sayStart, speakable, splitPlace } from './runVoice';
import { advanceRun, buildRunPlan, describeSegment, startRun, type RunPlan } from './runPlan';
import { words } from './lang';
import type { PaceReading, SplitCue } from './pace';

const cue = (over: Partial<SplitCue> = {}): SplitCue => ({
  index: 3,
  splitSecPerKm: 300,
  offSecPerKm: null,
  kind: 'onPace',
  ...over,
});

const reading = (paceSecPerKm: number | null): PaceReading => ({
  speedMps: paceSecPerKm ? 1000 / paceSecPerKm : null,
  paceSecPerKm,
  distanceM: 2000,
  moving: paceSecPerKm != null,
  discarded: 0,
});

describe('gender', () => {
  /*
   * The whole reason the counted place is built by the language rather than by a format
   * string: a mile is feminine and a kilometre is masculine, so there is no single template
   * that produces both.
   */
  it('agrees with the unit being counted', () => {
    expect(splitPlace(3, 'mile', 'es')).toBe('Milla 3');
    expect(splitPlace(3, 'km', 'es')).toBe('Kilómetro 3');
  });

  it('counts nouns with their own plural', () => {
    const w = words('es');
    expect(w.count('mile', 1)).toBe('1 milla');
    expect(w.count('mile', 3)).toBe('3 millas');
    expect(w.count('kilometre', 1)).toBe('1 kilómetro');
    expect(w.count('second', 1)).toBe('1 segundo');
  });
});

describe('the decimal mark', () => {
  /*
   * "1.5 millas" is read by a Spanish engine as digits either side of a full stop. The comma
   * is what makes it a number, and this is the one piece of punctuation that changes meaning
   * when it is spoken rather than shown.
   */
  it('is a comma, so a fraction is read as a number', () => {
    expect(splitPlace(5, 'halfMile', 'es')).toBe('2,5 millas');
    expect(splitPlace(3, 'halfKm', 'es')).toBe('1,5 kilómetros');
  });

  it('still drops a trailing zero rather than saying it', () => {
    expect(words('es').count('mile', 2)).toBe('2 millas');
  });
});

describe('being off pace', () => {
  /* "6 segundos lento" is not Spanish. It is a comparison, and needs the comparative. */
  it('uses a comparative rather than a bare adjective', () => {
    const said = saySplit({
      cue: cue({ kind: 'tooSlow', offSecPerKm: 12 }),
      interval: 'km',
      units: 'metric',
      lang: 'es',
    });
    expect(said).toContain('12 segundos más lento');
    expect(said).not.toContain('segundos lento');
  });

  it('says the fast side the same way', () => {
    const said = sayDrift({
      kind: 'tooFast',
      reading: reading(280),
      target: { targetSecPerKm: 300, toleranceSecPerKm: 10 },
      units: 'metric',
      lang: 'es',
    });
    expect(said).toContain('Afloja un poco');
    expect(said).toContain('20 segundos más rápido');
  });

  it('leads with the instruction, exactly as English does', () => {
    const said = sayDrift({
      kind: 'tooSlow',
      reading: reading(330),
      target: { targetSecPerKm: 300, toleranceSecPerKm: 10 },
      units: 'metric',
      lang: 'es',
    });
    expect(said.startsWith('Aprieta el paso')).toBe(true);
  });

  it('says on pace without a number when there is nothing to correct', () => {
    const said = saySplit({ cue: cue({ offSecPerKm: 0 }), interval: 'km', units: 'metric', lang: 'es' });
    expect(said).toContain('en ritmo');
  });
});

describe('the duration expander', () => {
  /*
   * The bug this exists for, in the other language: "11:00" spoken by a Spanish engine is
   * "las once en punto" unless the words are supplied.
   */
  it('spells a pace out rather than leaving it to be read as a clock time', () => {
    expect(speakable('11:00 /mi', 'es')).toBe('11 minutos por milla');
  });

  it('drops empty units', () => {
    expect(speakable('0:45', 'es')).toBe('45 segundos');
    expect(speakable('1:04:15', 'es')).toBe('1 hora 4 minutos 15 segundos');
  });

  it('expands the pace suffixes into words', () => {
    expect(speakable('5:30 /km', 'es')).toBe('5 minutos 30 segundos por kilómetro');
  });

  it('turns the separator into a sentence boundary, accents and all', () => {
    // "Última" starts the second sentence, so the capitalisation has to be Unicode-aware.
    expect(speakable('Milla 2 · última vuelta', 'es')).toBe('Milla 2. Última vuelta');
  });
});

describe('the instruction for a segment', () => {
  it('names the action and the extent', () => {
    const plan = buildRunPlan({ kind: 'steady', distanceM: 8000 }, 330)!;
    expect(describeSegment(plan.segments[0], 'metric', 'es')).toBe(
      'Ritmo constante 8 kilómetros a 5:30 /km',
    );
  });

  it('keeps miles when the units say miles, because units are not language', () => {
    const plan = buildRunPlan({ kind: 'steady', distanceM: 1609.344 }, 300)!;
    const said = describeSegment(plan.segments[0], 'imperial', 'es');
    expect(said).toContain('1 milla');
    expect(said).toContain('/mi');
  });

  it('reports the piece just finished and the one starting now', () => {
    const plan: RunPlan = buildRunPlan({
      kind: 'intervals',
      warmupSec: 0,
      reps: 3,
      workM: 800,
      workSecPerKm: 270,
      floatM: 400,
      floatSecPerKm: 390,
      cooldownSec: 0,
    })!;
    const change = advanceRun({ plan, cursor: startRun(), distanceM: 800, elapsedSec: 216 });
    const said = sayChange(change, 'metric', 'es');
    expect(said).toContain('800 metros en 3:36');
    expect(said).toContain('Ahora, trota 400 metros');
  });

  it('opens the run with the first instruction', () => {
    const plan = buildRunPlan({ kind: 'steady', distanceM: 5000 }, 330)!;
    expect(sayStart(plan.segments[0], 'metric', 'es')).toBe('Ritmo constante 5 kilómetros a 5:30 /km');
  });
});

describe('the two languages stay apart', () => {
  it('leaves English alone when no language is given', () => {
    expect(splitPlace(3, 'mile')).toBe('Mile 3');
    expect(speakable('11:00 /mi')).toBe('11 minutes per mile');
  });

  it('falls back to English for a language nothing was written for', () => {
    // Every profile saved before this existed has no language on it at all.
    expect(words(undefined).tag).toBe('en-US');
    expect(splitPlace(3, 'mile', undefined)).toBe('Mile 3');
  });

  it('hands the engine a Latin American tag rather than a Peninsular one', () => {
    expect(words('es').tag).toBe('es-419');
  });
});

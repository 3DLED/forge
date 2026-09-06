/**
 * Saying things out loud.
 *
 * The browser's own speech synthesis, which is on every phone this app runs on and needs no
 * asset, no network and no permission — the same reasons `beep.ts` synthesises its tones
 * rather than shipping a wav.
 *
 * Two things about it are worth knowing before reading the code:
 *
 * 1. **It has the same gesture rule as audio, and enforces it more quietly.** A first
 *    utterance outside a real tap is dropped without an error on iOS. So `unlockSpeech()`
 *    speaks a zero-length string from the Start button, which is enough to open the door.
 * 2. **The queue is the failure mode.** Utterances stack up by default, so a run that loses
 *    signal and then recovers can arrive with four sentences to say and deliver all of them,
 *    a minute late, over each other. Everything here cancels before it speaks: the newest cue
 *    is the only one still worth hearing.
 *
 * When this is wrapped in Capacitor the implementation swaps for the TTS plugin and the shape
 * stays, in the same way `locationSource` is shaped like the geolocation plugin rather than
 * like the browser.
 */

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

export function speechAvailable(): boolean {
  return synth() !== null && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Call from inside a user gesture, before anything needs saying. */
export function unlockSpeech(): void {
  const engine = synth();
  if (!engine || typeof SpeechSynthesisUtterance === 'undefined') return;

  try {
    // An empty utterance is silent but still counts as the first one, which is the point.
    engine.speak(new SpeechSynthesisUtterance(''));
  } catch {
    // Speech is an extra here. Everything on screen stays correct without it.
  }
}

/**
 * Says it, dropping whatever was still being said.
 *
 * Slightly slower than default and slightly quieter than full: this is heard through one
 * earbud, over traffic and breathing, by someone who cannot look at the screen. Rushing it
 * costs more in re-listening than it saves in seconds.
 */
export function speak(text: string): void {
  const engine = synth();
  if (!engine || typeof SpeechSynthesisUtterance === 'undefined') return;
  if (!text.trim()) return;

  try {
    engine.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.volume = 1;
    engine.speak(utterance);
  } catch {
    // As above.
  }
}

/** Stops mid-sentence — for pausing, or for finishing the run early. */
export function stopSpeaking(): void {
  try {
    synth()?.cancel();
  } catch {
    // Nothing to do about it.
  }
}

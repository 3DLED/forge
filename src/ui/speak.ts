/**
 * Saying things out loud.
 *
 * One interface, two implementations, chosen at call time — the same shape as
 * `data/locationSource`, and for the same reason. The web view's own speech synthesis is on
 * every phone this app runs on and needs no asset, no network and no permission, but it is
 * still part of the web view: when iOS suspends that, the talking stops. A run with the
 * phone in a pocket is exactly the case where the cues matter and the web view is asleep.
 *
 * So on a native build this goes to `@capacitor-community/text-to-speech`, which is
 * AVSpeechSynthesizer on iOS and android.speech.tts on Android — outside the web view, and
 * therefore still there when the web view is not.
 *
 * Two things about speech are worth knowing before reading the code:
 *
 * 1. **The browser has the same gesture rule as audio, and enforces it more quietly.** A
 *    first utterance outside a real tap is dropped without an error on iOS. So `unlockSpeech`
 *    speaks a zero-length string from the Start button, which is enough to open the door.
 *    The native engines have no such rule, which is why unlocking is a browser-only idea.
 * 2. **The queue is the failure mode.** Utterances stack up by default, so a run that loses
 *    signal and then recovers can arrive with four sentences to say and deliver all of them,
 *    a minute late, over each other. Both implementations flush before they speak: the
 *    newest cue is the only one still worth hearing.
 *
 * Everything here is fire-and-forget and never throws. Speech is an extra — every cue it
 * says is also on screen, and a run has to survive a device that will not talk.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import type { TextToSpeechPlugin } from '@capacitor-community/text-to-speech';

/**
 * Registered rather than imported from the package, so a web build pulls in the type
 * definitions and no code. The package's own web implementation is `speechSynthesis` with
 * none of the handling below, so there is nothing to gain from shipping it.
 */
const TextToSpeech = registerPlugin<TextToSpeechPlugin>('TextToSpeech');

/**
 * Slightly slower than default: this is heard through one earbud, over traffic and
 * breathing, by someone who cannot look at the screen. Rushing it costs more in
 * re-listening than it saves in seconds.
 *
 * Both engines read this the same way. The plugin scales anything below 1.0 by the
 * platform's own default rate, so 0.95 means "5% slower than normal" on either.
 */
const RATE = 0.95;

/** The plugin's `QueueStrategy.Flush`, inlined to keep its runtime enum out of the bundle. */
const FLUSH = 0;

interface Voice {
  available: () => boolean;
  unlock: () => void;
  say: (text: string) => void;
  stop: () => void;
}

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

/** The web view's own synthesis — every browser build, and the fallback everywhere else. */
const browserVoice: Voice = {
  available: () => synth() !== null && typeof SpeechSynthesisUtterance !== 'undefined',

  unlock() {
    if (!browserVoice.available()) return;
    try {
      // An empty utterance is silent but still counts as the first one, which is the point.
      synth()?.speak(new SpeechSynthesisUtterance(''));
    } catch {
      // Speech is an extra here. Everything on screen stays correct without it.
    }
  },

  say(text) {
    if (!browserVoice.available()) return;
    try {
      const engine = synth();
      if (!engine) return;
      engine.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = RATE;
      utterance.volume = 1;
      engine.speak(utterance);
    } catch {
      // As above.
    }
  },

  stop() {
    try {
      synth()?.cancel();
    } catch {
      // Nothing to do about it.
    }
  },
};

/**
 * The platform's own engine, via `@capacitor-community/text-to-speech`.
 *
 * `category: 'playback'` is the documented way to ask iOS for an audio session that survives
 * the app going to the background. Be warned that version 8.0.2 accepts the option, passes it
 * down to Swift, and then never reads it: there is no `AVAudioSession` call anywhere in the
 * plugin's iOS source, which sets `usesApplicationAudioSession = false` and leaves the
 * session to AVSpeechSynthesizer instead. Whether that is enough to be heard with the screen
 * off is the open question, and it is a device question — no simulator or CI job answers it.
 * The option is passed regardless: it is correct against the published API, it costs nothing
 * today, and it starts working the moment the plugin honours it again.
 *
 * Nothing is awaited. Every call site is a cue mid-run, where a rejected promise means one
 * unsaid sentence and nothing else — the same cue is already on screen.
 */
const nativeVoice: Voice = {
  available: () => true,

  // Native engines have no user-gesture rule; there is no door to open.
  unlock() {},

  say(text) {
    void TextToSpeech.speak({
      text,
      lang: 'en-US',
      rate: RATE,
      // Drop whatever is still being said. A late cue is worse than a missing one.
      queueStrategy: FLUSH,
      category: 'playback',
    }).catch(() => {
      // Unsupported language, engine not installed, a call that outlived the run.
    });
  },

  stop() {
    void TextToSpeech.stop().catch(() => {
      // Nothing to do about it.
    });
  },
};

/**
 * The right engine for wherever this is running.
 *
 * A function rather than a constant because `isNativePlatform` is answered by the Capacitor
 * runtime, which is not there at module-evaluation time in every environment — a test
 * importing this file should not have to care.
 */
function voice(): Voice {
  return Capacitor.isNativePlatform() ? nativeVoice : browserVoice;
}

export function speechAvailable(): boolean {
  return voice().available();
}

/** Call from inside a user gesture, before anything needs saying. */
export function unlockSpeech(): void {
  voice().unlock();
}

/** Says it, dropping whatever was still being said. */
export function speak(text: string): void {
  if (!text.trim()) return;
  voice().say(text);
}

/** Stops mid-sentence — for pausing, or for finishing the run early. */
export function stopSpeaking(): void {
  voice().stop();
}

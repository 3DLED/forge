/**
 * Timer audio.
 *
 * Synthesised with an oscillator rather than played from a file: no asset to download, no
 * decode, and it works with the network off — which is the whole premise of this app.
 *
 * Two constraints shape the API:
 *
 * 1. **Browsers refuse audio until a user gesture.** The AudioContext must be created and
 *    resumed inside a real tap, so `unlockAudio()` is called from the Start button rather
 *    than lazily at the first beep — where it would be silently blocked.
 * 2. **iOS suspends the context** when the app is backgrounded. Every beep re-resumes before
 *    playing, because a countdown that goes silent after you pocket the phone is worse than
 *    no countdown at all.
 */

let context: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

function getContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  );
}

/** Call from inside a user gesture before any beeps are expected. */
export function unlockAudio(): void {
  const Ctor = getContextCtor();
  if (!Ctor) return;

  try {
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume();
  } catch {
    // Audio is a convenience here; the timer stays correct without it.
    context = null;
  }
}

export function audioAvailable(): boolean {
  return getContextCtor() !== undefined;
}

/** A single tone. `frequency` in Hz, `durationMs` in milliseconds. */
export function beep(frequency = 880, durationMs = 140, volume = 0.25): void {
  if (!context) return;

  try {
    if (context.state === 'suspended') void context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    // Ramp the gain instead of switching it. A square-edged start and stop produces an
    // audible click that sounds like a fault rather than a cue.
    const now = context.currentTime;
    const seconds = durationMs / 1000;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + seconds - 0.02);
    gain.gain.linearRampToValueAtTime(0, now + seconds);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + seconds);
  } catch {
    // Ignore — never let a missing beep break the timer.
  }
}

/** The tick that marks an ordinary interval boundary. */
export function beepInterval(): void {
  beep(880, 140);
}

/** Three rising tones: the effort is over. */
export function beepFinish(): void {
  beep(660, 160);
  setTimeout(() => beep(880, 160), 190);
  setTimeout(() => beep(1180, 320), 380);
}

/** Short low ticks for a countdown into a start. */
export function beepCountdown(): void {
  beep(520, 110, 0.2);
}

/** Acknowledges a logged round — deliberately brief so it does not intrude. */
export function beepRound(): void {
  beep(1320, 90, 0.18);
}

/** Vibrate where supported. Silent no-op on iOS, which does not implement it. */
export function buzz(pattern: number | number[] = 60): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported; the beep carries the signal.
  }
}

/**
 * ULID generation.
 *
 * Time-ordered like an auto-increment key, but generated entirely offline with no
 * coordination — which is exactly what a local-first app that might sync one day needs.
 * 48 bits of millisecond timestamp + 80 bits of randomness, Crockford base32.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: no I, L, O, U
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number): string {
  let out = '';
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    const mod = now % 32;
    out = ENCODING[mod] + out;
    now = (now - mod) / 32;
  }
  return out;
}

function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytes;
}

function encodeRandom(): string {
  const bytes = randomBytes(RANDOM_LEN);
  let out = '';
  for (let i = 0; i < RANDOM_LEN; i++) out += ENCODING[bytes[i] % 32];
  return out;
}

let lastTime = 0;
let lastRandom = '';

/**
 * Monotonic within a millisecond: two ids created in the same tick still sort in
 * creation order, so a set logged in a rapid burst keeps its sequence.
 */
export function ulid(now: number = Date.now()): string {
  if (now === lastTime) {
    lastRandom = incrementBase32(lastRandom);
  } else {
    lastTime = now;
    lastRandom = encodeRandom();
  }
  return encodeTime(now) + lastRandom;
}

function incrementBase32(str: string): string {
  const chars = str.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    const next = ENCODING.indexOf(chars[i]) + 1;
    if (next < 32) {
      chars[i] = ENCODING[next];
      return chars.join('');
    }
    chars[i] = ENCODING[0]; // carry
  }
  return encodeRandom(); // overflowed a full 80 bits in one ms; start fresh
}

/** Milliseconds since epoch that a ULID was minted. Useful for debugging and repair. */
export function ulidTime(id: string): number {
  return id
    .slice(0, TIME_LEN)
    .split('')
    .reduce((acc, ch) => acc * 32 + ENCODING.indexOf(ch), 0);
}

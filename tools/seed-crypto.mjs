/**
 * Locks the licensed seed data so a public repository can still build itself.
 *
 * `catalogue.ts` and `enrichment.ts` are generated from the purchased ExerciseDB set. The
 * EULA grants the right to modify and adapt the data into this app, and clause 12 forbids
 * making the raw materials available to any third party — which is what committing 1.4 MB of
 * names, descriptions and instructions to a public repository does. Clause 13 says the same
 * thing about endpoints allowing bulk download, which is what a raw GitHub URL is.
 *
 * The repository has to stay public: it is what makes the macOS and Linux runners free, and
 * the iOS build is the only thing standing between a Swift mistake and a borrowed laptop.
 * So the plaintext is ignored and the ciphertext is committed. An AES-256-GCM blob is not
 * the Product in any form anyone can read; the key lives in a repository secret, and the
 * three build workflows unlock before they build.
 *
 * Nothing here protects against the key leaking. It is not meant to: the point is that the
 * data is not published, not that it is unbreakable.
 *
 *     node tools/seed-crypto.mjs lock     # plaintext -> .enc, before committing
 *     node tools/seed-crypto.mjs unlock   # .enc -> plaintext, on a fresh clone or in CI
 *
 * The key comes from FORGE_SEED_KEY, or from `.forge-seed-key` beside the repository root,
 * which is ignored for the same reason the plaintext is.
 */

import { createCipheriv, createDecipheriv, createHmac, scryptSync } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The generated files. Both are ExerciseDB content; both are ignored by git. */
const FILES = [
  'src/data/seed/catalogue.ts',
  'src/data/seed/enrichment.ts',
  // Derived from the two above, so it carries the same obligation.
  'src/data/seed/names.es.ts',
  'src/data/seed/prose.es.ts',
];

/**
 * The pictures, which are licensed the same way and so travel the same way.
 *
 * They have to be *in* the app bundle. A Capacitor build serves from the device and there is
 * no origin to fetch a missing picture from later, so ignoring them was not the neutral choice
 * it looked like: it produced a TestFlight build in which every illustration was a broken
 * image, while every local build looked perfect because the files were sitting there untracked.
 *
 * Ninety-odd separate GIFs would be ninety-odd separate blobs, so they are packed into one
 * container first. That also keeps the relock deterministic in the same way the single files
 * are: one nonce over the whole set, unchanged pictures in, byte-identical ciphertext out.
 */
const MEDIA_DIR = 'public/exercise-media';
const MEDIA_BLOB = 'src/data/seed/exercise-media.enc';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function secret() {
  const value = process.env.FORGE_SEED_KEY ?? readKeyFile();
  if (!value) {
    throw new Error(
      'No key. Set FORGE_SEED_KEY, or put one in .forge-seed-key at the repository root.',
    );
  }
  return value.trim();
}

function key(salt) {
  // scrypt rather than a bare hash, so a short key is still expensive to attack.
  return scryptSync(secret(), salt, 32);
}

function readKeyFile() {
  const path = join(ROOT, '.forge-seed-key');
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/**
 * Salt and nonce derived from the content rather than drawn at random.
 *
 * A random nonce meant relocking an unchanged file produced 1.8 MB of entirely different
 * ciphertext, so every regeneration of the catalogue added another copy to git history for
 * no change at all. Deriving them from the plaintext makes the output a pure function of
 * (key, content): unchanged data relocks byte for byte, and the diff is empty.
 *
 * Safe precisely because it is deterministic on the content. The rule GCM cares about is that
 * one key must never reuse a nonce across *different* plaintexts, and different plaintexts
 * hash to different nonces here. Identical output for identical input is the point.
 */
function nonce(secret, content) {
  const digest = (tag) => createHmac('sha256', secret).update(tag).update(content).digest();
  return { salt: digest('forge-salt').subarray(0, SALT_BYTES), iv: digest('forge-iv').subarray(0, IV_BYTES) };
}

function encrypt(content) {
  const { salt, iv } = nonce(secret(), content);
  const cipher = createCipheriv('aes-256-gcm', key(salt), iv);
  const body = Buffer.concat([cipher.update(content), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), body]);
}

function decrypt(blob, label) {
  const salt = blob.subarray(0, SALT_BYTES);
  const iv = blob.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const tag = blob.subarray(SALT_BYTES + IV_BYTES, SALT_BYTES + IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key(salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([
      decipher.update(blob.subarray(SALT_BYTES + IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]);
  } catch {
    // GCM authenticates, so this is the wrong key rather than a corrupt file.
    throw new Error(`Could not decrypt ${label} — wrong key.`);
  }
}

/** Name length, name, body length, body — repeated, in sorted order so it reproduces. */
function packMedia(dir) {
  const parts = [];
  for (const name of readdirSync(dir).sort()) {
    const body = readFileSync(join(dir, name));
    const label = Buffer.from(name, 'utf8');
    const head = Buffer.alloc(6);
    head.writeUInt16BE(label.length, 0);
    head.writeUInt32BE(body.length, 2);
    parts.push(head, label, body);
  }
  return Buffer.concat(parts);
}

function unpackMedia(packed, dir) {
  mkdirSync(dir, { recursive: true });
  let at = 0;
  let files = 0;
  while (at < packed.length) {
    const nameLength = packed.readUInt16BE(at);
    const bodyLength = packed.readUInt32BE(at + 2);
    at += 6;
    const name = packed.subarray(at, at + nameLength).toString('utf8');
    at += nameLength;
    writeFileSync(join(dir, name), packed.subarray(at, at + bodyLength));
    at += bodyLength;
    files += 1;
  }
  return files;
}

function lock() {
  for (const file of FILES) {
    const source = join(ROOT, file);
    if (!existsSync(source)) {
      throw new Error(`${file} is missing. Run tools/import_exercisedb.py against the set first.`);
    }
    const blob = encrypt(readFileSync(source));
    // Base64 rather than raw bytes, so git treats it as text and no binary attribute is
    // needed to make a checkout behave the same on every platform.
    writeFileSync(`${source}.enc`, wrap(blob.toString('base64')));
    console.log(`locked   ${file}  ${(blob.length / 1024).toFixed(0)} KB`);
  }

  const dir = join(ROOT, MEDIA_DIR);
  if (!existsSync(dir)) {
    throw new Error(`${MEDIA_DIR} is missing. Run tools/build_exercise_media.py against the set first.`);
  }
  const packed = packMedia(dir);
  const blob = encrypt(packed);
  writeFileSync(join(ROOT, MEDIA_BLOB), wrap(blob.toString('base64')));
  console.log(
    `locked   ${MEDIA_DIR}  ${readdirSync(dir).length} files, ${(blob.length / 1048576).toFixed(1)} MB`,
  );
}

function unlock() {
  for (const file of FILES) {
    const source = join(ROOT, `${file}.enc`);
    if (!existsSync(source)) throw new Error(`${file}.enc is missing.`);
    const blob = Buffer.from(readFileSync(source, 'utf8').replace(/\s+/g, ''), 'base64');
    const plain = decrypt(blob, `${file}.enc`);
    writeFileSync(join(ROOT, file), plain);
    console.log(`unlocked ${file}  ${(plain.length / 1024).toFixed(0)} KB`);
  }

  const source = join(ROOT, MEDIA_BLOB);
  if (!existsSync(source)) throw new Error(`${MEDIA_BLOB} is missing.`);
  const blob = Buffer.from(readFileSync(source, 'utf8').replace(/\s+/g, ''), 'base64');
  const files = unpackMedia(decrypt(blob, MEDIA_BLOB), join(ROOT, MEDIA_DIR));
  console.log(`unlocked ${MEDIA_DIR}  ${files} files`);
}

/** Fixed-width lines, so a diff on the blob is at least scrollable. */
function wrap(text) {
  return `${text.replace(/(.{100})/g, '$1\n')}\n`;
}

const verb = process.argv[2];
if (verb === 'lock') lock();
else if (verb === 'unlock') unlock();
else {
  console.error('usage: node tools/seed-crypto.mjs lock|unlock');
  process.exit(2);
}

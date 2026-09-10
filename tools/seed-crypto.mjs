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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The generated files. Both are ExerciseDB content; both are ignored by git. */
const FILES = [
  'src/data/seed/catalogue.ts',
  'src/data/seed/enrichment.ts',
  // Derived from the two above, so it carries the same obligation.
  'src/data/seed/names.es.ts',
];

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

function lock() {
  for (const file of FILES) {
    const source = join(ROOT, file);
    if (!existsSync(source)) {
      throw new Error(`${file} is missing. Run tools/import_exercisedb.py against the set first.`);
    }
    const content = readFileSync(source);
    const { salt, iv } = nonce(secret(), content);
    const cipher = createCipheriv('aes-256-gcm', key(salt), iv);
    const body = Buffer.concat([cipher.update(content), cipher.final()]);
    const blob = Buffer.concat([salt, iv, cipher.getAuthTag(), body]);
    // Base64 rather than raw bytes, so git treats it as text and no binary attribute is
    // needed to make a checkout behave the same on every platform.
    writeFileSync(`${source}.enc`, wrap(blob.toString('base64')));
    console.log(`locked   ${file}  ${(blob.length / 1024).toFixed(0)} KB`);
  }
}

function unlock() {
  for (const file of FILES) {
    const source = join(ROOT, `${file}.enc`);
    if (!existsSync(source)) throw new Error(`${file}.enc is missing.`);
    const blob = Buffer.from(readFileSync(source, 'utf8').replace(/\s+/g, ''), 'base64');
    const salt = blob.subarray(0, SALT_BYTES);
    const iv = blob.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
    const tag = blob.subarray(SALT_BYTES + IV_BYTES, SALT_BYTES + IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', key(salt), iv);
    decipher.setAuthTag(tag);
    let plain;
    try {
      plain = Buffer.concat([
        decipher.update(blob.subarray(SALT_BYTES + IV_BYTES + TAG_BYTES)),
        decipher.final(),
      ]);
    } catch {
      // GCM authenticates, so this is the wrong key rather than a corrupt file.
      throw new Error(`Could not decrypt ${file}.enc — wrong key.`);
    }
    writeFileSync(join(ROOT, file), plain);
    console.log(`unlocked ${file}  ${(plain.length / 1024).toFixed(0)} KB`);
  }
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

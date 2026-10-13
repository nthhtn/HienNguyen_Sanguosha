import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scrypt cost: 128 * N * r bytes = 16 MiB per hash.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, keyLength: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFC'), salt, keyLength, { N: n, r, p, maxmem: MAX_MEMORY }, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

// "scrypt$N$r$p$<salt>$<key>", base64url: the parameters travel with the hash,
// so they can be raised later without breaking existing passwords.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, key] = parts;
  const expected = Buffer.from(key, 'base64url');
  if (expected.length === 0) return false;
  try {
    const actual = await derive(password, Buffer.from(salt, 'base64url'), expected.length, Number(n), Number(r), Number(p));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

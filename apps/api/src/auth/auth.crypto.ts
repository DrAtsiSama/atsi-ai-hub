import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_LENGTH = 32;

export async function hashPassword(
  password: string,
): Promise<string> {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Password must contain at least 12 characters');
  }

  const salt = randomBytes(PASSWORD_SALT_LENGTH);

  const derivedKey = (await scrypt(
    password,
    salt,
    PASSWORD_KEY_LENGTH,
  )) as Buffer;

  return [
    'scrypt',
    salt.toString('hex'),
    derivedKey.toString('hex'),
  ].join(':');
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split(':');

  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, saltHex, hashHex] = parts;

  if (
    !/^[0-9a-f]{64}$/.test(saltHex) ||
    !/^[0-9a-f]{128}$/.test(hashHex)
  ) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');

  const actualHash = (await scrypt(
    password,
    salt,
    expectedHash.length,
  )) as Buffer;

  return timingSafeEqual(actualHash, expectedHash);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

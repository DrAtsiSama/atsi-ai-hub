import { describe, expect, it } from 'vitest';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './auth.crypto.js';

describe('Auth crypto', () => {
  it('hashes and verifies a password', async () => {
    const password = 'ExamplePassword-2026!';

    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('WrongPassword', hash)).toBe(false);
  });

  it('generates different password hashes', async () => {
    const password = 'ExamplePassword-2026!';

    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).not.toBe(second);
  });

  it('rejects invalid stored hashes', async () => {
    expect(await verifyPassword('ExamplePassword-2026!', 'invalid')).toBe(false);
  });

  it('generates random session tokens', () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).toHaveLength(64);
    expect(first).not.toBe(second);
  });

  it('hashes session tokens deterministically', () => {
    const token = generateSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
  });
});

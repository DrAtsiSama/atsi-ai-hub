import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword, hashSessionToken } from './auth.crypto.js';

describe('AuthService', () => {
  let service: AuthService;
  let query: ReturnType<typeof vi.fn>;

  const adminId = randomUUID();
  const username = 'atsi_admin';
  const password = 'ExamplePassword-2026!';

  beforeEach(() => {
    query = vi.fn();

    const database = {
      query,
    } as unknown as DatabaseService;

    service = new AuthService(database);
  });

  it('rejects invalid credentials', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.login('unknown', 'WrongPassword'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects incorrect passwords', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: adminId,
        username,
        password_hash: await hashPassword(password),
        is_active: true,
      }],
    });

    await expect(
      service.login(username, 'WrongPassword'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects disabled administrators', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: adminId,
        username,
        password_hash: await hashPassword(password),
        is_active: false,
      }],
    });

    await expect(
      service.login(username, password),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('creates a session for valid credentials', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: adminId,
          username,
          password_hash: await hashPassword(password),
          is_active: true,
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await service.login(username, password);

    expect(result.user.username).toBe(username);
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('retrieves an authenticated user', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: adminId, username }],
    });

    const token = 'a'.repeat(64);
    const result = await service.getSessionUser(token);

    expect(result.username).toBe(username);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('admin_sessions'),
      [hashSessionToken(token)],
    );
  });

  it('rejects expired or revoked sessions', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.getSessionUser('a'.repeat(64)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects malformed session tokens', async () => {
    await expect(
      service.getSessionUser('invalid'),
    ).rejects.toThrow(UnauthorizedException);

    expect(query).not.toHaveBeenCalled();
  });

  it('revokes a session on logout', async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const token = 'b'.repeat(64);

    await service.logout(token);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE admin_sessions'),
      [hashSessionToken(token)],
    );
  });
});

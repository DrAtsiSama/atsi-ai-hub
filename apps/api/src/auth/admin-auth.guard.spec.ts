import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { AuthService } from './auth.service.js';

describe('AdminAuthGuard', () => {
  let guard: AdminAuthGuard;
  let getSessionUser: ReturnType<typeof vi.fn>;

  function context(cookie?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: cookie ? { cookie } : {},
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    getSessionUser = vi.fn();

    const authService = {
      getSessionUser,
    } as unknown as AuthService;

    guard = new AdminAuthGuard(authService);
  });

  it('refuses access without a cookie', async () => {
    await expect(
      guard.canActivate(context()),
    ).rejects.toThrow(UnauthorizedException);

    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it('refuses access without an admin session cookie', async () => {
    await expect(
      guard.canActivate(context('other_cookie=123')),
    ).rejects.toThrow(UnauthorizedException);

    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it('allows access with a valid session', async () => {
    const token = 'a'.repeat(64);

    getSessionUser.mockResolvedValue({
      id: 'admin-id',
      username: 'atsi_admin',
    });

    await expect(
      guard.canActivate(
        context(`atsi_admin_session=${token}`),
      ),
    ).resolves.toBe(true);

    expect(getSessionUser).toHaveBeenCalledWith(token);
  });

  it('refuses access with a revoked or expired session', async () => {
    const token = 'b'.repeat(64);

    getSessionUser.mockRejectedValue(
      new UnauthorizedException('Session invalide'),
    );

    await expect(
      guard.canActivate(
        context(`atsi_admin_session=${token}`),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});

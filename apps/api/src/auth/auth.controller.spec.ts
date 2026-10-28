import { Test } from '@nestjs/testing';
import {
  INestApplication,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';

describe('AuthController HTTP', () => {
  let app: INestApplication;

  const authService = {
    login: vi.fn(),
    getSessionUser: vi.fn(),
    logout: vi.fn(),
  };

  const rateLimit = {
    reserveAttempt: vi.fn(),
  };

  const token = 'a'.repeat(64);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: LoginRateLimitService, useValue: rateLimit },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 401 for invalid credentials', async () => {
    vi.resetAllMocks();

    authService.login.mockRejectedValue(
      new UnauthorizedException('Identifiants invalides'),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'incorrect',
      });

    expect(response.status).toBe(401);
    expect(rateLimit.reserveAttempt).toHaveBeenCalledOnce();
  });

  it('returns 429 when the login limit is reached', async () => {
    vi.resetAllMocks();

    rateLimit.reserveAttempt.mockRejectedValue(
      new HttpException(
        'Trop de tentatives',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'incorrect',
      });

    expect(response.status).toBe(429);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('sets a session cookie after successful login', async () => {
    vi.resetAllMocks();

    authService.login.mockResolvedValue({
      token,
      expiresAt: new Date(Date.now() + 3600000),
      user: {
        id: 'admin-id',
        username: 'admin',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'ValidPassword-2026!',
      });

    expect(response.status).toBe(201);

    const cookieHeader = response.headers['set-cookie'];
    const cookies = Array.isArray(cookieHeader)
      ? cookieHeader
      : [cookieHeader];

    const sessionCookie = cookies.find(
      (cookie: string | undefined) =>
        cookie?.startsWith('atsi_admin_session='),
    );

    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Strict');
    expect(rateLimit.reserveAttempt).toHaveBeenCalledOnce();
  });

  it('returns the authenticated administrator', async () => {
    vi.resetAllMocks();

    authService.getSessionUser.mockResolvedValue({
      id: 'admin-id',
      username: 'admin',
    });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `atsi_admin_session=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.authenticated).toBe(true);
    expect(response.body.user.username).toBe('admin');
  });

  it('rejects requests without a session cookie', async () => {
    vi.resetAllMocks();

    const response = await request(app.getHttpServer())
      .get('/auth/me');

    expect(response.status).toBe(401);
  });

  it('revokes the session on logout', async () => {
    vi.resetAllMocks();

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `atsi_admin_session=${token}`);

    expect(response.status).toBe(201);
    expect(response.body.authenticated).toBe(false);
    expect(authService.logout).toHaveBeenCalledWith(token);
  });
});

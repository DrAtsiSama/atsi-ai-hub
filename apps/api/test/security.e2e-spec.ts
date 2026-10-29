import { configureApp } from '../src/configure-app.js';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AgentsService } from '../src/agents/agents.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import { LoginRateLimitService } from '../src/auth/login-rate-limit.service.js';

describe('Sécurité globale HTTP', () => {
  let app: INestApplication;

  const allowedOrigin = 'http://localhost:3000';
  const sessionToken = 'a'.repeat(64);
  const cookie = `atsi_admin_session=${sessionToken}`;

  const getSessionUser = vi.fn();

  const agentsService = {
    runDemo: vi.fn(),
    getJob: vi.fn(),
    getHistory: vi.fn(),
    getHistoryById: vi.fn(),
  };

  beforeAll(async () => {
    process.env.ATSI_ALLOWED_ORIGIN = allowedOrigin;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue({
        getSessionUser,
        login: vi.fn(),
        logout: vi.fn(),
      })
      .overrideProvider(AgentsService)
      .useValue(agentsService)
      .overrideProvider(DatabaseService)
      .useValue({
        query: vi.fn(),
      })
      .overrideProvider(LoginRateLimitService)
      .useValue({
        reserveAttempt: vi.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.ATSI_ALLOWED_ORIGIN;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    getSessionUser.mockResolvedValue({
      id: 'admin-test',
      username: 'atsi_admin',
    });

    agentsService.runDemo.mockResolvedValue({
      id: 'job-test',
    });

    agentsService.getHistory.mockResolvedValue([]);
  });

  it('refuse un POST provenant d une origine non autorisée', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/agents/demo/run')
      .set('Origin', 'https://origine-inconnue.example')
      .set('Cookie', cookie)
      .send({ instruction: 'test' });

    expect(response.status).toBe(403);
    expect(getSessionUser).not.toHaveBeenCalled();
    expect(agentsService.runDemo).not.toHaveBeenCalled();
  });

  it('refuse un POST sans session avec une origine autorisée', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/agents/demo/run')
      .set('Origin', allowedOrigin)
      .send({ instruction: 'test' });

    expect(response.status).toBe(401);
    expect(agentsService.runDemo).not.toHaveBeenCalled();
  });

  it('autorise un POST avec origine et session valides', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/agents/demo/run')
      .set('Origin', allowedOrigin)
      .set('Cookie', cookie)
      .send({ instruction: 'test' });

    expect(response.status).toBe(201);
    expect(getSessionUser).toHaveBeenCalledWith(sessionToken);
    expect(agentsService.runDemo).toHaveBeenCalledOnce();
  });

  it('refuse un GET protégé avec une session révoquée', async () => {
    getSessionUser.mockRejectedValue(
      new UnauthorizedException('Session révoquée'),
    );

    const response = await request(app.getHttpServer())
      .get('/api/agents/history')
      .set('Cookie', cookie);

    expect(response.status).toBe(401);
    expect(agentsService.getHistory).not.toHaveBeenCalled();
  });

  it('laisse la route publique accessible sans session', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health');

    expect(response.status).toBe(200);
  });
});

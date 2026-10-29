import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AgentsModule } from '../src/agents/agents.module.js';
import { AgentsService } from '../src/agents/agents.service.js';
import { AuthService } from '../src/auth/auth.service.js';

describe('Protection HTTP des agents', () => {
  let app: INestApplication;

  const getSessionUser = vi.fn();

  const agentsService = {
    runDemo: vi.fn().mockResolvedValue({ id: 'job-test' }),
    getJob: vi.fn().mockResolvedValue({ id: 'job-test' }),
    getHistory: vi.fn().mockResolvedValue([]),
    getHistoryById: vi.fn().mockResolvedValue({ id: 'history-test' }),
  };

  const cookie = `atsi_admin_session=${'a'.repeat(64)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AgentsModule],
    })
      .overrideProvider(AuthService)
      .useValue({ getSessionUser })
      .overrideProvider(AgentsService)
      .useValue(agentsService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const routes = [
    { method: 'post', path: '/agents/demo/run' },
    { method: 'get', path: '/agents/jobs/job-test' },
    { method: 'get', path: '/agents/history' },
    { method: 'get', path: '/agents/history/history-test' },
  ] as const;

  for (const route of routes) {
    it(`refuse ${route.method.toUpperCase()} ${route.path} sans session`, async () => {
      getSessionUser.mockReset();

      const response = route.method === 'post'
        ? await request(app.getHttpServer())
            .post(route.path)
            .send({ instruction: 'test' })
        : await request(app.getHttpServer()).get(route.path);

      expect(response.status).toBe(401);
      expect(getSessionUser).not.toHaveBeenCalled();
    });

    it(`autorise ${route.method.toUpperCase()} ${route.path} avec session valide`, async () => {
      getSessionUser.mockReset();
      getSessionUser.mockResolvedValue({
        id: 'admin-test',
        username: 'atsi_admin',
      });

      const response = route.method === 'post'
        ? await request(app.getHttpServer())
            .post(route.path)
            .set('Cookie', cookie)
            .send({ instruction: 'test' })
        : await request(app.getHttpServer())
            .get(route.path)
            .set('Cookie', cookie);

      expect(response.status).toBe(200 === response.status ? 200 : 201);
      expect(getSessionUser).toHaveBeenCalledWith('a'.repeat(64));
    });
  }

  it('refuse une session révoquée', async () => {
    getSessionUser.mockReset();
    getSessionUser.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get('/agents/history')
      .set('Cookie', cookie);

    expect(response.status).toBe(401);
  });
});

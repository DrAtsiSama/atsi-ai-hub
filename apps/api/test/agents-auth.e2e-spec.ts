import { configureApp } from '../src/configure-app.js';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AgentsModule } from '../src/agents/agents.module.js';
import { AgentsService } from '../src/agents/agents.service.js';
import { AgentRegistryService } from '../src/agents/agent-registry.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { DatabaseModule } from '../src/database/database.module.js';
import { DatabaseService } from '../src/database/database.service.js';

describe('Protection HTTP des agents', () => {
  let app: INestApplication;

  const getSessionUser = vi.fn();

  const agentsService = {
    runDemo: vi.fn().mockResolvedValue({ id: 'job-test' }),
    getJob: vi.fn().mockResolvedValue({ id: 'job-test' }),
    getHistory: vi.fn().mockResolvedValue([]),
    getHistoryById: vi.fn().mockResolvedValue({ id: 'history-test' }),
  };

  const agentRegistry = {
    findAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      key: 'test-agent',
      enabled: false,
      requiresApproval: true,
    }),
  };

  const cookie = `atsi_admin_session=${'a'.repeat(64)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, AgentsModule],
    })
      .overrideProvider(AuthService)
      .useValue({ getSessionUser })
      .overrideProvider(AgentsService)
      .useValue(agentsService)
      .overrideProvider(AgentRegistryService)
      .useValue(agentRegistry)
      .overrideProvider(DatabaseService)
      .useValue({ query: vi.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const routes = [
    { method: 'get', path: '/api/agents' },
    { method: 'post', path: '/api/agents' },
    { method: 'post', path: '/api/agents/demo/run' },
    { method: 'get', path: '/api/agents/jobs/job-test' },
    { method: 'get', path: '/api/agents/history' },
    { method: 'get', path: '/api/agents/history/history-test' },
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

  it('retourne la liste des agents depuis le registre', async () => {
    getSessionUser.mockReset();
    getSessionUser.mockResolvedValue({
      id: 'admin-test',
      username: 'atsi_admin',
    });

    agentRegistry.findAll.mockClear();

    const response = await request(app.getHttpServer())
      .get('/api/agents')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(agentRegistry.findAll).toHaveBeenCalledOnce();
  });

  it('transmet la création au registre', async () => {
    getSessionUser.mockReset();
    getSessionUser.mockResolvedValue({
      id: 'admin-test',
      username: 'atsi_admin',
    });

    agentRegistry.create.mockClear();

    const input = {
      key: 'test-agent',
      name: 'Agent de test',
      description: '',
      type: 'system',
      config: {},
      capabilities: ['demo.execute'],
    };

    const response = await request(app.getHttpServer())
      .post('/api/agents')
      .set('Cookie', cookie)
      .send(input);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      key: 'test-agent',
      enabled: false,
      requiresApproval: true,
    });
    expect(agentRegistry.create).toHaveBeenCalledWith(input);
  });

  it('refuse une session révoquée', async () => {
    getSessionUser.mockReset();
    getSessionUser.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get('/api/agents/history')
      .set('Cookie', cookie);

    expect(response.status).toBe(401);
  });
});

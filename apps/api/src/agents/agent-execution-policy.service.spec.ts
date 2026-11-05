import { describe, expect, it, vi } from 'vitest';
import { AgentExecutionPolicyService } from './agent-execution-policy.service.js';
import {
  AgentRegistryService,
  StoredAgent,
} from './agent-registry.service.js';

describe('AgentExecutionPolicyService', () => {
  const agentId = '00000000-0000-4000-8000-000000000001';

  function createService(agent: StoredAgent | null) {
    const findById = vi.fn().mockResolvedValue(agent);

    const registry = {
      findById,
    } as unknown as AgentRegistryService;

    return {
      service: new AgentExecutionPolicyService(registry),
      findById,
    };
  }

  function createAgent(
    overrides: Partial<StoredAgent> = {},
  ): StoredAgent {
    return {
      id: agentId,
      key: 'test-agent',
      name: 'Agent de test',
      description: '',
      type: 'system',
      enabled: true,
      config: { settings: { mode: 'safe' } },
      configVersion: 1,
      capabilities: ['demo.execute'],
      requiresApproval: false,
      createdAt: '2026-11-03T12:00:00.000Z',
      updatedAt: '2026-11-03T12:00:00.000Z',
      ...overrides,
    };
  }

  it('rejects an unknown agent', async () => {
    const { service, findById } = createService(null);

    await expect(
      service.prepare(agentId, 'demo.execute'),
    ).rejects.toMatchObject({ status: 404 });

    expect(findById).toHaveBeenCalledWith(agentId);
  });

  it('rejects a disabled agent', async () => {
    const { service } = createService(
      createAgent({ enabled: false }),
    );

    await expect(
      service.prepare(agentId, 'demo.execute'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects an agent requiring human approval', async () => {
    const { service } = createService(
      createAgent({ requiresApproval: true }),
    );

    await expect(
      service.prepare(agentId, 'demo.execute'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects an unauthorized capability', async () => {
    const { service } = createService(createAgent());

    await expect(
      service.prepare(agentId, 'employment.offers.analyze'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('prepares an authorized execution', async () => {
    const { service } = createService(createAgent());

    const result = await service.prepare(
      agentId,
      'demo.execute',
    );

    expect(result).toMatchObject({
      agentId,
      agentKey: 'test-agent',
      agentName: 'Agent de test',
      capability: 'demo.execute',
      configVersion: 1,
      configSnapshot: { settings: { mode: 'safe' } },
    });
  });

  it('keeps an independent configuration snapshot', async () => {
    const agent = createAgent();
    const { service } = createService(agent);

    const prepared = await service.prepare(
      agentId,
      'demo.execute',
    );

    const settings = agent.config['settings'] as {
      mode: string;
    };

    settings.mode = 'changed';

    expect(prepared.configSnapshot).toEqual({
      settings: { mode: 'safe' },
    });
  });
});

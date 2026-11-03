import { describe, expect, it, vi } from 'vitest';
import { AgentRegistryService } from './agent-registry.service.js';
import { DatabaseService } from '../database/database.service.js';

describe('AgentRegistryService', () => {
  const agentRow = {
    id: '00000000-0000-4000-8000-000000000001',
    key: 'demo-agent',
    name: 'Agent de démonstration',
    description: 'Agent système de test',
    type: 'system',
    enabled: true,
    config: {},
    config_version: 1,
    capabilities: ['demo.execute'],
    requires_approval: false,
    created_at: new Date('2026-11-03T12:00:00.000Z'),
    updated_at: new Date('2026-11-03T12:00:00.000Z'),
  };

  function createService(rows: unknown[]) {
    const query = vi.fn().mockResolvedValue({ rows });

    const database = {
      query,
    } as unknown as DatabaseService;

    return {
      service: new AgentRegistryService(database),
      query,
    };
  }

  it('creates a disabled agent with mandatory approval', async () => {
    const { service, query } = createService([agentRow]);

    const result = await service.create({
      key: 'demo-agent',
      name: 'Agent de démonstration',
      description: 'Agent système de test',
      type: 'system',
      enabled: true,
      config: {},
      capabilities: ['demo.execute'],
      requiresApproval: false,
    });

    expect(result.key).toBe('demo-agent');

    expect(query).toHaveBeenCalledOnce();

    const [sql, params] = query.mock.calls[0] as [
      string,
      unknown[],
    ];

    expect(sql).toContain('INSERT INTO agents');
    expect(sql).toContain('RETURNING *');

    expect(params[5]).toBe(false);
    expect(params[7]).toBe(1);
    expect(params[9]).toBe(true);
  });

  it('returns HTTP 409 when an agent key already exists', async () => {
    const { service, query } = createService([]);

    query.mockRejectedValueOnce({
      code: '23505',
      constraint: 'agents_key_key',
    });

    await expect(
      service.create({
        key: 'demo-agent',
        name: 'Agent de démonstration',
        description: '',
        type: 'system',
        config: {},
        capabilities: ['demo.execute'],
      }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it('preserves PostgreSQL errors from other constraints', async () => {
    const { service, query } = createService([]);

    const databaseError = {
      code: '23505',
      constraint: 'another_unique_constraint',
    };

    query.mockRejectedValueOnce(databaseError);

    await expect(
      service.create({
        key: 'demo-agent',
        name: 'Agent de démonstration',
        description: '',
        type: 'system',
        config: {},
        capabilities: ['demo.execute'],
      }),
    ).rejects.toBe(databaseError);
  });

  it('rejects invalid agents before querying PostgreSQL', async () => {
    const { service, query } = createService([]);

    await expect(
      service.create({
        key: 'INVALID KEY',
        name: 'Agent invalide',
        description: '',
        type: 'system',
        config: {},
        capabilities: [],
      }),
    ).rejects.toMatchObject({
      status: 400,
    });

    expect(query).not.toHaveBeenCalled();
  });

  it('returns all agents with camelCase properties', async () => {
    const { service, query } = createService([agentRow]);

    const agents = await service.findAll();

    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({
      key: 'demo-agent',
      configVersion: 1,
      capabilities: ['demo.execute'],
      requiresApproval: false,
      createdAt: '2026-11-03T12:00:00.000Z',
    });

    expect(query).toHaveBeenCalledOnce();
  });

  it('finds an agent by its unique key', async () => {
    const { service, query } = createService([agentRow]);

    const agent = await service.findByKey('demo-agent');

    expect(agent?.key).toBe('demo-agent');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE key = $1'),
      ['demo-agent'],
    );
  });

  it('returns null when the agent does not exist', async () => {
    const { service } = createService([]);

    const agent = await service.findByKey('unknown-agent');

    expect(agent).toBeNull();
  });

  it('returns an empty list when no agents are registered', async () => {
    const { service } = createService([]);

    const agents = await service.findAll();

    expect(agents).toEqual([]);
  });
});

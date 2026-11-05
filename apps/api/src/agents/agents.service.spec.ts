import { describe, expect, it, vi } from 'vitest';
import { AgentsService } from './agents.service.js';
import { DatabaseService } from '../database/database.service.js';
import { AgentExecutionPolicyService } from './agent-execution-policy.service.js';

describe('AgentsService - registered agents', () => {
  it('delegates preparation to the execution policy without database writes', async () => {
    const agentId = '00000000-0000-4000-8000-000000000001';

    const prepared = {
      agentId,
      agentKey: 'test-agent',
      agentName: 'Agent de test',
      capability: 'demo.execute',
      configVersion: 1,
      configSnapshot: {},
    };

    const query = vi.fn();
    const prepare = vi.fn().mockResolvedValue(prepared);

    const database = {
      query,
    } as unknown as DatabaseService;

    const executionPolicy = {
      prepare,
    } as unknown as AgentExecutionPolicyService;

    const service = new AgentsService(
      database,
      executionPolicy,
    );

    try {
      const result = await service.prepareRegisteredAgent(
        agentId,
        'demo.execute',
      );

      expect(result).toEqual(prepared);
      expect(prepare).toHaveBeenCalledExactlyOnceWith(
        agentId,
        'demo.execute',
      );
      expect(query).not.toHaveBeenCalled();
    } finally {
      await service.onModuleDestroy();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { buildAgentRunInsert } from './agent-run-persistence.js';
import { PreparedAgentRunRecord } from './agent-run-record.js';

describe('buildAgentRunInsert', () => {
  function createRecord(
    overrides: Partial<PreparedAgentRunRecord> = {},
  ): PreparedAgentRunRecord {
    return {
      id: '00000000-0000-4000-8000-000000000002',
      agentId: '00000000-0000-4000-8000-000000000001',
      agentName: 'employment-agent',
      instruction: 'Analyser une offre',
      configVersion: 3,
      configSnapshot: {
        settings: { mode: 'safe' },
      },
      ...overrides,
    };
  }

  it('builds an INSERT with seven placeholders', () => {
    const query = buildAgentRunInsert(createRecord());

    expect(query.text).toContain('INSERT INTO agent_runs');
    expect(query.text).toContain(
      'VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)',
    );
    expect(query.values).toHaveLength(7);
  });

  it('preserves the correct parameter order', () => {
    const record = createRecord();
    const query = buildAgentRunInsert(record);

    expect(query.values).toEqual([
      record.id,
      record.agentId,
      record.agentName,
      record.instruction,
      'queued',
      record.configVersion,
      JSON.stringify(record.configSnapshot),
    ]);
  });

  it('serializes the configuration snapshot as JSON', () => {
    const record = createRecord({
      configSnapshot: {
        settings: { mode: 'safe', retries: 2 },
      },
    });

    const query = buildAgentRunInsert(record);

    expect(JSON.parse(query.values[6])).toEqual(
      record.configSnapshot,
    );
  });

  it('keeps untrusted instruction text out of SQL', () => {
    const instruction = "test'); DROP TABLE agents; --";

    const query = buildAgentRunInsert(
      createRecord({ instruction }),
    );

    expect(query.text).not.toContain(instruction);
    expect(query.values[3]).toBe(instruction);
  });
});

import { describe, expect, it } from 'vitest';
import { buildAgentRunJob } from './agent-run-job.js';
import { PreparedAgentRunRecord } from './agent-run-record.js';

describe('buildAgentRunJob', () => {
  function createRecord(
    overrides: Partial<PreparedAgentRunRecord> = {},
  ): PreparedAgentRunRecord {
    return {
      id: '00000000-0000-4000-8000-000000000002',
      agentId: '00000000-0000-4000-8000-000000000001',
      agentName: 'demo-agent',
      instruction: 'Tester le moteur',
      configVersion: 1,
      configSnapshot: {},
      ...overrides,
    };
  }

  it('builds a compatible demo-agent job', () => {
    const record = createRecord();
    const job = buildAgentRunJob(record);

    expect(job).toEqual({
      name: 'demo-agent',
      data: {
        runId: record.id,
        instruction: record.instruction,
      },
      options: {
        jobId: record.id,
      },
    });
  });

  it('uses the run UUID as a stable BullMQ job ID', () => {
    const record = createRecord();

    const first = buildAgentRunJob(record);
    const second = buildAgentRunJob(record);

    expect(first.options.jobId).toBe(record.id);
    expect(second.options.jobId).toBe(record.id);
  });

  it('rejects business agents not supported by the worker', () => {
    expect(() =>
      buildAgentRunJob(
        createRecord({ agentName: 'employment-agent' }),
      ),
    ).toThrow('Exécution des agents métier non disponible');
  });

  it('rejects invalid instructions', () => {
    expect(() =>
      buildAgentRunJob(createRecord({ instruction: '   ' })),
    ).toThrow('Instruction non valide');

    expect(() =>
      buildAgentRunJob(
        createRecord({ instruction: 'a'.repeat(2001) }),
      ),
    ).toThrow('Instruction non valide');
  });

  it('trims instruction whitespace', () => {
    const job = buildAgentRunJob(
      createRecord({ instruction: '  Tester le moteur  ' }),
    );

    expect(job.data.instruction).toBe('Tester le moteur');
  });
});

import { describe, expect, it } from 'vitest';
import { createAgentRunRecord } from './agent-run-record.js';
import { PreparedAgentExecution } from './agent-execution-policy.service.js';

describe('createAgentRunRecord', () => {
  function createExecution(): PreparedAgentExecution {
    return {
      agentId: '00000000-0000-4000-8000-000000000001',
      agentKey: 'employment-agent',
      agentName: 'Agent Emploi',
      capability: 'employment.offers.analyze',
      configVersion: 3,
      configSnapshot: {
        settings: { mode: 'safe' },
      },
    };
  }

  it('generates a valid UUID', () => {
    const record = createAgentRunRecord(
      createExecution(),
      'Analyser une offre',
    );

    expect(record.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('preserves agent metadata and instruction', () => {
    const execution = createExecution();

    const record = createAgentRunRecord(
      execution,
      'Analyser une offre',
    );

    expect(record).toMatchObject({
      agentId: execution.agentId,
      agentName: 'employment-agent',
      instruction: 'Analyser une offre',
      configVersion: 3,
      configSnapshot: {
        settings: { mode: 'safe' },
      },
    });
  });

  it('creates an independent configuration snapshot', () => {
    const execution = createExecution();

    const record = createAgentRunRecord(
      execution,
      'Analyser une offre',
    );

    const settings = execution.configSnapshot.settings as {
      mode: string;
    };

    settings.mode = 'changed';

    expect(record.configSnapshot).toEqual({
      settings: { mode: 'safe' },
    });
  });

  it('rejects an empty instruction', () => {
    expect(() =>
      createAgentRunRecord(createExecution(), ''),
    ).toThrow('Instruction non valide');
  });

  it('rejects a whitespace-only instruction', () => {
    expect(() =>
      createAgentRunRecord(createExecution(), '   '),
    ).toThrow('Instruction non valide');
  });

  it('rejects an instruction longer than 2000 characters', () => {
    expect(() =>
      createAgentRunRecord(createExecution(), 'a'.repeat(2001)),
    ).toThrow('Instruction trop longue');
  });

  it('trims surrounding whitespace', () => {
    const record = createAgentRunRecord(
      createExecution(),
      '  Analyser une offre  ',
    );

    expect(record.instruction).toBe('Analyser une offre');
  });

  it('generates a different UUID for each execution', () => {
    const execution = createExecution();

    const first = createAgentRunRecord(
      execution,
      'Première exécution',
    );

    const second = createAgentRunRecord(
      execution,
      'Deuxième exécution',
    );

    expect(first.id).not.toBe(second.id);
  });
});

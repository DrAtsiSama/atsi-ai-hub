import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import { AgentRunPersistenceService } from './agent-run-persistence.service.js';
import { PreparedAgentRunRecord } from './agent-run-record.js';
import { buildAgentRunInsert } from './agent-run-persistence.js';

describe('AgentRunPersistenceService', () => {
  function createRecord(): PreparedAgentRunRecord {
    return {
      id: '00000000-0000-4000-8000-000000000002',
      agentId: '00000000-0000-4000-8000-000000000001',
      agentName: 'employment-agent',
      instruction: 'Analyser une offre',
      configVersion: 3,
      configSnapshot: {
        settings: { mode: 'safe' },
      },
    };
  }

  function createService() {
    const query = vi.fn().mockResolvedValue({
      rows: [],
      rowCount: 1,
    });

    const database = {
      query,
    } as unknown as DatabaseService;

    return {
      service: new AgentRunPersistenceService(database),
      query,
    };
  }

  it('inserts the prepared run with seven SQL parameters', async () => {
    const { service, query } = createService();
    const record = createRecord();
    const expected = buildAgentRunInsert(record);

    await service.insertPreparedRun(record);

    expect(query).toHaveBeenCalledExactlyOnceWith(
      expected.text,
      expected.values,
    );
    expect(expected.values).toHaveLength(7);
  });

  it('propagates PostgreSQL errors', async () => {
    const { service, query } = createService();
    const error = new Error('PostgreSQL unavailable');

    query.mockRejectedValueOnce(error);

    await expect(
      service.insertPreparedRun(createRecord()),
    ).rejects.toBe(error);
  });

  it('records the BullMQ job ID', async () => {
    const { service, query } = createService();
    const runId = createRecord().id;

    const updated = await service.markPublished(runId, runId);

    expect(updated).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);

    const [sql, values] = query.mock.calls[0];

    expect(sql).toContain('SET job_id = $2');
    expect(sql).toContain('WHERE id = $1');
    expect(values).toEqual([runId, runId]);
  });

  it('preserves existing execution statuses', async () => {
    const { service, query } = createService();
    const runId = createRecord().id;

    await service.markPublished(runId, runId);

    const [sql] = query.mock.calls[0];

    expect(sql).toContain(
      "status IN ('queued', 'running', 'completed')",
    );
    expect(sql).not.toMatch(/SET\s+status\s*=/i);
    expect(sql).toContain('job_id IS NULL');
  });

  it('returns false when the job ID cannot be recorded', async () => {
    const { service, query } = createService();

    query.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const updated = await service.markPublished(
      createRecord().id,
      'job-123',
    );

    expect(updated).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('propagates database errors when recording a job ID', async () => {
    const { service, query } = createService();
    const error = new Error('PostgreSQL unavailable');

    query.mockRejectedValueOnce(error);

    await expect(
      service.markPublished(createRecord().id, 'job-123'),
    ).rejects.toBe(error);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('marks an unpublished queued run as failed', async () => {
    const { service, query } = createService();
    const runId = createRecord().id;

    const updated = await service.markPublicationFailed(runId);

    expect(updated).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);

    const [sql, values] = query.mock.calls[0];

    expect(sql).toContain("status = 'failed'");
    expect(sql).toContain("status = 'queued'");
    expect(sql).toContain('job_id IS NULL');
    expect(sql).toContain('RETURNING id');
    expect(values).toEqual([runId]);
  });

  it('returns false when the run cannot be marked as failed', async () => {
    const { service, query } = createService();

    query.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const updated = await service.markPublicationFailed(
      createRecord().id,
    );

    expect(updated).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('propagates database errors when marking publication failure', async () => {
    const { service, query } = createService();
    const error = new Error('PostgreSQL unavailable');

    query.mockRejectedValueOnce(error);

    await expect(
      service.markPublicationFailed(createRecord().id),
    ).rejects.toBe(error);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not retry automatically after a database error', async () => {
    const { service, query } = createService();

    query.mockRejectedValueOnce(
      new Error('Database connection lost'),
    );

    await expect(
      service.insertPreparedRun(createRecord()),
    ).rejects.toThrow('Database connection lost');

    expect(query).toHaveBeenCalledTimes(1);
  });
});

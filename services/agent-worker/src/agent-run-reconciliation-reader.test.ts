import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentRunReconciliationQuery,
  inspectAgentRun,
} from './agent-run-reconciliation-reader.js';

type DatabaseRow = {
  status: unknown;
  job_id: unknown;
};

function createDatabase(
  rows: DatabaseRow[],
  onQuery?: (sql: string, values: string[]) => void,
) {
  return {
    async query(sql: string, values: string[]) {
      onQuery?.(sql, values);
      return { rowCount: rows.length, rows };
    },
  };
}

function createBullMq(
  state: 'waiting' | 'active' | 'completed' | 'failed' | null,
  onRead?: (jobId: string) => void,
) {
  return {
    async getJobState(jobId: string) {
      onRead?.(jobId);
      return state;
    },
  };
}

test('reads execution using a parameterized query', async () => {
  let queried = false;

  await inspectAgentRun(
    createDatabase(
      [{ status: 'queued', job_id: 'job-1' }],
      (sql, values) => {
        assert.equal(sql, agentRunReconciliationQuery);
        assert.deepEqual(values, ['run-1']);
        queried = true;
      },
    ),
    createBullMq('waiting'),
    'run-1',
  );

  assert.equal(queried, true);
});

test('reports compatible states', async () => {
  const result = await inspectAgentRun(
    createDatabase([{ status: 'running', job_id: 'job-1' }]),
    createBullMq('active'),
    'run-1',
  );

  assert.deepEqual(
    [result.runId, result.jobId, result.status],
    ['run-1', 'job-1', 'consistent'],
  );
});

test('reports divergent states', async () => {
  const result = await inspectAgentRun(
    createDatabase([{ status: 'running', job_id: 'job-1' }]),
    createBullMq('failed'),
    'run-1',
  );

  assert.equal(result.status, 'manual-review-required');
});

test('reports missing PostgreSQL execution', async () => {
  const result = await inspectAgentRun(
    createDatabase([]),
    createBullMq('waiting'),
    'run-1',
  );

  assert.equal(result.status, 'indeterminate');
});

test('reports invalid PostgreSQL state', async () => {
  const result = await inspectAgentRun(
    createDatabase([{ status: 'invalid', job_id: 'job-1' }]),
    createBullMq('waiting'),
    'run-1',
  );

  assert.equal(result.status, 'indeterminate');
});

test('reports missing BullMQ job ID without reading BullMQ', async () => {
  let readCalled = false;

  const result = await inspectAgentRun(
    createDatabase([{ status: 'queued', job_id: null }]),
    createBullMq('waiting', () => {
      readCalled = true;
    }),
    'run-1',
  );

  assert.equal(result.status, 'indeterminate');
  assert.equal(readCalled, false);
});

test('reports missing BullMQ job', async () => {
  const result = await inspectAgentRun(
    createDatabase([{ status: 'queued', job_id: 'job-1' }]),
    createBullMq(null),
    'run-1',
  );

  assert.equal(result.status, 'indeterminate');
});

test('propagates PostgreSQL read errors', async () => {
  const database = {
    async query(): Promise<{
      rowCount: number;
      rows: DatabaseRow[];
    }> {
      throw new Error('PostgreSQL unavailable');
    },
  };

  await assert.rejects(
    inspectAgentRun(database, createBullMq(null), 'run-1'),
    /PostgreSQL unavailable/,
  );
});

test('propagates BullMQ read errors', async () => {
  const bullmq = {
    async getJobState(): Promise<null> {
      throw new Error('Redis unavailable');
    },
  };

  await assert.rejects(
    inspectAgentRun(
      createDatabase([{ status: 'queued', job_id: 'job-1' }]),
      bullmq,
      'run-1',
    ),
    /Redis unavailable/,
  );
});

test('reports ambiguous PostgreSQL results', async () => {
  const result = await inspectAgentRun(
    createDatabase([
      { status: 'queued', job_id: 'job-1' },
      { status: 'queued', job_id: 'job-2' },
    ]),
    createBullMq('waiting'),
    'run-1',
  );

  assert.equal(result.status, 'indeterminate');
});

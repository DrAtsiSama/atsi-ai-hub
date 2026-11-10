import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseBullMqJobState,
} from './agent-run-reconciliation-adapter.js';

for (const state of [
  'waiting',
  'waiting-children',
  'delayed',
  'prioritized',
  'active',
  'completed',
  'failed',
  'unknown',
]) {
  test(`accepts BullMQ state: ${state}`, () => {
    assert.equal(parseBullMqJobState(state), state);
  });
}

test('rejects unsupported BullMQ states', () => {
  assert.equal(parseBullMqJobState('unsupported'), 'unknown');
});

test('rejects non-string BullMQ states', () => {
  assert.equal(parseBullMqJobState(null), 'unknown');
  assert.equal(parseBullMqJobState(42), 'unknown');
});

import {
  inspectAgentRunWithServices,
  type BullMqJobLookup,
} from './agent-run-reconciliation-adapter.js';
import type { Pool } from 'pg';
import type { Queue } from 'bullmq';

type MockRow = {
  status: unknown;
  job_id: unknown;
};

function mockDatabase(row: MockRow | null) {
  return {
    async query(sql: string, values: unknown[]) {
      assert.match(sql, /SELECT status, job_id/);
      assert.deepEqual(values, ['run-1']);

      return {
        rowCount: row === null ? 0 : 1,
        rows: row === null ? [] : [row],
      };
    },
  } as unknown as Pick<Pool, 'query'>;
}

const mockQueue = {} as Queue;

test('adapter reads compatible PostgreSQL and BullMQ states', async () => {
  const findJob: BullMqJobLookup = async (_queue, jobId) => {
    assert.equal(jobId, 'job-1');
    return { getState: async () => 'active' };
  };

  const report = await inspectAgentRunWithServices(
    mockDatabase({ status: 'running', job_id: 'job-1' }),
    mockQueue,
    'run-1',
    findJob,
  );

  assert.equal(report.status, 'consistent');
  assert.equal(report.jobId, 'job-1');
});

test('adapter reports divergent states', async () => {
  const report = await inspectAgentRunWithServices(
    mockDatabase({ status: 'running', job_id: 'job-1' }),
    mockQueue,
    'run-1',
    async () => ({ getState: async () => 'failed' }),
  );

  assert.equal(report.status, 'manual-review-required');
});

test('adapter reports missing BullMQ jobs', async () => {
  const report = await inspectAgentRunWithServices(
    mockDatabase({ status: 'queued', job_id: 'job-1' }),
    mockQueue,
    'run-1',
    async () => null,
  );

  assert.equal(report.status, 'indeterminate');
});

test('adapter reports unknown BullMQ states', async () => {
  const report = await inspectAgentRunWithServices(
    mockDatabase({ status: 'queued', job_id: 'job-1' }),
    mockQueue,
    'run-1',
    async () => ({ getState: async () => 'unexpected' }),
  );

  assert.equal(report.status, 'indeterminate');
});

test('adapter does not read BullMQ for missing executions', async () => {
  let called = false;

  const report = await inspectAgentRunWithServices(
    mockDatabase(null),
    mockQueue,
    'run-1',
    async () => {
      called = true;
      return null;
    },
  );

  assert.equal(report.status, 'indeterminate');
  assert.equal(called, false);
});

test('adapter propagates BullMQ lookup errors', async () => {
  await assert.rejects(
    inspectAgentRunWithServices(
      mockDatabase({ status: 'queued', job_id: 'job-1' }),
      mockQueue,
      'run-1',
      async () => {
        throw new Error('Redis unavailable');
      },
    ),
    /Redis unavailable/,
  );
});

test('adapter propagates BullMQ state errors', async () => {
  await assert.rejects(
    inspectAgentRunWithServices(
      mockDatabase({ status: 'queued', job_id: 'job-1' }),
      mockQueue,
      'run-1',
      async () => ({
        getState: async () => {
          throw new Error('State read failed');
        },
      }),
    ),
    /State read failed/,
  );
});

test('adapter propagates PostgreSQL errors', async () => {
  const database = {
    async query(): Promise<never> {
      throw new Error('PostgreSQL unavailable');
    },
  } as unknown as Pick<Pool, 'query'>;

  await assert.rejects(
    inspectAgentRunWithServices(
      database,
      mockQueue,
      'run-1',
      async () => null,
    ),
    /PostgreSQL unavailable/,
  );
});

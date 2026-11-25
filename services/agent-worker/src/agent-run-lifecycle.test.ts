import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';

import {
  startAgentRun,
  completeAgentRun,
  failAgentRun,
} from './agent-run-lifecycle.js';

import {
  agentRunTransitions,
} from './agent-run-transitions.js';

import {
  AgentJobValidationError,
} from './agent-job-validation-error.js';

import {
  AgentRunCommitUncertainError,
} from './agent-run-event-transaction.js';

const runId = '123e4567-e89b-12d3-a456-426614174000';

function mockDatabase() {
  const calls: {
    sql: string;
    values: unknown[];
  }[] = [];

  let connections = 0;

  const client = {
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });

      return {
        rowCount: 1,
        rows: [{ id: runId }],
      };
    },

    release() {},
  };

  const database = {
    async connect() {
      connections++;
      return client;
    },

    async query(sql: string, values: unknown[] = []) {
      return client.query(sql, values);
    },
  } as unknown as Pick<Pool, 'connect' | 'query'>;

  return {
    database,
    calls,
    connections: () => connections,
  };
}

test('starts execution with matching event', async () => {
  const { database, calls } = mockDatabase();

  await startAgentRun(database, runId);

  assert.equal(calls[0].sql, 'BEGIN');
  assert.equal(calls[1].sql, agentRunTransitions.start);
  assert.deepEqual(calls[1].values, [runId]);

  assert.equal(calls[2].values[1], runId);
  assert.equal(calls[2].values[2], 'run_started');
  assert.equal(calls[2].values[3], 'info');

  assert.equal(calls[3].sql, 'COMMIT');
});

test('completes execution with matching event', async () => {
  const { database, calls } = mockDatabase();

  const result = { success: true };

  await completeAgentRun(database, runId, result);

  assert.equal(calls[1].sql, agentRunTransitions.complete);

  assert.deepEqual(calls[1].values, [
    runId,
    JSON.stringify(result),
  ]);

  assert.equal(calls[2].values[2], 'run_completed');
  assert.equal(calls[2].values[3], 'info');
});

test('fails running execution without exposing raw error', async () => {
  const { database, calls } = mockDatabase();

  const sensitiveMessage = 'PRIVATE_TEST_VALUE';

  assert.equal(
    await failAgentRun(
      database,
      runId,
      new Error(sensitiveMessage),
    ),
    true,
  );

  assert.equal(calls[1].sql, agentRunTransitions.fail);
  assert.equal(calls[2].values[2], 'run_failed');
  assert.equal(calls[2].values[3], 'error');

  assert.equal(
    JSON.stringify(calls).includes(sensitiveMessage),
    false,
  );
});

test('rejects invalid mission before start', async () => {
  const { database, calls } = mockDatabase();

  assert.equal(
    await failAgentRun(
      database,
      runId,
      new AgentJobValidationError('Invalid mission'),
    ),
    true,
  );

  assert.equal(
    calls[1].sql,
    agentRunTransitions.rejectBeforeStart,
  );

  assert.equal(calls[2].values[2], 'run_failed');
});

test('does not modify execution after uncertain commit', async () => {
  const { database, calls, connections } = mockDatabase();

  const error = new AgentRunCommitUncertainError(
    new Error('Connection lost'),
  );

  assert.equal(
    await failAgentRun(database, runId, error),
    null,
  );

  assert.equal(connections(), 0);
  assert.deepEqual(calls, []);
});

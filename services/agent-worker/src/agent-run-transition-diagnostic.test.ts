import assert from 'node:assert/strict';
import test from 'node:test';

import { createTransitionRejectedError } from './agent-run-transition-diagnostic.js';
import { AgentRunTransitionRejectedError } from './agent-run-transition-error.js';
import { agentRunStateQuery } from './agent-run-state.js';

const runId = '00000000-0000-0000-0000-000000000001';

test('reports the current PostgreSQL state', async () => {
  const database = {
    async query() {
      return { rowCount: 1, rows: [{ status: 'completed' }] };
    },
  };

  const error = await createTransitionRejectedError(
    database,
    runId,
    'queued -> running',
  );

  assert.ok(error instanceof AgentRunTransitionRejectedError);
  assert.equal(error.runId, runId);
  assert.equal(error.transition, 'queued -> running');
  assert.equal(error.currentState, 'completed');
});

test('reports missing executions', async () => {
  const database = {
    async query() {
      return { rowCount: 0, rows: [] };
    },
  };

  const error = await createTransitionRejectedError(
    database,
    runId,
    'running -> completed',
  );

  assert.equal(error.currentState, null);
});

test('rejects unknown PostgreSQL states', async () => {
  const database = {
    async query() {
      return { rowCount: 1, rows: [{ status: 'unknown' }] };
    },
  };

  const error = await createTransitionRejectedError(
    database,
    runId,
    'running -> completed',
  );

  assert.equal(error.currentState, null);
});

test('reads the execution state using a parameterized query', async () => {
  let capturedSql = '';
  let capturedValues: string[] = [];

  const database = {
    async query(sql: string, values: string[]) {
      capturedSql = sql;
      capturedValues = values;
      return { rowCount: 1, rows: [{ status: 'failed' }] };
    },
  };

  await createTransitionRejectedError(
    database,
    runId,
    'queued -> running',
  );

  assert.equal(capturedSql, agentRunStateQuery);
  assert.deepEqual(capturedValues, [runId]);
});

test('running state reports manual recovery required', async () => {
  const database = {
    async query() {
      return { rowCount: 1, rows: [{ status: 'running' }] };
    },
  };

  const error = await createTransitionRejectedError(
    database,
    runId,
    'queued -> running',
  );

  assert.match(error.message, /manual-recovery-required/);
  assert.equal(error.currentState, 'running');
});

test('completed state reports already completed', async () => {
  const database = {
    async query() {
      return { rowCount: 1, rows: [{ status: 'completed' }] };
    },
  };

  const error = await createTransitionRejectedError(
    database,
    runId,
    'queued -> running',
  );

  assert.match(error.message, /already-completed/);
});

test('missing execution reports inconsistent state', async () => {
  const database = {
    async query() {
      return { rowCount: 0, rows: [] };
    },
  };

  const error = await createTransitionRejectedError(
    database,
    runId,
    'queued -> running',
  );

  assert.match(error.message, /inconsistent-state/);
});

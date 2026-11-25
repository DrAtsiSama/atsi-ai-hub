import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';

import {
  executeAgentRunStep,
} from './agent-run-step.js';

const runId = '123e4567-e89b-12d3-a456-426614174000';

function mockDatabase(failOn?: string) {
  const events: string[] = [];

  const database = {
    async query(_sql: string, values: unknown[]) {
      const eventType = String(values[2]);

      events.push(eventType);

      if (eventType === failOn) {
        throw new Error('Database failure');
      }

      return { rowCount: 1, rows: [] };
    },
  } as unknown as Pick<Pool, 'query'>;

  return { database, events };
}

test('logs successful step and returns result', async () => {
  const { database, events } = mockDatabase();

  const result = await executeAgentRunStep(
    database,
    runId,
    'test-step',
    async () => 42,
  );

  assert.equal(result, 42);

  assert.deepEqual(events, [
    'step_started',
    'step_completed',
  ]);
});

test('logs failed step and preserves original error', async () => {
  const { database, events } = mockDatabase();
  const originalError = new Error('Action failure');

  await assert.rejects(
    executeAgentRunStep(
      database,
      runId,
      'test-step',
      async () => {
        throw originalError;
      },
    ),
    error => error === originalError,
  );

  assert.deepEqual(events, [
    'step_started',
    'step_failed',
  ]);
});

test('does not execute action when initial logging fails', async () => {
  const { database, events } = mockDatabase('step_started');
  let executed = false;

  await assert.rejects(
    executeAgentRunStep(
      database,
      runId,
      'test-step',
      async () => {
        executed = true;
      },
    ),
    /Database failure/,
  );

  assert.equal(executed, false);
  assert.deepEqual(events, ['step_started']);
});

test('preserves action error when failure logging fails', async () => {
  const { database, events } = mockDatabase('step_failed');
  const originalError = new Error('Original action failure');

  await assert.rejects(
    executeAgentRunStep(
      database,
      runId,
      'test-step',
      async () => {
        throw originalError;
      },
    ),
    error => error === originalError,
  );

  assert.deepEqual(events, [
    'step_started',
    'step_failed',
  ]);
});

test('does not report success when completion logging fails', async () => {
  const { database, events } = mockDatabase('step_completed');

  await assert.rejects(
    executeAgentRunStep(
      database,
      runId,
      'test-step',
      async () => 42,
    ),
    /Database failure/,
  );

  assert.deepEqual(events, [
    'step_started',
    'step_completed',
  ]);
});

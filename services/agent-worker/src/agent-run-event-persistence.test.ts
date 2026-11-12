import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';

import {
  insertAgentRunEvent,
  insertAgentRunEventQuery,
} from './agent-run-event-persistence.js';

const runId = '123e4567-e89b-12d3-a456-426614174000';

test('inserts an event with parameterized SQL', async () => {
  let calls = 0;

  const database = {
    async query(sql: string, values: unknown[]) {
      calls++;

      assert.equal(sql, insertAgentRunEventQuery);
      assert.match(sql, /INSERT INTO agent_run_events/);
      assert.match(sql, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6\)/);

      assert.match(
        values[0] as string,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );

      assert.deepEqual(values.slice(1), [
        runId,
        'run_started',
        'info',
        null,
        'Exécution démarrée',
      ]);

      return { rowCount: 1, rows: [] };
    },
  } as unknown as Pick<Pool, 'query'>;

  const eventId = await insertAgentRunEvent(database, {
    runId,
    eventType: 'run_started',
    level: 'info',
    message: 'Exécution démarrée',
  });

  assert.match(eventId, /^[0-9a-f-]{36}$/);
  assert.equal(calls, 1);
});

test('inserts a business step identifier', async () => {
  const database = {
    async query(_sql: string, values: unknown[]) {
      assert.equal(values[4], 'job-search');
      return { rowCount: 1, rows: [] };
    },
  } as unknown as Pick<Pool, 'query'>;

  await insertAgentRunEvent(database, {
    runId,
    eventType: 'step_started',
    level: 'info',
    stepKey: 'job-search',
    message: 'Recherche démarrée',
  });
});

test('rejects invalid events before querying PostgreSQL', async () => {
  let called = false;

  const database = {
    async query() {
      called = true;
      throw new Error('Should not be called');
    },
  } as unknown as Pick<Pool, 'query'>;

  await assert.rejects(
    insertAgentRunEvent(database, {
      runId,
      eventType: 'run_started',
      level: 'info',
      message: '',
    }),
    /Message d’événement vide/,
  );

  assert.equal(called, false);
});

test('propagates PostgreSQL errors', async () => {
  const database = {
    async query(): Promise<never> {
      throw new Error('PostgreSQL unavailable');
    },
  } as unknown as Pick<Pool, 'query'>;

  await assert.rejects(
    insertAgentRunEvent(database, {
      runId,
      eventType: 'run_failed',
      level: 'error',
      message: 'Exécution échouée',
    }),
    /PostgreSQL unavailable/,
  );
});

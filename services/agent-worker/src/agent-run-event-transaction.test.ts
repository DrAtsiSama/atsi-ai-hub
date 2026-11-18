import assert from 'node:assert/strict';
import test from 'node:test';

import type { Pool } from 'pg';

import {
  executeAgentRunEventTransaction,
} from './agent-run-event-transaction.js';

import {
  agentRunTransitions,
} from './agent-run-transitions.js';

const runId = '123e4567-e89b-12d3-a456-426614174000';

const request = {
  sql: agentRunTransitions.start,
  values: [runId],
  event: {
    runId,
    eventType: 'run_started' as const,
    level: 'info' as const,
    message: 'Exécution démarrée',
  },
};

function mockPool(
  transitionRows: number,
  failure?: 'transition' | 'event',
) {
  const calls: string[] = [];
  let released = false;

  const client = {
    async query(sql: string) {
      calls.push(sql);

      if (sql === 'BEGIN' ||
          sql === 'COMMIT' ||
          sql === 'ROLLBACK') {
        return { rowCount: null, rows: [] };
      }

      if (sql.includes('UPDATE agent_runs')) {
        if (failure === 'transition') {
          throw new Error('Transition failed');
        }

        return {
          rowCount: transitionRows,
          rows: [],
        };
      }

      if (sql.includes('INSERT INTO agent_run_events')) {
        if (failure === 'event') {
          throw new Error('Event insert failed');
        }

        return {
          rowCount: 1,
          rows: [],
        };
      }

      throw new Error('Unexpected SQL query');
    },

    release() {
      released = true;
    },
  };

  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pick<Pool, 'connect'>;

  return {
    pool,
    calls,
    wasReleased: () => released,
  };
}

test('commits an accepted transition and its event', async () => {
  const mock = mockPool(1);

  const accepted = await executeAgentRunEventTransaction(
    mock.pool,
    request,
  );

  assert.equal(accepted, true);
  assert.equal(mock.calls[0], 'BEGIN');
  assert.equal(mock.calls.at(-1), 'COMMIT');
  assert.equal(
    mock.calls.filter(sql =>
      sql.includes('INSERT INTO agent_run_events')
    ).length,
    1,
  );
  assert.equal(mock.wasReleased(), true);
});

test('rolls back a rejected transition without event', async () => {
  const mock = mockPool(0);

  const accepted = await executeAgentRunEventTransaction(
    mock.pool,
    request,
  );

  assert.equal(accepted, false);
  assert.equal(mock.calls.at(-1), 'ROLLBACK');
  assert.equal(
    mock.calls.some(sql =>
      sql.includes('INSERT INTO agent_run_events')
    ),
    false,
  );
  assert.equal(mock.wasReleased(), true);
});

test('rolls back when event insertion fails', async () => {
  const mock = mockPool(1, 'event');

  await assert.rejects(
    executeAgentRunEventTransaction(mock.pool, request),
    /Event insert failed/,
  );

  assert.equal(mock.calls.at(-1), 'ROLLBACK');
  assert.equal(mock.wasReleased(), true);
});

test('rolls back when transition fails', async () => {
  const mock = mockPool(1, 'transition');

  await assert.rejects(
    executeAgentRunEventTransaction(mock.pool, request),
    /Transition failed/,
  );

  assert.equal(mock.calls.at(-1), 'ROLLBACK');
  assert.equal(mock.wasReleased(), true);
});

test('propagates an uncertain COMMIT failure', async () => {
  const calls: string[] = [];
  let released = false;

  const client = {
    async query(sql: string) {
      calls.push(sql);

      if (sql === 'COMMIT') {
        throw new Error('COMMIT result unknown');
      }

      if (sql.includes('UPDATE agent_runs')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 1, rows: [] };
    },

    release() {
      released = true;
    },
  };

  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pick<Pool, 'connect'>;

  await assert.rejects(
    executeAgentRunEventTransaction(pool, request),
    /COMMIT result unknown/,
  );

  assert.equal(released, true);
  assert.ok(calls.includes('COMMIT'));
});

test('rejects inconsistent execution identifiers before connecting', async () => {
  let connected = false;

  const pool = {
    async connect() {
      connected = true;
      throw new Error('Connection should not be opened');
    },
  } as unknown as Pick<Pool, 'connect'>;

  await assert.rejects(
    executeAgentRunEventTransaction(pool, {
      ...request,
      values: [
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ],
    }),
    /Identifiant d’exécution incohérent/,
  );

  assert.equal(connected, false);
});

test('rejects unauthorized SQL before connecting', async () => {
  let connected = false;

  const pool = {
    async connect() {
      connected = true;
      throw new Error('Connection should not be opened');
    },
  } as unknown as Pick<Pool, 'connect'>;

  await assert.rejects(
    executeAgentRunEventTransaction(pool, {
      ...request,
      sql: 'DELETE FROM agent_runs WHERE id = $1',
    }),
    /Transition SQL non autorisée/,
  );

  assert.equal(connected, false);
});

test('rejects mismatched event types before connecting', async () => {
  let connected = false;

  const pool = {
    async connect() {
      connected = true;
      throw new Error('Connection should not be opened');
    },
  } as unknown as Pick<Pool, 'connect'>;

  await assert.rejects(
    executeAgentRunEventTransaction(pool, {
      ...request,
      event: {
        ...request.event,
        eventType: 'run_completed',
      },
    }),
    /Type d’événement incohérent/,
  );

  assert.equal(connected, false);
});

test('accepts run_failed for rejection before start', async () => {
  const mock = mockPool(1);

  const accepted = await executeAgentRunEventTransaction(
    mock.pool,
    {
      sql: agentRunTransitions.rejectBeforeStart,
      values: [runId, 'Instruction invalide'],
      event: {
        runId,
        eventType: 'run_failed',
        level: 'error',
        message: 'Instruction invalide',
      },
    },
  );

  assert.equal(accepted, true);
  assert.equal(mock.calls.at(-1), 'COMMIT');
  assert.equal(mock.wasReleased(), true);
});

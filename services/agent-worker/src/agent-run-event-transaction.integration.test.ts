import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

import {
  executeAgentRunEventTransaction,
} from './agent-run-event-transaction.js';

import {
  agentRunTransitions,
} from './agent-run-transitions.js';

test(
  'PostgreSQL transaction integration',
  {
    skip: process.env.ATSI_RUN_INTEGRATION_TESTS !== '1',
  },
  async (t) => {
    const pool = new pg.Pool({
      host: '127.0.0.1',
      port: 5432,
      database: 'atsi_ai_hub_test',
      user: 'atsi_test',
      password: 'atsi_test_local',
      max: 2,
      connectionTimeoutMillis: 5000,
    });

    try {
      const identity = await pool.query(
        'SELECT current_database() AS db, current_user AS usr',
      );

      assert.equal(
        identity.rows[0].db,
        'atsi_ai_hub_test',
      );

      assert.equal(
        identity.rows[0].usr,
        'atsi_test',
      );

      async function createRun(): Promise<string> {
        const id = randomUUID();

        await pool.query(
          `INSERT INTO agent_runs
            (id, agent_name, instruction, status)
           VALUES ($1, $2, $3, 'queued')`,
          [id, 'integration-agent', 'Integration test'],
        );

        return id;
      }

      async function getStatus(id: string) {
        const result = await pool.query(
          'SELECT status FROM agent_runs WHERE id = $1',
          [id],
        );

        return result.rows[0]?.status;
      }

      async function getEvents(id: string) {
        const result = await pool.query(
          `SELECT event_type
           FROM agent_run_events
           WHERE run_id = $1
           ORDER BY created_at, id`,
          [id],
        );

        return result.rows.map(row => row.event_type);
      }

      await t.test('start and complete execution', async () => {
        const id = await createRun();

        assert.equal(
          await executeAgentRunEventTransaction(pool, {
            sql: agentRunTransitions.start,
            values: [id],
            event: {
              runId: id,
              eventType: 'run_started',
              level: 'info',
              message: 'Execution started',
            },
          }),
          true,
        );

        assert.equal(await getStatus(id), 'running');

        assert.equal(
          await executeAgentRunEventTransaction(pool, {
            sql: agentRunTransitions.complete,
            values: [id, JSON.stringify({ success: true })],
            event: {
              runId: id,
              eventType: 'run_completed',
              level: 'info',
              message: 'Execution completed',
            },
          }),
          true,
        );

        assert.equal(await getStatus(id), 'completed');

        assert.deepEqual(await getEvents(id), [
          'run_started',
          'run_completed',
        ]);
      });

      await t.test('reject duplicate transition', async () => {
        const id = await createRun();

        const request = {
          sql: agentRunTransitions.start,
          values: [id],
          event: {
            runId: id,
            eventType: 'run_started' as const,
            level: 'info' as const,
            message: 'Execution started',
          },
        };

        assert.equal(
          await executeAgentRunEventTransaction(pool, request),
          true,
        );

        assert.equal(
          await executeAgentRunEventTransaction(pool, request),
          false,
        );

        assert.deepEqual(await getEvents(id), [
          'run_started',
        ]);
      });

      await t.test('rollback invalid event', async () => {
        const id = await createRun();

        await assert.rejects(
          executeAgentRunEventTransaction(pool, {
            sql: agentRunTransitions.start,
            values: [id],
            event: {
              runId: id,
              eventType: 'run_started',
              level: 'info',
              message: '',
            },
          }),
        );

        assert.equal(await getStatus(id), 'queued');
        assert.deepEqual(await getEvents(id), []);
      });

      await t.test('rollback database insertion failure', async () => {
        const id = await createRun();

        await assert.rejects(
          executeAgentRunEventTransaction(pool, {
            sql: agentRunTransitions.start,
            values: [id],
            event: {
              runId: id,
              eventType: 'run_started',
              level: 'info',
              message: 'Invalid PostgreSQL character \u0000',
            },
          }),
        );

        assert.equal(await getStatus(id), 'queued');
        assert.deepEqual(await getEvents(id), []);
      });

      await t.test('fail running execution', async () => {
        const id = await createRun();

        await executeAgentRunEventTransaction(pool, {
          sql: agentRunTransitions.start,
          values: [id],
          event: {
            runId: id,
            eventType: 'run_started',
            level: 'info',
            message: 'Execution started',
          },
        });

        assert.equal(
          await executeAgentRunEventTransaction(pool, {
            sql: agentRunTransitions.fail,
            values: [id, 'Test failure'],
            event: {
              runId: id,
              eventType: 'run_failed',
              level: 'error',
              message: 'Execution failed',
            },
          }),
          true,
        );

        assert.equal(await getStatus(id), 'failed');

        assert.deepEqual(await getEvents(id), [
          'run_started',
          'run_failed',
        ]);
      });

      await t.test('reject execution before start', async () => {
        const id = await createRun();

        assert.equal(
          await executeAgentRunEventTransaction(pool, {
            sql: agentRunTransitions.rejectBeforeStart,
            values: [id, 'Invalid instruction'],
            event: {
              runId: id,
              eventType: 'run_failed',
              level: 'error',
              message: 'Execution rejected',
            },
          }),
          true,
        );

        assert.equal(await getStatus(id), 'failed');

        assert.deepEqual(await getEvents(id), [
          'run_failed',
        ]);
      });

      await t.test('reject unknown execution', async () => {
        const id = randomUUID();

        assert.equal(
          await executeAgentRunEventTransaction(pool, {
            sql: agentRunTransitions.start,
            values: [id],
            event: {
              runId: id,
              eventType: 'run_started',
              level: 'info',
              message: 'Execution started',
            },
          }),
          false,
        );

        assert.deepEqual(await getEvents(id), []);
      });
    } finally {
      await pool.end();
    }
  },
);

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

import {
  startAgentRun,
  completeAgentRun,
  failAgentRun,
} from './agent-run-lifecycle.js';

import {
  executeAgentRunStep,
} from './agent-run-step.js';

import {
  AgentJobValidationError,
} from './agent-job-validation-error.js';

test(
  'PostgreSQL lifecycle integration',
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

      assert.equal(identity.rows[0].db, 'atsi_ai_hub_test');
      assert.equal(identity.rows[0].usr, 'atsi_test');

      async function createRun() {
        const id = randomUUID();

        await pool.query(
          `INSERT INTO agent_runs
            (id, agent_name, instruction, status)
           VALUES ($1, $2, $3, 'queued')`,
          [id, 'demo-agent', 'Integration test'],
        );

        return id;
      }

      async function verifyRun(
        id: string,
        status: string,
        expectedEvents: string[],
      ) {
        const run = await pool.query(
          'SELECT status FROM agent_runs WHERE id = $1',
          [id],
        );

        assert.equal(run.rows[0].status, status);

        const events = await pool.query(
          `SELECT event_type
           FROM agent_run_events
           WHERE run_id = $1`,
          [id],
        );

        assert.deepEqual(
          events.rows.map(row => row.event_type).sort(),
          [...expectedEvents].sort(),
        );
      }

      await t.test('successful mission', async () => {
        const id = await createRun();

        await startAgentRun(pool, id);

        const result = await executeAgentRunStep(
          pool,
          id,
          'simulate-instruction',
          async () => ({ success: true }),
        );

        await completeAgentRun(pool, id, result);

        await verifyRun(id, 'completed', [
          'run_started',
          'step_started',
          'step_completed',
          'run_completed',
        ]);
      });

      await t.test('failed mission', async () => {
        const id = await createRun();

        await startAgentRun(pool, id);

        const originalError = new Error('Test failure');

        await assert.rejects(
          executeAgentRunStep(
            pool,
            id,
            'simulate-instruction',
            async () => {
              throw originalError;
            },
          ),
          error => error === originalError,
        );

        await failAgentRun(pool, id, originalError);

        await verifyRun(id, 'failed', [
          'run_started',
          'step_started',
          'step_failed',
          'run_failed',
        ]);
      });

      await t.test('invalid mission', async () => {
        const id = await createRun();

        await failAgentRun(
          pool,
          id,
          new AgentJobValidationError('Invalid mission'),
        );

        await verifyRun(id, 'failed', [
          'run_failed',
        ]);
      });
    } finally {
      await pool.end();
    }
  },
);

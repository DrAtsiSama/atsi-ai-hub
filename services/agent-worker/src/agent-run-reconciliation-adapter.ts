import { Job, type Queue } from 'bullmq';
import type { Pool } from 'pg';
import {
  inspectAgentRun,
  type AgentRunReconciliationReport,
} from './agent-run-reconciliation-reader.js';
import type { BullMqJobState } from './agent-run-reconciliation.js';

const knownBullMqStates = new Set<string>([
  'waiting',
  'waiting-children',
  'delayed',
  'prioritized',
  'active',
  'completed',
  'failed',
  'unknown',
]);

export function parseBullMqJobState(
  value: unknown,
): BullMqJobState {
  if (
    typeof value === 'string' &&
    knownBullMqStates.has(value)
  ) {
    return value as BullMqJobState;
  }

  return 'unknown';
}

type BullMqJobReader = {
  getState: () => Promise<string>;
};

export type BullMqJobLookup = (
  queue: Queue,
  jobId: string,
) => Promise<BullMqJobReader | null | undefined>;

export async function inspectAgentRunWithServices(
  database: Pick<Pool, 'query'>,
  queue: Queue,
  runId: string,
  findJob: BullMqJobLookup = Job.fromId,
): Promise<AgentRunReconciliationReport> {
  return inspectAgentRun(
    {
      async query(sql, values) {
        const result = await database.query(sql, values);

        return {
          rowCount: result.rowCount,
          rows: result.rows,
        };
      },
    },
    {
      async getJobState(jobId) {
        const job = await findJob(queue, jobId);

        if (job === undefined || job === null) {
          return null;
        }

        const state = await job.getState();
        return parseBullMqJobState(state);
      },
    },
    runId,
  );
}

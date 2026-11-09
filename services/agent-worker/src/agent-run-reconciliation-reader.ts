import {
  reconcileAgentRun,
  type BullMqJobState,
  type AgentRunReconciliation,
} from './agent-run-reconciliation.js';
import { parseAgentRunState } from './agent-run-state.js';

export const agentRunReconciliationQuery = `
  SELECT status, job_id
  FROM agent_runs
  WHERE id = $1
`;

type DatabaseReader = {
  query: (
    sql: string,
    values: string[],
  ) => Promise<{
    rowCount: number | null;
    rows: Array<{ status: unknown; job_id: unknown }>;
  }>;
};

type BullMqReader = {
  getJobState: (
    jobId: string,
  ) => Promise<BullMqJobState | null>;
};

export interface AgentRunReconciliationReport
  extends AgentRunReconciliation {
  runId: string;
  jobId: string | null;
}

export async function inspectAgentRun(
  database: DatabaseReader,
  bullmq: BullMqReader,
  runId: string,
): Promise<AgentRunReconciliationReport> {
  const result = await database.query(
    agentRunReconciliationQuery,
    [runId],
  );

  if (result.rowCount !== 1 || result.rows.length !== 1) {
    return {
      runId,
      jobId: null,
      status: 'indeterminate',
      reason: 'PostgreSQL execution missing or ambiguous',
    };
  }

  const row = result.rows[0];
  const postgresState = parseAgentRunState(row.status);

  if (postgresState === null) {
    return {
      runId,
      jobId: null,
      status: 'indeterminate',
      reason: 'Invalid PostgreSQL execution state',
    };
  }

  if (typeof row.job_id !== 'string' || !row.job_id) {
    return {
      runId,
      jobId: null,
      status: 'indeterminate',
      reason: 'BullMQ job ID missing in PostgreSQL',
    };
  }

  const jobId = row.job_id;
  const bullmqState = await bullmq.getJobState(jobId);
  const diagnosis = reconcileAgentRun(
    postgresState,
    bullmqState,
  );

  return {
    runId,
    jobId,
    ...diagnosis,
  };
}

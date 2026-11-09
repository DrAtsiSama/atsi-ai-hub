import type { AgentRunState } from './agent-run-state.js';

export type BullMqJobState =
  | 'waiting'
  | 'waiting-children'
  | 'delayed'
  | 'prioritized'
  | 'active'
  | 'completed'
  | 'failed'
  | 'unknown';

export type ReconciliationStatus =
  | 'consistent'
  | 'manual-review-required'
  | 'indeterminate';

export interface AgentRunReconciliation {
  status: ReconciliationStatus;
  reason: string;
}

export function reconcileAgentRun(
  postgresState: AgentRunState | null,
  bullmqState: BullMqJobState | null,
): AgentRunReconciliation {
  if (postgresState === null || bullmqState === null) {
    return {
      status: 'indeterminate',
      reason: 'Missing execution or BullMQ job',
    };
  }

  if (bullmqState === 'unknown') {
    return {
      status: 'indeterminate',
      reason: 'BullMQ state is unknown',
    };
  }

  if (
    (postgresState === 'queued' &&
      ['waiting', 'delayed', 'prioritized'].includes(bullmqState)) ||
    (postgresState === 'running' && bullmqState === 'active') ||
    (postgresState === 'completed' && bullmqState === 'completed') ||
    (postgresState === 'failed' && bullmqState === 'failed')
  ) {
    return {
      status: 'consistent',
      reason: 'PostgreSQL and BullMQ states are compatible',
    };
  }

  return {
    status: 'manual-review-required',
    reason: 'PostgreSQL and BullMQ states differ',
  };
}

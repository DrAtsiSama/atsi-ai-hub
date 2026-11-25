import type { Pool } from 'pg';

import {
  executeAgentRunEventTransaction,
} from './agent-run-event-transaction.js';

import {
  agentRunTransitions,
} from './agent-run-transitions.js';

import {
  createTransitionRejectedError,
} from './agent-run-transition-diagnostic.js';

import {
  selectAgentRunFailureTransition,
} from './agent-run-failure-policy.js';

type LifecycleDatabase = Pick<Pool, 'connect' | 'query'>;

export async function startAgentRun(
  database: LifecycleDatabase,
  runId: string,
): Promise<void> {
  const accepted = await executeAgentRunEventTransaction(
    database,
    {
      sql: agentRunTransitions.start,
      values: [runId],
      event: {
        runId,
        eventType: 'run_started',
        level: 'info',
        message: 'Execution demarree',
      },
    },
  );

  if (!accepted) {
    throw await createTransitionRejectedError(
      database,
      runId,
      'queued -> running',
    );
  }
}

export async function completeAgentRun(
  database: LifecycleDatabase,
  runId: string,
  result: unknown,
): Promise<void> {
  const accepted = await executeAgentRunEventTransaction(
    database,
    {
      sql: agentRunTransitions.complete,
      values: [runId, JSON.stringify(result)],
      event: {
        runId,
        eventType: 'run_completed',
        level: 'info',
        message: 'Execution terminee',
      },
    },
  );

  if (!accepted) {
    throw await createTransitionRejectedError(
      database,
      runId,
      'running -> completed',
    );
  }
}

export async function failAgentRun(
  database: LifecycleDatabase,
  runId: string,
  error: unknown,
): Promise<boolean | null> {
  const transition = selectAgentRunFailureTransition(error);

  if (transition === null) {
    return null;
  }

  const message =
    transition === agentRunTransitions.rejectBeforeStart
      ? 'Mission invalide'
      : 'Echec de execution';

  return executeAgentRunEventTransaction(
    database,
    {
      sql: transition,
      values: [runId, message],
      event: {
        runId,
        eventType: 'run_failed',
        level: 'error',
        message,
      },
    },
  );
}

import type { Pool } from 'pg';

import {
  insertAgentRunEvent,
} from './agent-run-event-persistence.js';

import type {
  AgentRunEventInput,
} from './agent-run-event.js';

import {
  agentRunTransitions,
} from './agent-run-transitions.js';

export type AgentRunTransitionRequest = {
  sql: string;
  values: unknown[];
  event: AgentRunEventInput;
};

export async function executeAgentRunEventTransaction(
  database: Pick<Pool, 'connect'>,
  request: AgentRunTransitionRequest,
): Promise<boolean> {
  const allowedTransitions: readonly string[] =
    Object.values(agentRunTransitions);

  if (!allowedTransitions.includes(request.sql)) {
    throw new Error('Transition SQL non autorisée');
  }

  const expectedEventType =
    request.sql === agentRunTransitions.start
      ? 'run_started'
      : request.sql === agentRunTransitions.complete
        ? 'run_completed'
        : 'run_failed';

  if (request.event.eventType !== expectedEventType) {
    throw new Error(
      'Type d’événement incohérent avec la transition',
    );
  }

  if (
    request.values[0] !== request.event.runId
  ) {
    throw new Error(
      'Identifiant d’exécution incohérent entre transition et événement',
    );
  }

  const client = await database.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const result = await client.query(
      request.sql,
      request.values,
    );

    if (result.rowCount !== 1) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return false;
    }

    await insertAgentRunEvent(
      client,
      request.event,
    );

    await client.query('COMMIT');
    transactionStarted = false;

    return true;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Conserver l'erreur initiale.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

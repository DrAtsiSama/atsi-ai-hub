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

export class AgentRunCommitUncertainError extends Error {
  constructor(cause: unknown) {
    super(
      'COMMIT result unknown',
      { cause },
    );
    this.name = 'AgentRunCommitUncertainError';
  }
}

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

  const expectedParameterCount =
    request.sql === agentRunTransitions.start ? 1 : 2;

  if (request.values.length !== expectedParameterCount) {
    throw new Error('Nombre de paramètres incorrect');
  }

  if (
    expectedParameterCount === 2 &&
    typeof request.values[1] !== 'string'
  ) {
    throw new Error('Paramètre de transition invalide');
  }

  const expectedLevel =
    expectedEventType === 'run_failed' ? 'error' : 'info';

  if (request.event.level !== expectedLevel) {
    throw new Error('Niveau incohérent avec la transition');
  }

  if (request.event.stepKey !== undefined) {
    throw new Error('Une transition globale ne possède pas de stepKey');
  }

  const client = await database.connect();

  let phase:
    | 'begin'
    | 'active'
    | 'rollback'
    | 'commit'
    | 'done' = 'begin';

  let discardConnection = false;

  try {
    await client.query('BEGIN');
    phase = 'active';

    const result = await client.query(
      request.sql,
      request.values,
    );

    if (result.rowCount !== 1) {
      phase = 'rollback';
      await client.query('ROLLBACK');
      phase = 'done';
      return false;
    }

    await insertAgentRunEvent(
      client,
      request.event,
    );

    phase = 'commit';
    await client.query('COMMIT');
    phase = 'done';

    return true;
  } catch (error) {
    if (phase === 'commit') {
      discardConnection = true;
      throw new AgentRunCommitUncertainError(error);
    }

    if (phase === 'active') {
      try {
        await client.query('ROLLBACK');
      } catch {
        discardConnection = true;
      }
    } else {
      discardConnection = true;
    }

    throw error;
  } finally {
    client.release(discardConnection);
  }
}

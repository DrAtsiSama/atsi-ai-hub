import type { Pool } from 'pg';

import {
  insertAgentRunEvent,
} from './agent-run-event-persistence.js';

export async function executeAgentRunStep<T>(
  database: Pick<Pool, 'query'>,
  runId: string,
  stepKey: string,
  action: () => Promise<T>,
): Promise<T> {
  await insertAgentRunEvent(database, {
    runId,
    stepKey,
    eventType: 'step_started',
    level: 'info',
    message: 'Etape demarree',
  });

  let result: T;

  try {
    result = await action();
  } catch (error) {
    try {
      await insertAgentRunEvent(database, {
        runId,
        stepKey,
        eventType: 'step_failed',
        level: 'error',
        message: 'Echec de etape',
      });
    } catch {
      console.error(
        `[Agent] Journalisation impossible pour ${runId}/${stepKey}`,
      );
    }

    throw error;
  }

  await insertAgentRunEvent(database, {
    runId,
    stepKey,
    eventType: 'step_completed',
    level: 'info',
    message: 'Etape terminee',
  });

  return result;
}

import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

import {
  validateAgentRunEvent,
  type AgentRunEventInput,
} from './agent-run-event.js';

export const insertAgentRunEventQuery = `
  INSERT INTO agent_run_events (
    id,
    run_id,
    event_type,
    level,
    step_key,
    message
  )
  VALUES ($1, $2, $3, $4, $5, $6)
`;

export async function insertAgentRunEvent(
  database: Pick<Pool, 'query'>,
  event: AgentRunEventInput,
): Promise<string> {
  validateAgentRunEvent(event);

  const eventId = randomUUID();

  await database.query(
    insertAgentRunEventQuery,
    [
      eventId,
      event.runId,
      event.eventType,
      event.level,
      event.stepKey ?? null,
      event.message,
    ],
  );

  return eventId;
}

export const agentRunEventTypes = [
  'run_started',
  'run_completed',
  'run_failed',
  'step_started',
  'step_completed',
  'step_failed',
] as const;

export type AgentRunEventType =
  (typeof agentRunEventTypes)[number];

export const agentRunEventLevels = [
  'info',
  'warning',
  'error',
] as const;

export type AgentRunEventLevel =
  (typeof agentRunEventLevels)[number];

export interface AgentRunEventInput {
  runId: string;
  eventType: AgentRunEventType;
  level: AgentRunEventLevel;
  stepKey?: string;
  message: string;
}

export function isAgentRunEventType(
  value: unknown,
): value is AgentRunEventType {
  return typeof value === 'string' &&
    (agentRunEventTypes as readonly string[]).includes(value);
}

export function isAgentRunEventLevel(
  value: unknown,
): value is AgentRunEventLevel {
  return typeof value === 'string' &&
    (agentRunEventLevels as readonly string[]).includes(value);
}

export function validateAgentRunEvent(
  input: AgentRunEventInput,
): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(input.runId)
  ) {
    throw new Error('Identifiant d’exécution invalide');
  }

  if (!isAgentRunEventType(input.eventType)) {
    throw new Error('Type d’événement invalide');
  }

  if (!isAgentRunEventLevel(input.level)) {
    throw new Error('Niveau d’événement invalide');
  }

  if (!input.message.trim()) {
    throw new Error('Message d’événement vide');
  }

  if (
    input.stepKey !== undefined &&
    !/^[a-z][a-z0-9-]*$/.test(input.stepKey)
  ) {
    throw new Error('Identifiant d’étape invalide');
  }

  if (
    input.eventType.startsWith('step_') &&
    input.stepKey === undefined
  ) {
    throw new Error(
      'Une étape métier doit posséder un identifiant',
    );
  }
}

export const agentRunStateQuery = `
  SELECT status
  FROM agent_runs
  WHERE id = $1
`;

export type AgentRunState =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export function parseAgentRunState(
  value: unknown,
): AgentRunState | null {
  switch (value) {
    case 'queued':
    case 'running':
    case 'completed':
    case 'failed':
      return value;
    default:
      return null;
  }
}

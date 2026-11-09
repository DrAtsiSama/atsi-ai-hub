import { AgentRunTransitionRejectedError } from './agent-run-transition-error.js';
import { agentRunStateQuery, parseAgentRunState } from './agent-run-state.js';

type StateQueryResult = {
  rowCount: number | null;
  rows: Array<{ status: unknown }>;
};

type StateReader = {
  query: (
    sql: string,
    values: string[],
  ) => Promise<StateQueryResult>;
};

export async function createTransitionRejectedError(
  database: StateReader,
  runId: string,
  transition: string,
): Promise<AgentRunTransitionRejectedError> {
  const result = await database.query(agentRunStateQuery, [runId]);

  const currentState =
    result.rowCount === 1
      ? parseAgentRunState(result.rows[0]?.status)
      : null;

  return new AgentRunTransitionRejectedError(
    runId,
    transition,
    currentState,
  );
}

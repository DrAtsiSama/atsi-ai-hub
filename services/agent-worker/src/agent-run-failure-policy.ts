import { AgentJobValidationError } from './agent-job-validation-error.js';
import { AgentRunTransitionRejectedError } from './agent-run-transition-error.js';
import { agentRunTransitions } from './agent-run-transitions.js';

export function selectAgentRunFailureTransition(
  error: unknown,
): string | null {
  if (error instanceof AgentRunTransitionRejectedError) {
    return null;
  }

  if (error instanceof AgentJobValidationError) {
    return agentRunTransitions.rejectBeforeStart;
  }

  return agentRunTransitions.fail;
}

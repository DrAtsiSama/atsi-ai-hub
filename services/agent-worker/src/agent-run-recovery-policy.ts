import type { AgentRunState } from './agent-run-state.js';

export type AgentRunRecoveryDecision =
  | 'start'
  | 'manual-recovery-required'
  | 'already-completed'
  | 'already-failed'
  | 'inconsistent-state';

export function decideAgentRunRecovery(
  state: AgentRunState | null,
): AgentRunRecoveryDecision {
  switch (state) {
    case 'queued':
      return 'start';

    case 'running':
      return 'manual-recovery-required';

    case 'completed':
      return 'already-completed';

    case 'failed':
      return 'already-failed';

    default:
      return 'inconsistent-state';
  }
}

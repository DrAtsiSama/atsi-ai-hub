import type { AgentRunState } from './agent-run-state.js';
import { decideAgentRunRecovery } from './agent-run-recovery-policy.js';

export class AgentRunTransitionRejectedError extends Error {
  constructor(
    public readonly runId: string,
    public readonly transition: string,
    public readonly currentState: AgentRunState | null = null,
  ) {
    super(
      `Transition ${transition} refusée pour l'exécution ${runId}` +
      ` (état PostgreSQL : ${currentState ?? 'introuvable ou inconnu'}` +
      `, récupération : ${decideAgentRunRecovery(currentState)})`,
    );

    this.name = 'AgentRunTransitionRejectedError';
  }
}

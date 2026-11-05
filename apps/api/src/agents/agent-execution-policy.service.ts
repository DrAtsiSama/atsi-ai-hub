import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentRegistryService,
  StoredAgent,
} from './agent-registry.service.js';

export interface PreparedAgentExecution {
  agentId: string;
  agentKey: string;
  agentName: string;
  capability: string;
  configVersion: number;
  configSnapshot: Record<string, unknown>;
}

@Injectable()
export class AgentExecutionPolicyService {
  constructor(private readonly registry: AgentRegistryService) {}

  async prepare(
    agentId: string,
    capability: string,
  ): Promise<PreparedAgentExecution> {
    const agent = await this.registry.findById(agentId);

    if (!agent) {
      throw new NotFoundException('Agent introuvable');
    }

    this.assertAllowed(agent, capability);

    return {
      agentId: agent.id,
      agentKey: agent.key,
      agentName: agent.name,
      capability,
      configVersion: agent.configVersion,
      configSnapshot: structuredClone(agent.config),
    };
  }

  private assertAllowed(
    agent: StoredAgent,
    capability: string,
  ): void {
    if (!agent.enabled) {
      throw new ForbiddenException('Agent désactivé');
    }

    if (agent.requiresApproval) {
      throw new ForbiddenException(
        'Validation humaine requise avant exécution',
      );
    }

    if (!agent.capabilities.includes(capability)) {
      throw new ForbiddenException(
        'Capacité non autorisée pour cet agent',
      );
    }
  }
}

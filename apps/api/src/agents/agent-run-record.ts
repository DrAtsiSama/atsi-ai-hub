import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PreparedAgentExecution } from './agent-execution-policy.service.js';

export interface PreparedAgentRunRecord {
  id: string;
  agentId: string;
  agentName: string;
  instruction: string;
  configVersion: number;
  configSnapshot: Record<string, unknown>;
}

export function createAgentRunRecord(
  execution: PreparedAgentExecution,
  instruction: string,
): PreparedAgentRunRecord {
  if (typeof instruction !== 'string' || !instruction.trim()) {
    throw new BadRequestException('Instruction non valide');
  }

  if (instruction.length > 2000) {
    throw new BadRequestException('Instruction trop longue');
  }

  return {
    id: randomUUID(),
    agentId: execution.agentId,
    agentName: execution.agentKey,
    instruction: instruction.trim(),
    configVersion: execution.configVersion,
    configSnapshot: structuredClone(execution.configSnapshot),
  };
}

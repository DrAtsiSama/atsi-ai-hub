import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PreparedAgentRunRecord } from './agent-run-record.js';

export interface PreparedAgentJob {
  name: 'demo-agent';
  data: {
    runId: string;
    instruction: string;
  };
  options: {
    jobId: string;
  };
}

export function buildAgentRunJob(
  record: PreparedAgentRunRecord,
): PreparedAgentJob {
  if (record.agentName !== 'demo-agent') {
    throw new ForbiddenException(
      'Exécution des agents métier non disponible',
    );
  }

  if (
    typeof record.instruction !== 'string' ||
    !record.instruction.trim() ||
    record.instruction.length > 2000
  ) {
    throw new BadRequestException('Instruction non valide');
  }

  return {
    name: 'demo-agent',
    data: {
      runId: record.id,
      instruction: record.instruction.trim(),
    },
    options: {
      jobId: record.id,
    },
  };
}

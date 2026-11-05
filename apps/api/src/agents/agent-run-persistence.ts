import { PreparedAgentRunRecord } from './agent-run-record.js';

export interface AgentRunInsertQuery {
  text: string;
  values: [
    string,
    string,
    string,
    string,
    string,
    number,
    string,
  ];
}

export function buildAgentRunInsert(
  record: PreparedAgentRunRecord,
): AgentRunInsertQuery {
  return {
    text: `INSERT INTO agent_runs
      (
        id,
        agent_id,
        agent_name,
        instruction,
        status,
        config_version,
        config_snapshot
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    values: [
      record.id,
      record.agentId,
      record.agentName,
      record.instruction,
      'queued',
      record.configVersion,
      JSON.stringify(record.configSnapshot),
    ],
  };
}

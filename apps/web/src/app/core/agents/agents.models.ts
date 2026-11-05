export interface AgentExecution {
  id: string;
  job_id: string | null;
  agent_name: string;
  instruction: string;
  status: string;
  result: unknown | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AgentHistoryResponse {
  total: number;
  executions: AgentExecution[];
}

export interface AgentJobResponse {
  jobId: string;
  agent: string;
  status: string;
  result: unknown | null;
  error: string | null;
}

export interface AgentRunResponse {
  runId: string;
  jobId: string;
  status: string;
}

export type AgentType = 'system' | 'employment' | 'portfolio';

export type AgentCapability =
  | 'demo.execute'
  | 'employment.applications.read'
  | 'employment.applications.organize'
  | 'employment.offers.analyze'
  | 'employment.drafts.prepare'
  | 'portfolio.content.read'
  | 'portfolio.drafts.prepare';

export interface RegisteredAgent {
  id: string;
  key: string;
  name: string;
  description: string;
  type: AgentType;
  enabled: boolean;
  config: Record<string, unknown>;
  configVersion: number;
  capabilities: AgentCapability[];
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentRequest {
  key: string;
  name: string;
  description: string;
  type: AgentType;
  config: Record<string, unknown>;
  capabilities: AgentCapability[];
}

export type AgentType =
  | 'system'
  | 'employment'
  | 'portfolio';

export type AgentCapability =
  | 'demo.execute'
  | 'employment.applications.read'
  | 'employment.applications.organize'
  | 'employment.offers.analyze'
  | 'employment.drafts.prepare'
  | 'portfolio.content.read'
  | 'portfolio.drafts.prepare';

export type AgentExecutionStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export type AgentConfiguration = Record<string, unknown>;

export interface AgentDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  type: AgentType;
  enabled: boolean;
  config: AgentConfiguration;
  configVersion: number;
  capabilities: AgentCapability[];
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentExecutionPayload {
  runId: string;
  agentKey: string;
  instruction: string;
  configVersion: number;
  configSnapshot: AgentConfiguration;
}

export interface AgentExecutionRecord {
  id: string;
  agentId: string | null;
  agentName: string;
  jobId: string | null;
  instruction: string;
  status: AgentExecutionStatus;
  configVersion: number | null;
  configSnapshot: AgentConfiguration | null;
  result: unknown | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

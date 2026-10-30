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

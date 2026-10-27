CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID PRIMARY KEY,
    job_id TEXT UNIQUE,
    agent_name TEXT NOT NULL,
    instruction TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT agent_runs_status_check
      CHECK (status IN ('queued', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at
    ON agent_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status
    ON agent_runs (status);

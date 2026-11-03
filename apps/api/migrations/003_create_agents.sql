-- ATSI AI Hub V0.3
-- Definitions des agents et liaison aux executions.
-- Migration additive : aucune suppression de donnees.

BEGIN;

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    config_version INTEGER NOT NULL DEFAULT 1,
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT agents_key_check
      CHECK (key ~ '^[a-z][a-z0-9-]*$'),

    CONSTRAINT agents_type_check
      CHECK (type IN ('system', 'employment', 'portfolio')),

    CONSTRAINT agents_config_version_check
      CHECK (config_version >= 1),

    CONSTRAINT agents_config_object_check
      CHECK (jsonb_typeof(config) = 'object'),

    CONSTRAINT agents_capabilities_array_check
      CHECK (jsonb_typeof(capabilities) = 'array')
);

ALTER TABLE agent_runs
    ADD COLUMN IF NOT EXISTS agent_id UUID,
    ADD COLUMN IF NOT EXISTS config_version INTEGER,
    ADD COLUMN IF NOT EXISTS config_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_agents_type
    ON agents (type);

CREATE INDEX IF NOT EXISTS idx_agents_enabled
    ON agents (enabled);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id
    ON agent_runs (agent_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'agent_runs_agent_id_fkey'
          AND conrelid = 'agent_runs'::regclass
    ) THEN
        ALTER TABLE agent_runs
            ADD CONSTRAINT agent_runs_agent_id_fkey
            FOREIGN KEY (agent_id)
            REFERENCES agents(id)
            ON DELETE RESTRICT;
    END IF;
END
$$;

COMMIT;

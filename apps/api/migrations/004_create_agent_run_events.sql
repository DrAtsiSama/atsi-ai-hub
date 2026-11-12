-- ATSI AI Hub V0.3
-- Journalisation des evenements d'execution.
-- Migration additive : aucune suppression de donnees.

BEGIN;

CREATE TABLE IF NOT EXISTS agent_run_events (
    id UUID PRIMARY KEY,
    run_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    level TEXT NOT NULL,
    step_key TEXT,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT agent_run_events_run_id_fkey
      FOREIGN KEY (run_id)
      REFERENCES agent_runs(id)
      ON DELETE RESTRICT,

    CONSTRAINT agent_run_events_type_check
      CHECK (
        event_type IN (
          'run_started',
          'run_completed',
          'run_failed',
          'step_started',
          'step_completed',
          'step_failed'
        )
      ),

    CONSTRAINT agent_run_events_level_check
      CHECK (level IN ('info', 'warning', 'error')),

    CONSTRAINT agent_run_events_message_check
      CHECK (
        length(btrim(message)) BETWEEN 1 AND 2000
      ),

    CONSTRAINT agent_run_events_step_key_check
      CHECK (
        step_key IS NULL
        OR step_key ~ '^[a-z][a-z0-9-]*$'
      ),

    CONSTRAINT agent_run_events_step_required_check
      CHECK (
        event_type NOT LIKE 'step_%'
        OR step_key IS NOT NULL
      ),

    CONSTRAINT agent_run_events_metadata_check
      CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_run_created
    ON agent_run_events (run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_type
    ON agent_run_events (event_type);

COMMIT;

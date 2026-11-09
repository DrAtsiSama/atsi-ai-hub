export const agentRunTransitions = {
  start: `UPDATE agent_runs
          SET status = 'running',
              started_at = NOW()
          WHERE id = $1
            AND status = 'queued'
          RETURNING id`,

  complete: `UPDATE agent_runs
             SET status = 'completed',
                 result = $2::jsonb,
                 completed_at = NOW()
             WHERE id = $1
               AND status = 'running'
             RETURNING id`,

  fail: `UPDATE agent_runs
         SET status = 'failed',
             error_message = $2,
             completed_at = NOW()
         WHERE id = $1
           AND status = 'running'
         RETURNING id`,
  rejectBeforeStart: `UPDATE agent_runs
                      SET status = 'failed',
                          error_message = $2,
                          completed_at = NOW()
                      WHERE id = $1
                        AND status = 'queued'
                      RETURNING id`,
} as const;

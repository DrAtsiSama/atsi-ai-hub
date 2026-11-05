import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { PreparedAgentRunRecord } from './agent-run-record.js';
import { buildAgentRunInsert } from './agent-run-persistence.js';

@Injectable()
export class AgentRunPersistenceService {
  constructor(private readonly database: DatabaseService) {}

  async insertPreparedRun(
    record: PreparedAgentRunRecord,
  ): Promise<void> {
    const query = buildAgentRunInsert(record);

    await this.database.query(
      query.text,
      query.values,
    );
  }

  async markPublished(
    runId: string,
    jobId: string,
  ): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE agent_runs
       SET job_id = $2
       WHERE id = $1
         AND job_id IS NULL
         AND status IN ('queued', 'running', 'completed')
       RETURNING id`,
      [runId, jobId],
    );

    return result.rowCount === 1;
  }

  async markPublicationFailed(runId: string): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE agent_runs
       SET status = 'failed',
           error_message = 'Impossible de publier la tâche',
           completed_at = NOW()
       WHERE id = $1
         AND status = 'queued'
         AND job_id IS NULL
       RETURNING id`,
      [runId],
    );

    return result.rowCount === 1;
  }
}

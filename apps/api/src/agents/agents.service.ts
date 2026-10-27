import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Job, Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class AgentsService implements OnModuleDestroy {
  private readonly queue = new Queue('atsi-agent-tasks', {
    connection: {
      host: process.env.REDIS_HOST ?? 'redis',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: null,
    },
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    },
  });

  constructor(private readonly database: DatabaseService) {}

  async runDemo(instruction: unknown) {
    if (typeof instruction !== 'string' || !instruction.trim()) {
      throw new BadRequestException('Instruction non valide');
    }

    if (instruction.length > 2000) {
      throw new BadRequestException('Instruction trop longue');
    }

    const runId = randomUUID();
    const cleanInstruction = instruction.trim();

    await this.database.query(
      `INSERT INTO agent_runs
       (id, agent_name, instruction, status)
       VALUES ($1, $2, $3, $4)`,
      [runId, 'demo-agent', cleanInstruction, 'queued'],
    );

    try {
      const job = await this.queue.add(
        'demo-agent',
        {
          runId,
          instruction: cleanInstruction,
        },
        {
          jobId: runId,
        },
      );

      await this.database.query(
        'UPDATE agent_runs SET job_id = $1 WHERE id = $2',
        [job.id, runId],
      );

      return {
        runId,
        jobId: job.id,
        status: 'queued',
      };
    } catch {
      await this.database.query(
        `UPDATE agent_runs
         SET status = 'failed',
             error_message = 'Impossible de créer la tâche',
             completed_at = NOW()
         WHERE id = $1`,
        [runId],
      );

      throw new InternalServerErrorException(
        'Impossible de créer la tâche',
      );
    }
  }

  async getJob(id: string) {
    const job = await Job.fromId(this.queue, id);

    if (!job) {
      throw new NotFoundException('Tâche introuvable');
    }

    const state = await job.getState();

    return {
      jobId: job.id,
      agent: job.name,
      status: state,
      result: state === 'completed' ? job.returnvalue : null,
      error: state === 'failed' ? job.failedReason : null,
    };
  }

    async getHistory() {
    const result = await this.database.query(
      `SELECT
         id,
         job_id,
         agent_name,
         instruction,
         status,
         result,
         error_message,
         created_at,
         started_at,
         completed_at
       FROM agent_runs
       ORDER BY created_at DESC
       LIMIT 50`,
    );

    return {
      total: result.rows.length,
      executions: result.rows,
    };
  }

  async getHistoryById(id: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      throw new BadRequestException('Identifiant invalide');
    }

    const result = await this.database.query(
      `SELECT
         id,
         job_id,
         agent_name,
         instruction,
         status,
         result,
         error_message,
         created_at,
         started_at,
         completed_at
       FROM agent_runs
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Exécution introuvable');
    }

    return result.rows[0];
  }
  async onModuleDestroy() {
    await this.queue.close();
  }
}

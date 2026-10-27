import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Job, Queue } from 'bullmq';

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

  async runDemo(instruction: unknown) {
    if (typeof instruction !== 'string' || !instruction.trim()) {
      throw new BadRequestException('Instruction non valide');
    }

    if (instruction.length > 2000) {
      throw new BadRequestException('Instruction trop longue');
    }

    const job = await this.queue.add('demo-agent', {
      instruction: instruction.trim(),
    });

    return {
      jobId: job.id,
      status: 'queued',
    };
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

  async onModuleDestroy() {
    await this.queue.close();
  }
}

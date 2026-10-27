import { Worker } from 'bullmq';

const queueName = 'atsi-agent-tasks';

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'redis',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
};

const worker = new Worker(
  queueName,
  async (job) => {
    console.log(`[Agent] Début tâche ${job.id}`);

    if (job.name !== 'demo-agent') {
      throw new Error(`Type de tâche inconnu : ${job.name}`);
    }

    const instruction = job.data.instruction;

    if (typeof instruction !== 'string' || !instruction.trim()) {
      throw new Error('Instruction invalide');
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const result = {
      agent: 'demo-agent',
      status: 'completed',
      instruction,
      message: `Instruction reçue et simulée : ${instruction}`,
      completedAt: new Date().toISOString(),
    };

    console.log(`[Agent] Tâche ${job.id} terminée`);

    return result;
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

worker.on('failed', (job, error) => {
  console.error(`[Agent] Échec tâche ${job?.id}`, error);
});

worker.on('error', (error) => {
  console.error('[Agent] Erreur Redis/Worker', error);
});

console.log('[Agent] Worker Atsi AI Hub démarré');

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

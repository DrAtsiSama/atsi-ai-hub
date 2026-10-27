import { Worker } from 'bullmq';
import { Pool } from 'pg';

const queueName = 'atsi-agent-tasks';

const database = new Pool({
  host: process.env.ATSI_DB_HOST ?? 'postgres',
  port: Number(process.env.ATSI_DB_PORT ?? 5432),
  database: process.env.ATSI_DB_NAME,
  user: process.env.ATSI_DB_USER,
  password: process.env.ATSI_DB_PASSWORD,
  max: 2,
  connectionTimeoutMillis: 5000,
});

const worker = new Worker(
  queueName,
  async (job) => {
    const runId: unknown = job.data.runId;
    const instruction: unknown = job.data.instruction;

    if (typeof runId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
      throw new Error('Identifiant d’exécution invalide');
    }

    console.log(`[Agent] Début tâche ${job.id}`);

    try {
      if (job.name !== 'demo-agent') {
        throw new Error(`Type de tâche inconnu : ${job.name}`);
      }

      if (typeof instruction !== 'string' || !instruction.trim()) {
        throw new Error('Instruction invalide');
      }

      const started = await database.query(
        `UPDATE agent_runs
         SET status = 'running', started_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [runId],
      );

      if (started.rowCount !== 1) {
        throw new Error(`Exécution PostgreSQL introuvable : ${runId}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const result = {
        agent: 'demo-agent',
        status: 'completed',
        instruction,
        message: `Instruction reçue et simulée : ${instruction}`,
        completedAt: new Date().toISOString(),
      };

      const completed = await database.query(
        `UPDATE agent_runs
         SET status = 'completed',
             result = $2::jsonb,
             completed_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [runId, JSON.stringify(result)],
      );

      if (completed.rowCount !== 1) {
        throw new Error(`Résultat PostgreSQL non enregistré : ${runId}`);
      }

      console.log(`[Agent] Tâche ${job.id} terminée`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      try {
        await database.query(
          `UPDATE agent_runs
           SET status = 'failed',
               error_message = $2,
               completed_at = NOW()
           WHERE id = $1`,
          [runId, message],
        );
      } catch (databaseError) {
        console.error('[Agent] Impossible de sauvegarder l’échec', databaseError);
      }

      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST ?? 'redis',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: null,
    },
    concurrency: 1,
  },
);

worker.on('failed', (job, error) => {
  console.error(`[Agent] Échec tâche ${job?.id}`, error);
});

worker.on('error', (error) => {
  console.error('[Agent] Erreur Worker', error);
});

console.log('[Agent] Worker Atsi AI Hub démarré');

async function shutdown() {
  await worker.close();
  await database.end();
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

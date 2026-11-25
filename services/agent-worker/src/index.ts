import { agentWorkerSafetyOptions } from './agent-worker-options.js';
import { Worker } from 'bullmq';
import { Pool } from 'pg';
import {
  startAgentRun,
  completeAgentRun,
  failAgentRun,
} from './agent-run-lifecycle.js';
import {
  AgentRunCommitUncertainError,
} from './agent-run-event-transaction.js';
import {
  executeAgentRunStep,
} from './agent-run-step.js';
import { AgentRunTransitionRejectedError } from './agent-run-transition-error.js';
import { AgentJobValidationError } from './agent-job-validation-error.js';

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
        throw new AgentJobValidationError(`Type de tâche inconnu : ${job.name}`);
      }

      if (typeof instruction !== 'string' || !instruction.trim()) {
        throw new AgentJobValidationError('Instruction invalide');
      }

      await startAgentRun(database, runId);

      await executeAgentRunStep(
        database,
        runId,
        'simulate-instruction',
        async () => {
          await new Promise(
            (resolve) => setTimeout(resolve, 1500),
          );
        },
      );

      const result = {
        agent: 'demo-agent',
        status: 'completed',
        instruction,
        message: `Instruction reçue et simulée : ${instruction}`,
        completedAt: new Date().toISOString(),
      };

      await completeAgentRun(database, runId, result);

      console.log(`[Agent] Tâche ${job.id} terminée`);
      return result;
    } catch (error) {
      if (error instanceof AgentRunCommitUncertainError) {
        console.error(
          `[Agent] COMMIT incertain pour ${runId} : reconciliation necessaire`,
        );

        throw error;
      }

      if (error instanceof AgentRunTransitionRejectedError) {
        console.warn(
          `[Agent] Transition refusée pour ${runId} : ${error.message}`,
        );

        throw error;
      }

      try {
        const failed = await failAgentRun(
          database,
          runId,
          error,
        );

        if (failed === false) {
          console.warn(
            `[Agent] Echec non enregistre pour ${runId} : transition refusee`,
          );
        }
      } catch (databaseError) {
        if (databaseError instanceof AgentRunCommitUncertainError) {
          console.error(
            `[Agent] COMMIT incertain pour ${runId} : reconciliation necessaire`,
          );

          throw databaseError;
        }

        console.error(
          `[Agent] Impossible de sauvegarder echec pour ${runId}`,
        );
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
    ...agentWorkerSafetyOptions,
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

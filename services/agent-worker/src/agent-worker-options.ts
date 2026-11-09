import type { WorkerOptions } from 'bullmq';

export const agentWorkerSafetyOptions = {
  concurrency: 1,
  maxStalledCount: 0,
  stalledInterval: 30_000,
} as const satisfies Pick<
  WorkerOptions,
  'concurrency' | 'maxStalledCount' | 'stalledInterval'
>;

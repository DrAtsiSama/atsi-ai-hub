import assert from 'node:assert/strict';
import test from 'node:test';
import { agentWorkerSafetyOptions } from './agent-worker-options.js';

test('worker processes one job at a time', () => {
  assert.equal(agentWorkerSafetyOptions.concurrency, 1);
});

test('stalled jobs are not automatically recovered', () => {
  assert.equal(agentWorkerSafetyOptions.maxStalledCount, 0);
});

test('stalled jobs are checked every 30 seconds', () => {
  assert.equal(agentWorkerSafetyOptions.stalledInterval, 30_000);
});

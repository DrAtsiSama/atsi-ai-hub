import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reconcileAgentRun,
  type BullMqJobState,
} from './agent-run-reconciliation.js';
import type { AgentRunState } from './agent-run-state.js';

const consistentCases: Array<[AgentRunState, BullMqJobState]> = [
  ['queued', 'waiting'],
  ['queued', 'delayed'],
  ['queued', 'prioritized'],
  ['running', 'active'],
  ['completed', 'completed'],
  ['failed', 'failed'],
];

for (const [postgres, bullmq] of consistentCases) {
  test(`${postgres} / ${bullmq} is compatible`, () => {
    assert.equal(
      reconcileAgentRun(postgres, bullmq).status,
      'consistent',
    );
  });
}

const divergentCases: Array<[AgentRunState, BullMqJobState]> = [
  ['running', 'failed'],
  ['running', 'waiting'],
  ['queued', 'completed'],
  ['completed', 'failed'],
  ['failed', 'completed'],
  ['queued', 'waiting-children'],
];

for (const [postgres, bullmq] of divergentCases) {
  test(`${postgres} / ${bullmq} requires manual review`, () => {
    assert.equal(
      reconcileAgentRun(postgres, bullmq).status,
      'manual-review-required',
    );
  });
}

test('missing PostgreSQL execution is indeterminate', () => {
  assert.equal(
    reconcileAgentRun(null, 'waiting').status,
    'indeterminate',
  );
});

test('missing BullMQ job is indeterminate', () => {
  assert.equal(
    reconcileAgentRun('queued', null).status,
    'indeterminate',
  );
});

test('unknown BullMQ state is indeterminate', () => {
  assert.equal(
    reconcileAgentRun('running', 'unknown').status,
    'indeterminate',
  );
});

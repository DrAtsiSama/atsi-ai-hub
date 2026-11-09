import assert from 'node:assert/strict';
import test from 'node:test';

import { decideAgentRunRecovery } from './agent-run-recovery-policy.js';

test('queued execution can start', () => {
  assert.equal(decideAgentRunRecovery('queued'), 'start');
});

test('running execution requires manual recovery', () => {
  assert.equal(
    decideAgentRunRecovery('running'),
    'manual-recovery-required',
  );
});

test('completed execution must not restart', () => {
  assert.equal(
    decideAgentRunRecovery('completed'),
    'already-completed',
  );
});

test('failed execution must not restart automatically', () => {
  assert.equal(
    decideAgentRunRecovery('failed'),
    'already-failed',
  );
});

test('missing execution is inconsistent', () => {
  assert.equal(
    decideAgentRunRecovery(null),
    'inconsistent-state',
  );
});

test('unexpected runtime state is inconsistent', () => {
  assert.equal(
    decideAgentRunRecovery('unexpected' as never),
    'inconsistent-state',
  );
});

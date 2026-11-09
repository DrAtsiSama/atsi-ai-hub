import assert from 'node:assert/strict';
import test from 'node:test';

import {
  agentRunStateQuery,
  parseAgentRunState,
} from './agent-run-state.js';

test('accepts queued state', () => {
  assert.equal(parseAgentRunState('queued'), 'queued');
});

test('accepts running state', () => {
  assert.equal(parseAgentRunState('running'), 'running');
});

test('accepts completed state', () => {
  assert.equal(parseAgentRunState('completed'), 'completed');
});

test('accepts failed state', () => {
  assert.equal(parseAgentRunState('failed'), 'failed');
});

test('rejects unknown states', () => {
  assert.equal(parseAgentRunState('cancelled'), null);
  assert.equal(parseAgentRunState('pending'), null);
  assert.equal(parseAgentRunState(''), null);
});

test('rejects invalid values', () => {
  assert.equal(parseAgentRunState(null), null);
  assert.equal(parseAgentRunState(undefined), null);
  assert.equal(parseAgentRunState(123), null);
  assert.equal(parseAgentRunState({ status: 'running' }), null);
});

test('queries an execution by its ID', () => {
  assert.ok(agentRunStateQuery.includes('SELECT status'));
  assert.ok(agentRunStateQuery.includes('FROM agent_runs'));
  assert.ok(agentRunStateQuery.includes('WHERE id = $1'));
});

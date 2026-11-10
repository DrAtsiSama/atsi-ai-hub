import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseBullMqJobState,
} from './agent-run-reconciliation-adapter.js';

for (const state of [
  'waiting',
  'waiting-children',
  'delayed',
  'prioritized',
  'active',
  'completed',
  'failed',
  'unknown',
]) {
  test(`accepts BullMQ state: ${state}`, () => {
    assert.equal(parseBullMqJobState(state), state);
  });
}

test('rejects unsupported BullMQ states', () => {
  assert.equal(parseBullMqJobState('unsupported'), 'unknown');
});

test('rejects non-string BullMQ states', () => {
  assert.equal(parseBullMqJobState(null), 'unknown');
  assert.equal(parseBullMqJobState(42), 'unknown');
});

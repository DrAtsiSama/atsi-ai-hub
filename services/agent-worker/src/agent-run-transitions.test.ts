import assert from 'node:assert/strict';
import test from 'node:test';
import { agentRunTransitions } from './agent-run-transitions.js';

test('start only accepts queued executions', () => {
  const sql = agentRunTransitions.start;

  assert.match(sql, /SET status = 'running'/);
  assert.match(sql, /AND status = 'queued'/);
  assert.match(sql, /RETURNING id/);
});

test('complete only accepts running executions', () => {
  const sql = agentRunTransitions.complete;

  assert.match(sql, /SET status = 'completed'/);
  assert.match(sql, /AND status = 'running'/);
  assert.ok(sql.includes('result = $2::jsonb'));
  assert.match(sql, /RETURNING id/);
});

test('fail only accepts running executions', () => {
  const sql = agentRunTransitions.fail;

  assert.match(sql, /SET status = 'failed'/);
  assert.match(sql, /AND status = 'running'/);
  assert.ok(sql.includes('error_message = $2'));
  assert.match(sql, /RETURNING id/);
});

test('all transitions target an execution by ID', () => {
  for (const sql of Object.values(agentRunTransitions)) {
    assert.ok(sql.includes('WHERE id = $1'));
  }
});

test('rejectBeforeStart only accepts queued executions', () => {
  const sql = agentRunTransitions.rejectBeforeStart;

  assert.match(sql, /SET status = 'failed'/);
  assert.match(sql, /AND status = 'queued'/);
  assert.ok(sql.includes('error_message = $2'));
  assert.match(sql, /RETURNING id/);
});

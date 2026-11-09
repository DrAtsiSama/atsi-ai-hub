import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentJobValidationError } from './agent-job-validation-error.js';
import { AgentRunTransitionRejectedError } from './agent-run-transition-error.js';
import { selectAgentRunFailureTransition } from './agent-run-failure-policy.js';
import { agentRunTransitions } from './agent-run-transitions.js';

test('validation errors use rejectBeforeStart', () => {
  const error = new AgentJobValidationError('Instruction invalide');

  assert.equal(
    selectAgentRunFailureTransition(error),
    agentRunTransitions.rejectBeforeStart,
  );
});

test('rejected transitions do not trigger another update', () => {
  const error = new AgentRunTransitionRejectedError(
    '00000000-0000-0000-0000-000000000001',
    'queued -> running',
    'completed',
  );

  assert.equal(selectAgentRunFailureTransition(error), null);
});

test('execution errors use running to failed', () => {
  const error = new Error('Erreur pendant l’exécution');

  assert.equal(
    selectAgentRunFailureTransition(error),
    agentRunTransitions.fail,
  );
});

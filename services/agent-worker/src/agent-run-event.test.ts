import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAgentRunEventLevel,
  isAgentRunEventType,
  validateAgentRunEvent,
  type AgentRunEventInput,
} from './agent-run-event.js';

const validEvent: AgentRunEventInput = {
  runId: '123e4567-e89b-12d3-a456-426614174000',
  eventType: 'run_started',
  level: 'info',
  message: 'Exécution démarrée',
};

test('accepte un événement valide', () => {
  assert.doesNotThrow(() => {
    validateAgentRunEvent(validEvent);
  });
});

test('reconnaît les types autorisés', () => {
  assert.equal(isAgentRunEventType('run_started'), true);
  assert.equal(isAgentRunEventType('unknown'), false);
});

test('reconnaît les niveaux autorisés', () => {
  assert.equal(isAgentRunEventLevel('warning'), true);
  assert.equal(isAgentRunEventLevel('debug'), false);
});

test('refuse un identifiant invalide', () => {
  assert.throws(() => {
    validateAgentRunEvent({
      ...validEvent,
      runId: 'invalid',
    });
  });
});

test('refuse un message vide', () => {
  assert.throws(() => {
    validateAgentRunEvent({
      ...validEvent,
      message: '   ',
    });
  });
});

test('exige un identifiant pour les étapes métier', () => {
  assert.throws(() => {
    validateAgentRunEvent({
      ...validEvent,
      eventType: 'step_started',
    });
  });
});

test('accepte une étape métier valide', () => {
  assert.doesNotThrow(() => {
    validateAgentRunEvent({
      ...validEvent,
      eventType: 'step_completed',
      stepKey: 'job-search',
    });
  });
});

test('refuse un identifiant d’étape invalide', () => {
  assert.throws(() => {
    validateAgentRunEvent({
      ...validEvent,
      eventType: 'step_started',
      stepKey: '../secret',
    });
  });
});

test('refuse un type inconnu à l’exécution', () => {
  assert.throws(() => {
    validateAgentRunEvent({
      ...validEvent,
      eventType: 'unknown' as AgentRunEventInput['eventType'],
    });
  });
});

test('accepte un message de 2000 caractères', () => {
  assert.doesNotThrow(() => {
    validateAgentRunEvent({
      ...validEvent,
      message: 'a'.repeat(2000),
    });
  });
});

test('refuse un message de plus de 2000 caractères', () => {
  assert.throws(() => {
    validateAgentRunEvent({
      ...validEvent,
      message: 'a'.repeat(2001),
    });
  });
});

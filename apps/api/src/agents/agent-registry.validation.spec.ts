import { describe, expect, it } from 'vitest';
import { validateCreateAgent } from './agent-registry.validation.js';

describe('validateCreateAgent', () => {
  const validAgent = {
    key: 'employment-agent',
    name: 'Agent Emploi',
    description: 'Organisation des candidatures',
    type: 'employment',
    enabled: true,
    config: {
      language: 'fr',
      maxResults: 10,
    },
    capabilities: [
      'employment.applications.read',
      'employment.offers.analyze',
    ],
    requiresApproval: false,
  };

  it('accepts a valid agent but disables it by default', () => {
    const result = validateCreateAgent(validAgent);

    expect(result.key).toBe('employment-agent');
    expect(result.enabled).toBe(false);
    expect(result.requiresApproval).toBe(true);
  });

  it('rejects invalid agent keys', () => {
    expect(() =>
      validateCreateAgent({
        ...validAgent,
        key: 'Invalid Agent!',
      }),
    ).toThrow();
  });

  it('accepts employment capabilities for an employment agent', () => {
    const result = validateCreateAgent({
      ...validAgent,
      capabilities: ['employment.offers.analyze'],
    });

    expect(result.capabilities).toEqual(['employment.offers.analyze']);
  });

  it('rejects portfolio capabilities for an employment agent', () => {
    expect(() =>
      validateCreateAgent({
        ...validAgent,
        capabilities: ['portfolio.drafts.prepare'],
      }),
    ).toThrowError(
      'Capabilities are not allowed for this agent type',
    );
  });

  it('accepts demo capabilities for a system agent', () => {
    const result = validateCreateAgent({
      ...validAgent,
      key: 'demo-agent',
      type: 'system',
      capabilities: ['demo.execute'],
    });

    expect(result.type).toBe('system');
    expect(result.capabilities).toEqual(['demo.execute']);
  });

  it('rejects unknown capabilities', () => {
    expect(() =>
      validateCreateAgent({
        ...validAgent,
        capabilities: ['system.admin'],
      }),
    ).toThrow();
  });

  it('rejects sensitive configuration keys', () => {
    expect(() =>
      validateCreateAgent({
        ...validAgent,
        config: {
          integration: {
            apiKey: 'example-secret',
          },
        },
      }),
    ).toThrow();
  });

  it('rejects oversized configurations', () => {
    expect(() =>
      validateCreateAgent({
        ...validAgent,
        config: {
          description: 'x'.repeat(11000),
        },
      }),
    ).toThrow();
  });

  it('rejects invalid configuration types', () => {
    expect(() =>
      validateCreateAgent({
        ...validAgent,
        config: [],
      }),
    ).toThrow();
  });
});

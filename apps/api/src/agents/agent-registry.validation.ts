import { BadRequestException } from '@nestjs/common';

export const AGENT_TYPES = [
  'system',
  'employment',
  'portfolio',
] as const;

export const AGENT_CAPABILITIES = [
  'demo.execute',
  'employment.applications.read',
  'employment.applications.organize',
  'employment.offers.analyze',
  'employment.drafts.prepare',
  'portfolio.content.read',
  'portfolio.drafts.prepare',
] as const;

const CAPABILITIES_BY_TYPE: Record<
  (typeof AGENT_TYPES)[number],
  readonly (typeof AGENT_CAPABILITIES)[number][]
> = {
  system: ['demo.execute'],
  employment: [
    'employment.applications.read',
    'employment.applications.organize',
    'employment.offers.analyze',
    'employment.drafts.prepare',
  ],
  portfolio: [
    'portfolio.content.read',
    'portfolio.drafts.prepare',
  ],
};

export type AgentType = (typeof AGENT_TYPES)[number];
export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

export interface CreateAgentInput {
  key: string;
  name: string;
  description: string;
  type: AgentType;
  enabled: boolean;
  config: Record<string, unknown>;
  capabilities: AgentCapability[];
  requiresApproval: boolean;
}

const FORBIDDEN_CONFIG_KEYS =
  /password|passwd|secret|token|api[_-]?key|credential|private[_-]?key|authorization/i;

function validateConfig(config: Record<string, unknown>): void {
  const serialized = JSON.stringify(config);

  if (!serialized || serialized.length > 10000) {
    throw new BadRequestException('Invalid agent configuration size');
  }

  const inspect = (value: unknown, depth: number): void => {
    if (depth > 10) {
      throw new BadRequestException('Agent configuration too deep');
    }

    if (Array.isArray(value)) {
      value.forEach((item) => inspect(item, depth + 1));
      return;
    }

    if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (FORBIDDEN_CONFIG_KEYS.test(key)) {
          throw new BadRequestException(
            'Sensitive configuration keys are not allowed',
          );
        }
        inspect(item, depth + 1);
      }
    }
  };

  inspect(config, 0);
}

export function validateCreateAgent(
  input: unknown,
): CreateAgentInput {
  if (
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new BadRequestException('Invalid agent definition');
  }

  const value = input as Record<string, unknown>;

  if (
    typeof value.key !== 'string' ||
    !/^[a-z][a-z0-9-]*$/.test(value.key) ||
    value.key.length > 100
  ) {
    throw new BadRequestException('Invalid agent key');
  }

  if (
    typeof value.name !== 'string' ||
    value.name.trim().length === 0 ||
    value.name.length > 150
  ) {
    throw new BadRequestException('Invalid agent name');
  }

  if (
    typeof value.description !== 'string' ||
    value.description.length > 2000
  ) {
    throw new BadRequestException('Invalid agent description');
  }

  if (
    typeof value.type !== 'string' ||
    !AGENT_TYPES.some((type) => type === value.type)
  ) {
    throw new BadRequestException('Invalid agent type');
  }

  if (
    typeof value.config !== 'object' ||
    value.config === null ||
    Array.isArray(value.config)
  ) {
    throw new BadRequestException('Invalid agent configuration');
  }

  if (
    !Array.isArray(value.capabilities) ||
    !value.capabilities.every(
      (capability) =>
        typeof capability === 'string' &&
        AGENT_CAPABILITIES.some(
          (allowed) => allowed === capability,
        ),
    )
  ) {
    throw new BadRequestException('Invalid agent capabilities');
  }

  const allowedCapabilities =
    CAPABILITIES_BY_TYPE[value.type as AgentType];

  if (
    !value.capabilities.every((capability) =>
      allowedCapabilities.includes(capability as AgentCapability),
    )
  ) {
    throw new BadRequestException(
      'Capabilities are not allowed for this agent type',
    );
  }

  validateConfig(value.config as Record<string, unknown>);

  return {
    key: value.key,
    name: value.name.trim(),
    description: value.description,
    type: value.type as AgentType,
    enabled: false,
    config: value.config as Record<string, unknown>,
    capabilities: value.capabilities as AgentCapability[],
    requiresApproval: true,
  };
}

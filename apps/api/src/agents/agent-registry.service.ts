import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { validateCreateAgent } from './agent-registry.validation.js';
import { DatabaseService } from '../database/database.service.js';

export type AgentType = 'system' | 'employment' | 'portfolio';

export interface StoredAgent {
  id: string;
  key: string;
  name: string;
  description: string;
  type: AgentType;
  enabled: boolean;
  config: Record<string, unknown>;
  configVersion: number;
  capabilities: string[];
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgentRow {
  id: string;
  key: string;
  name: string;
  description: string;
  type: AgentType;
  enabled: boolean;
  config: Record<string, unknown>;
  config_version: number;
  capabilities: string[];
  requires_approval: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AgentRegistryService {
  constructor(private readonly database: DatabaseService) {}

  async create(input: unknown): Promise<StoredAgent> {
    const agent = validateCreateAgent(input);

    try {
      const result = await this.database.query<AgentRow>(
        `INSERT INTO agents (
          id,
          key,
          name,
          description,
          type,
          enabled,
          config,
          config_version,
          capabilities,
          requires_approval
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7::jsonb, $8, $9::jsonb, $10
        )
        RETURNING *`,
        [
          randomUUID(),
          agent.key,
          agent.name,
          agent.description,
          agent.type,
          agent.enabled,
          JSON.stringify(agent.config),
          1,
          JSON.stringify(agent.capabilities),
          agent.requiresApproval,
        ],
      );

      return this.toStoredAgent(result.rows[0]);
    } catch (error) {
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505' &&
        'constraint' in error &&
        error.constraint === 'agents_key_key'
      ) {
        throw new ConflictException('Agent key already exists');
      }

      throw error;
    }
  }

  async findAll(): Promise<StoredAgent[]> {
    const result = await this.database.query<AgentRow>(`
      SELECT *
      FROM agents
      ORDER BY created_at DESC, key ASC
    `);

    return result.rows.map((row) => this.toStoredAgent(row));
  }

  async findByKey(key: string): Promise<StoredAgent | null> {
    const result = await this.database.query<AgentRow>(
      `SELECT * FROM agents WHERE key = $1 LIMIT 1`,
      [key],
    );

    const row = result.rows[0];

    return row ? this.toStoredAgent(row) : null;
  }

  async findById(id: string): Promise<StoredAgent | null> {
    const result = await this.database.query<AgentRow>(
      `SELECT * FROM agents WHERE id = $1 LIMIT 1`,
      [id],
    );

    const row = result.rows[0];

    return row ? this.toStoredAgent(row) : null;
  }

  private toStoredAgent(row: AgentRow): StoredAgent {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      type: row.type,
      enabled: row.enabled,
      config: row.config,
      configVersion: row.config_version,
      capabilities: row.capabilities,
      requiresApproval: row.requires_approval,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

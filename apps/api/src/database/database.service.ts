import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    host: process.env.ATSI_DB_HOST ?? 'postgres',
    port: Number(process.env.ATSI_DB_PORT ?? 5432),
    database: process.env.ATSI_DB_NAME,
    user: process.env.ATSI_DB_USER,
    password: process.env.ATSI_DB_PASSWORD,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ) {
    return this.pool.query<T>(sql, params);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}

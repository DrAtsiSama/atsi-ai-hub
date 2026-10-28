import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

const RESERVE_ATTEMPT_SCRIPT = `
for i = 1, #KEYS do
  local count = tonumber(redis.call('GET', KEYS[i]) or '0')
  if count >= tonumber(ARGV[1]) then
    return 0
  end
end

for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then
    redis.call('EXPIRE', KEYS[i], ARGV[2])
  end
end

return 1
`;

@Injectable()
export class LoginRateLimitService implements OnModuleDestroy {
  private readonly redis = new Redis({
    host: process.env.REDIS_HOST ?? 'redis',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 3000,
    retryStrategy: () => null,
  });

  private connectionPromise?: Promise<void>;

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'ready') {
      return;
    }

    if (!this.connectionPromise) {
      this.connectionPromise = this.redis.connect().finally(() => {
        this.connectionPromise = undefined;
      });
    }

    await this.connectionPromise;
  }

  private fingerprint(value: string): string {
    return createHash('sha256')
      .update(value)
      .digest('hex');
  }

  private keys(ip: string, username: string): string[] {
    const normalizedUsername = username.trim().toLowerCase();

    return [
      `atsi:auth:login:ip:${this.fingerprint(
        `${ip}:${normalizedUsername}`,
      )}`,
      `atsi:auth:login:user:${this.fingerprint(
        normalizedUsername,
      )}`,
    ];
  }

  async reserveAttempt(ip: string, username: string): Promise<void> {
    await this.ensureConnected();

    const result = await this.redis.eval(
      RESERVE_ATTEMPT_SCRIPT,
      2,
      ...this.keys(ip, username),
      MAX_ATTEMPTS.toString(),
      WINDOW_SECONDS.toString(),
    );

    if (result !== 1) {
      throw new HttpException(
        'Trop de tentatives de connexion. Réessayez plus tard.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }
}

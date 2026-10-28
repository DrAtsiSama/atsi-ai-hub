import { afterEach, describe, expect, it, vi } from 'vitest';

const redisMock = vi.hoisted(() => ({
  status: 'wait',
  connect: vi.fn(),
  eval: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn(function () {
    return redisMock;
  }),
}));

import { LoginRateLimitService } from './login-rate-limit.service.js';

describe('LoginRateLimitService', () => {
  afterEach(() => {
    vi.clearAllMocks();
    redisMock.status = 'wait';
  });

  it('connects to Redis before reserving an attempt', async () => {
    redisMock.connect.mockImplementation(async () => {
      redisMock.status = 'ready';
    });
    redisMock.eval.mockResolvedValue(1);

    const service = new LoginRateLimitService();

    await service.reserveAttempt('127.0.0.1', 'atsi_admin');

    expect(redisMock.connect).toHaveBeenCalledOnce();
    expect(redisMock.eval).toHaveBeenCalledOnce();

    expect(
      redisMock.connect.mock.invocationCallOrder[0],
    ).toBeLessThan(
      redisMock.eval.mock.invocationCallOrder[0],
    );

    await service.onModuleDestroy();
  });

  it('rejects authentication attempts when Redis is unavailable', async () => {
    redisMock.connect.mockRejectedValue(
      new Error('Redis indisponible'),
    );

    const service = new LoginRateLimitService();

    await expect(
      service.reserveAttempt('127.0.0.1', 'atsi_admin'),
    ).rejects.toThrow('Redis indisponible');

    expect(redisMock.eval).not.toHaveBeenCalled();

    await service.onModuleDestroy();
  });

  it('rejects attempts exceeding the configured limit', async () => {
    redisMock.status = 'ready';
    redisMock.eval.mockResolvedValue(0);

    const service = new LoginRateLimitService();

    await expect(
      service.reserveAttempt('127.0.0.1', 'atsi_admin'),
    ).rejects.toMatchObject({
      status: 429,
    });

    await service.onModuleDestroy();
  });
});

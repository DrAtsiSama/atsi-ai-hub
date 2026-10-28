import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';
import { OriginGuard } from './origin.guard.js';

describe('OriginGuard', () => {
  const guard = new OriginGuard();
  const previousOrigin = process.env.ATSI_ALLOWED_ORIGIN;

  function context(method: string, origin?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          headers: origin ? { origin } : {},
        }),
      }),
    } as ExecutionContext;
  }

  afterEach(() => {
    if (previousOrigin === undefined) {
      delete process.env.ATSI_ALLOWED_ORIGIN;
    } else {
      process.env.ATSI_ALLOWED_ORIGIN = previousOrigin;
    }
  });

  it('allows GET without an Origin header', () => {
    expect(guard.canActivate(context('GET'))).toBe(true);
  });

  it('allows POST from the configured origin', () => {
    process.env.ATSI_ALLOWED_ORIGIN = 'https://hub.example.test';

    expect(
      guard.canActivate(
        context('POST', 'https://hub.example.test'),
      ),
    ).toBe(true);
  });

  it('rejects POST from another origin', () => {
    process.env.ATSI_ALLOWED_ORIGIN = 'https://hub.example.test';

    expect(() =>
      guard.canActivate(
        context('POST', 'https://other.example.test'),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects POST without an Origin header', () => {
    process.env.ATSI_ALLOWED_ORIGIN = 'https://hub.example.test';

    expect(() =>
      guard.canActivate(context('POST')),
    ).toThrow(ForbiddenException);
  });

  it('rejects POST without configured origin', () => {
    delete process.env.ATSI_ALLOWED_ORIGIN;

    expect(() =>
      guard.canActivate(
        context('POST', 'https://hub.example.test'),
      ),
    ).toThrow(ForbiddenException);
  });
});

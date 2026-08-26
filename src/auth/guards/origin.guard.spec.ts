import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { OriginGuard } from './origin.guard';

describe('OriginGuard', () => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue({
      corsOrigins: ['http://localhost:5173'],
    }),
  } as unknown as ConfigService;
  const guard = new OriginGuard(configService);

  function contextWithOrigin(origin?: string): ExecutionContext {
    const request = {
      get: jest.fn().mockReturnValue(origin),
    } as unknown as Request;
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('allows an explicitly configured origin', () => {
    expect(guard.canActivate(contextWithOrigin('http://localhost:5173'))).toBe(
      true,
    );
  });

  it.each([undefined, 'https://attacker.example', 'invalid-origin'])(
    'rejects origin %p',
    (origin) => {
      expect(() => guard.canActivate(contextWithOrigin(origin))).toThrow(
        ForbiddenException,
      );
    },
  );
});

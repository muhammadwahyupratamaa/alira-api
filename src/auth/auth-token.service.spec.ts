import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthConfig } from '../config/auth.config';
import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService', () => {
  const config: AuthConfig = {
    accessSecret: 'test-access-secret-at-least-32-characters',
    accessTtlSeconds: 900,
    issuer: 'alira-api',
    audience: 'alira-web',
    refreshTtlSeconds: 604800,
    bcryptRounds: 10,
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(config),
  } as unknown as ConfigService;
  const service = new AuthTokenService(
    new JwtService({ secret: config.accessSecret }),
    configService,
  );

  it('creates an opaque refresh token and stores only a SHA-256 hash', () => {
    const credentials = service.createRefreshCredentials();
    const parsed = service.parseRefreshToken(credentials.token);

    expect(credentials.token).toMatch(/^[^.]+\.[A-Za-z0-9_-]{43}$/);
    expect(credentials.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(credentials.token).not.toContain(credentials.tokenHash);
    expect(parsed).toEqual({
      sessionId: credentials.sessionId,
      tokenHash: credentials.tokenHash,
    });
  });

  it('creates different secrets for different sessions', () => {
    const first = service.createRefreshCredentials();
    const second = service.createRefreshCredentials();

    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it.each(['', 'not-a-token', 'invalid.secret', 'a.b.c'])(
    'rejects malformed refresh token %p',
    (token) => {
      expect(() => service.parseRefreshToken(token)).toThrow(
        UnauthorizedException,
      );
    },
  );
});

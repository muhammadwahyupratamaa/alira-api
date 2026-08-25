import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuthConfig } from '../config/auth.config';
import { AccessTokenPayload } from './types/authenticated-user.type';

export interface RefreshCredentials {
  sessionId: string;
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface ParsedRefreshToken {
  sessionId: string;
  tokenHash: string;
}

@Injectable()
export class AuthTokenService {
  private readonly config: AuthConfig;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      expiresIn: this.config.accessTtlSeconds,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  createRefreshCredentials(): RefreshCredentials {
    const sessionId = randomUUID();
    const secret = randomBytes(32).toString('base64url');

    return {
      sessionId,
      token: `${sessionId}.${secret}`,
      tokenHash: this.hashRefreshSecret(secret),
      expiresAt: new Date(Date.now() + this.config.refreshTtlSeconds * 1000),
    };
  }

  parseRefreshToken(token: string): ParsedRefreshToken {
    const parts = token.split('.');
    const sessionId = parts[0];
    const secret = parts[1];

    if (
      parts.length !== 2 ||
      !sessionId ||
      !secret ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        sessionId,
      ) ||
      !/^[A-Za-z0-9_-]{43}$/.test(secret)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return { sessionId, tokenHash: this.hashRefreshSecret(secret) };
  }

  private hashRefreshSecret(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex');
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcrypt';
import { timingSafeEqual } from 'node:crypto';
import { AuthConfig } from '../config/auth.config';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthTokenService, ParsedRefreshToken } from './auth-token.service';
import { AuthResponse, PublicUser } from './types/public-user.type';

const BCRYPT_MAX_BYTES = 72;
const INVALID_PASSWORD_HASH =
  '$2b$10$C6UzMDM.H6dfI/f/IKxGhu8vdEDCenUnwBoIumQjkZ7WvXAC8F6pG';

interface SessionAuthResult extends AuthResponse {
  refreshToken: string;
  refreshExpiresAt: Date;
}

class RefreshReplayError extends Error {}

@Injectable()
export class AuthService {
  private readonly config: AuthConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: AuthTokenService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    this.assertPasswordByteLength(dto.password);
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await hash(dto.password, this.config.bcryptRounds);

    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash },
      });
      return this.toPublicUser(user);
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, userAgent?: string): Promise<SessionAuthResult> {
    this.assertPasswordByteLength(dto.password);
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordMatches = await compare(
      dto.password,
      user?.passwordHash ?? INVALID_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createAuthenticatedSession(user, userAgent);
  }

  async refresh(
    rawToken: string,
    userAgent?: string,
  ): Promise<SessionAuthResult> {
    const parsed = this.tokenService.parseRefreshToken(rawToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: parsed.sessionId },
      include: { user: true },
    });

    if (!session || !this.hashesMatch(session.tokenHash, parsed.tokenHash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.revokedAt) {
      // Safe MVP containment: a replayed known token revokes every active session
      // for that user because the schema has no token-family identifier yet.
      await this.revokeAllActiveSessions(session.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const next = this.tokenService.createRefreshCredentials();
    const now = new Date();

    try {
      await this.prisma.$transaction(async (transaction) => {
        const revoked = await transaction.refreshSession.updateMany({
          where: {
            id: session.id,
            tokenHash: parsed.tokenHash,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { revokedAt: now },
        });

        if (revoked.count !== 1) throw new RefreshReplayError();

        await transaction.refreshSession.create({
          data: {
            id: next.sessionId,
            userId: session.userId,
            tokenHash: next.tokenHash,
            expiresAt: next.expiresAt,
            userAgent: this.normalizeUserAgent(userAgent),
          },
        });
      });
    } catch (error: unknown) {
      if (!(error instanceof RefreshReplayError)) throw error;
      await this.revokeAllActiveSessions(session.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = await this.tokenService.signAccessToken({
      sub: session.user.id,
      email: session.user.email,
    });

    return {
      accessToken,
      user: this.toPublicUser(session.user),
      refreshToken: next.token,
      refreshExpiresAt: next.expiresAt,
    };
  }

  async logout(rawToken: string): Promise<void> {
    const parsed = this.tokenService.parseRefreshToken(rawToken);
    const session = await this.requireActiveSession(parsed);
    const revoked = await this.prisma.refreshSession.updateMany({
      where: {
        id: session.id,
        tokenHash: parsed.tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });

    if (revoked.count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllActiveSessions(userId);
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toPublicUser(user);
  }

  private async createAuthenticatedSession(
    user: {
      id: string;
      email: string;
      currency: string;
      timezone: string;
      createdAt: Date;
      updatedAt: Date;
    },
    userAgent?: string,
  ): Promise<SessionAuthResult> {
    const refresh = this.tokenService.createRefreshCredentials();
    await this.prisma.refreshSession.create({
      data: {
        id: refresh.sessionId,
        userId: user.id,
        tokenHash: refresh.tokenHash,
        expiresAt: refresh.expiresAt,
        userAgent: this.normalizeUserAgent(userAgent),
      },
    });
    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: this.toPublicUser(user),
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  private async requireActiveSession(parsed: ParsedRefreshToken): Promise<{
    id: string;
    tokenHash: string;
  }> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: parsed.sessionId },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !this.hashesMatch(session.tokenHash, parsed.tokenHash)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return session;
  }

  private async revokeAllActiveSessions(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashesMatch(storedHash: string, candidateHash: string): boolean {
    const stored = Buffer.from(storedHash, 'hex');
    const candidate = Buffer.from(candidateHash, 'hex');
    return (
      stored.length === candidate.length && timingSafeEqual(stored, candidate)
    );
  }

  private assertPasswordByteLength(password: string): void {
    if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) {
      throw new BadRequestException('Password is too long');
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeUserAgent(userAgent?: string): string | undefined {
    return userAgent?.slice(0, 512);
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    currency: string;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      currency: user.currency,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}

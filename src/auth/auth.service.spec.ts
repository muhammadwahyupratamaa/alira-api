import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthConfig } from '../config/auth.config';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from './auth.service';
import { AuthTokenService, RefreshCredentials } from './auth-token.service';

describe('AuthService refresh rotation', () => {
  interface UpdateManyArgs {
    where: {
      id: string;
      tokenHash: string;
      revokedAt: null;
    };
    data: { revokedAt: Date };
  }

  interface CreateArgs {
    data: {
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string;
    };
  }

  const oldHash = 'a'.repeat(64);
  const nextRefresh: RefreshCredentials = {
    sessionId: '89b9ba2e-0b88-4d72-aa67-e65c880757ca',
    token: '89b9ba2e-0b88-4d72-aa67-e65c880757ca.next-secret',
    tokenHash: 'b'.repeat(64),
    expiresAt: new Date(Date.now() + 60_000),
  };
  const user = {
    id: 'e385ab54-b294-438f-a216-d8722a095a5f',
    email: 'user@example.com',
    passwordHash: 'not-returned',
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const session = {
    id: 'cc53b7e1-c579-477d-ab8d-2d2ecec48fe1',
    userId: user.id,
    tokenHash: oldHash,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    userAgent: null,
    createdAt: new Date(),
    user,
  };
  const updateMany = jest
    .fn<Promise<{ count: number }>, [UpdateManyArgs]>()
    .mockResolvedValue({ count: 1 });
  const create = jest.fn<Promise<object>, [CreateArgs]>().mockResolvedValue({});
  const revokeAll = jest
    .fn<Promise<{ count: number }>, [unknown]>()
    .mockResolvedValue({ count: 1 });
  const transaction = jest
    .fn()
    .mockImplementation((callback: (client: unknown) => unknown) =>
      Promise.resolve(
        callback({
          refreshSession: { updateMany, create },
        }),
      ),
    );
  const prisma = {
    refreshSession: {
      findUnique: jest.fn().mockResolvedValue(session),
      updateMany: revokeAll,
    },
    $transaction: transaction,
  } as unknown as PrismaService;
  const tokenService = {
    parseRefreshToken: jest.fn().mockReturnValue({
      sessionId: session.id,
      tokenHash: oldHash,
    }),
    createRefreshCredentials: jest.fn().mockReturnValue(nextRefresh),
    signAccessToken: jest.fn().mockResolvedValue('access-token'),
  } as unknown as AuthTokenService;
  const authConfig: AuthConfig = {
    accessSecret: 'test-access-secret-at-least-32-characters',
    accessTtlSeconds: 900,
    issuer: 'alira-api',
    audience: 'alira-web',
    refreshTtlSeconds: 604800,
    bcryptRounds: 10,
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(authConfig),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
    revokeAll.mockResolvedValue({ count: 1 });
    create.mockResolvedValue({});
    (prisma.refreshSession.findUnique as jest.Mock).mockResolvedValue(session);
  });

  it('revokes the old session and creates the replacement atomically', async () => {
    const service = new AuthService(prisma, tokenService, configService);
    const result = await service.refresh('raw-refresh-token', 'test-agent');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: nextRefresh.token,
      }),
    );
  });

  it('rejects a reused revoked session before rotation', async () => {
    (prisma.refreshSession.findUnique as jest.Mock).mockResolvedValue({
      ...session,
      revokedAt: new Date(),
    });
    const service = new AuthService(prisma, tokenService, configService);

    await expect(service.refresh('reused-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(revokeAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: user.id, revokedAt: null } }),
    );
  });

  it('rejects an expired session before rotation', async () => {
    (prisma.refreshSession.findUnique as jest.Mock).mockResolvedValue({
      ...session,
      expiresAt: new Date(Date.now() - 1),
    });
    const service = new AuthService(prisma, tokenService, configService);

    await expect(service.refresh('expired-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a concurrent reuse when the conditional revoke loses', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const service = new AuthService(prisma, tokenService, configService);

    await expect(service.refresh('reused-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(create).not.toHaveBeenCalled();
    expect(revokeAll).toHaveBeenCalled();
  });
});

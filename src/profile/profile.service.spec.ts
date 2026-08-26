import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcrypt';
import { validate } from 'class-validator';
import { AuthConfig } from '../config/auth.config';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  interface PasswordUpdateArgs {
    data: { passwordHash: string };
  }
  interface RevokeArgs {
    where: { userId: string; revokedAt: null };
    data: { revokedAt: Date };
  }
  const now = new Date();
  const user = {
    id: '55ab9e12-8403-4fc5-b0dc-c55ab38c1a35',
    email: 'user@example.com',
    passwordHash: '',
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
    createdAt: now,
    updatedAt: now,
  };
  const findUnique = jest.fn();
  const updateUser = jest.fn();
  const transactionUserUpdate: jest.MockedFunction<
    (args: PasswordUpdateArgs) => Promise<{ count: number }>
  > = jest.fn();
  const revokeSessions: jest.MockedFunction<
    (args: RevokeArgs) => Promise<{ count: number }>
  > = jest.fn();
  const transaction = jest.fn(
    async (callback: (client: unknown) => Promise<void>): Promise<void> => {
      await callback({
        user: { updateMany: transactionUserUpdate },
        refreshSession: { updateMany: revokeSessions },
      });
    },
  );
  const prisma = {
    user: { findUnique, updateMany: updateUser },
    $transaction: transaction,
  } as unknown as PrismaService;
  const authConfig: AuthConfig = {
    accessSecret: 'x'.repeat(32),
    accessTtlSeconds: 900,
    issuer: 'alira-api',
    audience: 'alira-web',
    refreshTtlSeconds: 604800,
    bcryptRounds: 10,
  };
  const config = {
    getOrThrow: jest.fn().mockReturnValue(authConfig),
  } as unknown as ConfigService;
  let service: ProfileService;

  beforeAll(async () => {
    user.passwordHash = await hash('Password123', 10);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue(user);
    updateUser.mockResolvedValue({ count: 1 });
    transactionUserUpdate.mockResolvedValue({ count: 1 });
    revokeSessions.mockResolvedValue({ count: 2 });
    service = new ProfileService(prisma, config);
  });

  it('returns only the safe profile fields', async () => {
    const result = await service.getProfile(user.id);
    expect(result).toEqual({
      id: user.id,
      email: user.email,
      currency: 'IDR',
      timezone: 'Asia/Jakarta',
      createdAt: now,
      updatedAt: now,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('validates IANA timezone and IDR-only currency', async () => {
    const valid = Object.assign(new UpdatePreferencesDto(), {
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
    });
    const invalidZone = Object.assign(new UpdatePreferencesDto(), {
      timezone: 'Mars/Olympus',
    });
    const invalidCurrency = Object.assign(new UpdatePreferencesDto(), {
      currency: 'USD',
    });
    const validUtc = Object.assign(new UpdatePreferencesDto(), {
      timezone: 'UTC',
    });
    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(validUtc)).resolves.toHaveLength(0);
    await expect(validate(invalidZone)).resolves.not.toHaveLength(0);
    await expect(validate(invalidCurrency)).resolves.not.toHaveLength(0);
  });

  it('rejects an incorrect current password without writing', async () => {
    await expect(
      service.changePassword(user.id, {
        currentPassword: 'Wrong123',
        newPassword: 'NewPassword123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects reuse of the current password', async () => {
    await expect(
      service.changePassword(user.id, {
        currentPassword: 'Password123',
        newPassword: 'Password123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('hashes the new password and atomically updates it and revokes sessions', async () => {
    await service.changePassword(user.id, {
      currentPassword: 'Password123',
      newPassword: 'NewPassword123',
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transactionUserUpdate).toHaveBeenCalledTimes(1);
    const revokeArgs = revokeSessions.mock.calls[0]![0];
    expect(revokeArgs.where).toEqual({ userId: user.id, revokedAt: null });
    expect(revokeArgs.data.revokedAt).toBeInstanceOf(Date);
    const data = transactionUserUpdate.mock.calls[0]![0];
    expect(data.data.passwordHash).not.toBe('NewPassword123');
    await expect(
      compare('NewPassword123', data.data.passwordHash),
    ).resolves.toBe(true);
  });
});

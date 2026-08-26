import { ConflictException, NotFoundException } from '@nestjs/common';
import { Account, AccountType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  const userId = 'a49576b0-27e0-4d11-ae21-043fd13f3a5e';
  const account: Account = {
    id: '33315a2c-2240-44f3-8368-0c186cd9e49b',
    userId,
    name: 'Main Bank',
    type: AccountType.BANK,
    initialBalance: new Prisma.Decimal('1000.50'),
    isActive: true,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-26T00:00:00.000Z'),
  };
  const accountClient = {
    create: jest.fn().mockResolvedValue(account),
    findMany: jest.fn().mockResolvedValue([account]),
    findFirst: jest.fn().mockResolvedValue(account),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    count: jest.fn().mockResolvedValue(2),
  };
  const transaction = jest
    .fn()
    .mockImplementation((callback: (client: unknown) => unknown) =>
      Promise.resolve(callback({ account: accountClient })),
    );
  const prisma = {
    account: accountClient,
    $transaction: transaction,
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    accountClient.create.mockResolvedValue(account);
    accountClient.findMany.mockResolvedValue([account]);
    accountClient.findFirst.mockResolvedValue(account);
    accountClient.updateMany.mockResolvedValue({ count: 1 });
    accountClient.count.mockResolvedValue(2);
  });

  it('creates an owned account and serializes balances as strings', async () => {
    const service = new AccountsService(prisma);
    const result = await service.create(userId, {
      name: 'Main Bank',
      type: AccountType.BANK,
      initialBalance: '1000.50',
    });

    expect(accountClient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        name: 'Main Bank',
        type: AccountType.BANK,
      }) as object,
    });
    expect(result.initialBalance).toBe('1000.50');
    expect(result.currentBalance).toBe('1000.50');
    expect(result).not.toHaveProperty('userId');
  });

  it('scopes account lookup by the authenticated user', async () => {
    accountClient.findFirst.mockResolvedValue(null);
    const service = new AccountsService(prisma);

    await expect(service.findOne(userId, account.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(accountClient.findFirst).toHaveBeenCalledWith({
      where: { id: account.id, userId },
    });
  });

  it('deactivates rather than deleting an account', async () => {
    const service = new AccountsService(prisma);
    await service.deactivate(userId, account.id);

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(accountClient.updateMany).toHaveBeenCalledWith({
      where: { id: account.id, userId, isActive: true },
      data: { isActive: false },
    });
  });

  it('refuses to deactivate the last active account', async () => {
    accountClient.count.mockResolvedValue(1);
    const service = new AccountsService(prisma);

    await expect(service.deactivate(userId, account.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(accountClient.updateMany).not.toHaveBeenCalled();
  });
});

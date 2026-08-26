import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoryType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  const userId = 'd1d96744-7c35-4e27-a302-1b587e4d8b29';
  const transactionId = 'd67040a8-746b-4912-8793-6bc733567205';
  const accountId = 'b8d92354-761f-439c-90aa-e9b5faec7d4e';
  const categoryId = '10000000-0000-4000-8000-000000000001';
  const transaction = {
    id: transactionId,
    userId,
    accountId,
    categoryId,
    type: CategoryType.INCOME,
    amount: new Prisma.Decimal('100.00'),
    transactionDate: new Date('2026-08-25T17:00:00.000Z'),
    note: 'Salary',
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-26T00:00:00.000Z'),
    deletedAt: null,
    account: { id: accountId, name: 'Bank', type: 'BANK', isActive: true },
    category: {
      id: categoryId,
      name: 'Salary',
      type: CategoryType.INCOME,
      icon: null,
      color: null,
      isDefault: true,
      isActive: true,
    },
  };
  const transactionClient = {
    create: jest.fn().mockResolvedValue(transaction),
    findFirst: jest.fn().mockResolvedValue(transaction),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
    },
    account: {
      findFirst: jest.fn().mockResolvedValue({ isActive: true }),
    },
    category: {
      findFirst: jest.fn().mockResolvedValue({
        id: categoryId,
        type: CategoryType.INCOME,
        isActive: true,
      }),
    },
    transaction: transactionClient,
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      timezone: 'Asia/Jakarta',
    });
    (prisma.account.findFirst as jest.Mock).mockResolvedValue({
      isActive: true,
    });
    (prisma.category.findFirst as jest.Mock).mockResolvedValue({
      id: categoryId,
      type: CategoryType.INCOME,
      isActive: true,
    });
    transactionClient.create.mockResolvedValue(transaction);
    transactionClient.findFirst.mockResolvedValue(transaction);
    transactionClient.updateMany.mockResolvedValue({ count: 1 });
  });

  it('rejects a zero amount', async () => {
    const service = new TransactionsService(prisma);
    await expect(
      service.create(userId, {
        accountId,
        categoryId,
        type: CategoryType.INCOME,
        amount: '0',
        transactionDate: '2026-08-26',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionClient.create).not.toHaveBeenCalled();
  });

  it('rejects a transaction type that does not match its category', async () => {
    const service = new TransactionsService(prisma);
    await expect(
      service.create(userId, {
        accountId,
        categoryId,
        type: CategoryType.EXPENSE,
        amount: '10',
        transactionDate: '2026-08-26',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects future transaction dates in the user timezone', async () => {
    const service = new TransactionsService(prisma);
    await expect(
      service.create(userId, {
        accountId,
        categoryId,
        type: CategoryType.INCOME,
        amount: '10',
        transactionDate: '2999-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft-deletes only an active owned transaction', async () => {
    const service = new TransactionsService(prisma);
    await service.softDelete(userId, transactionId);

    expect(transactionClient.updateMany).toHaveBeenCalledWith({
      where: { id: transactionId, userId, deletedAt: null },
      data: { deletedAt: expect.any(Date) as Date },
    });
  });

  it('rejects deleting an absent, foreign, or already deleted transaction', async () => {
    transactionClient.updateMany.mockResolvedValue({ count: 0 });
    const service = new TransactionsService(prisma);

    await expect(
      service.softDelete(userId, transactionId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restores a deleted transaction even when linked resources are inactive', async () => {
    const deletedTransaction = {
      ...transaction,
      deletedAt: new Date(),
      account: { ...transaction.account, isActive: false },
      category: { ...transaction.category, isActive: false },
    };
    transactionClient.findFirst
      .mockResolvedValueOnce(deletedTransaction)
      .mockResolvedValueOnce({ ...deletedTransaction, deletedAt: null });
    const service = new TransactionsService(prisma);
    const result = await service.restore(userId, transactionId);

    expect(transactionClient.updateMany).toHaveBeenCalledWith({
      where: { id: transactionId, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    expect(result.deletedAt).toBeNull();
    expect((prisma.account.findFirst as jest.Mock).mock.calls).toHaveLength(0);
    expect((prisma.category.findFirst as jest.Mock).mock.calls).toHaveLength(0);
  });

  it('duplicates with a new record dated today after active-resource checks', async () => {
    const service = new TransactionsService(prisma);
    const result = await service.duplicate(userId, transactionId);

    expect(transactionClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          accountId,
          categoryId,
          amount: transaction.amount,
          note: transaction.note,
        }) as object,
      }),
    );
    expect(result.amount).toBe('100.00');
  });
});

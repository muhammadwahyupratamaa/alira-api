/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { CategoryType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const decimal = (value: string): Prisma.Decimal => new Prisma.Decimal(value);

describe('DashboardService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    account: { findFirst: jest.fn(), findMany: jest.fn() },
    transaction: { groupBy: jest.fn(), findMany: jest.fn() },
    category: { findMany: jest.fn() },
  } as unknown as PrismaService;
  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(prisma);
    jest.mocked(prisma.user.findUnique).mockResolvedValue({
      timezone: 'Asia/Jakarta',
    } as never);
  });

  it('calculates active-account balance, monthly totals, and previous comparisons with Decimal', async () => {
    jest
      .mocked(prisma.account.findMany)
      .mockResolvedValue([
        { id: 'a', initialBalance: decimal('1000.10') },
      ] as never);
    jest
      .mocked(prisma.transaction.groupBy)
      .mockResolvedValueOnce([
        { type: CategoryType.INCOME, _sum: { amount: decimal('500.20') } },
        { type: CategoryType.EXPENSE, _sum: { amount: decimal('100.05') } },
      ] as never)
      .mockResolvedValueOnce([
        { type: CategoryType.INCOME, _sum: { amount: decimal('200.00') } },
        { type: CategoryType.EXPENSE, _sum: { amount: decimal('50.00') } },
      ] as never)
      .mockResolvedValueOnce([
        { type: CategoryType.INCOME, _sum: { amount: decimal('100.00') } },
        { type: CategoryType.EXPENSE, _sum: { amount: decimal('25.00') } },
      ] as never);

    await expect(
      service.summary('user', { month: 8, year: 2026 }),
    ).resolves.toEqual(
      expect.objectContaining({
        totalBalance: '1400.25',
        monthlyIncome: '200.00',
        monthlyExpense: '50.00',
        netSaving: '150.00',
        incomeComparison: { previous: '100.00', percentageChange: '100.00' },
        netSavingComparison: { previous: '75.00', percentageChange: '100.00' },
      }),
    );
  });

  it('returns null percentage changes when previous values are zero', async () => {
    jest.mocked(prisma.account.findMany).mockResolvedValue([]);
    jest.mocked(prisma.transaction.groupBy).mockResolvedValue([] as never);
    const result = await service.summary('user', { month: 8, year: 2026 });
    expect(result.totalBalance).toBe('0.00');
    expect(result.incomeComparison.percentageChange).toBeNull();
    expect(result.expenseComparison.percentageChange).toBeNull();
    expect(result.netSavingComparison.percentageChange).toBeNull();
  });

  it('returns sorted category breakdown safely with inactive categories', async () => {
    jest.mocked(prisma.transaction.groupBy).mockResolvedValue([
      { categoryId: 'c1', _sum: { amount: decimal('75') } },
      { categoryId: 'c2', _sum: { amount: decimal('25') } },
    ] as never);
    jest.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'c1', name: 'Food', icon: null, color: null },
      { id: 'c2', name: 'Old', icon: 'x', color: '#000000' },
    ] as never);
    const result = await service.categoryBreakdown('user', {
      month: 8,
      year: 2026,
      type: CategoryType.EXPENSE,
    });
    expect(result.total).toBe('100.00');
    expect(result.data.map(({ percentage }) => percentage)).toEqual([
      '75.00',
      '25.00',
    ]);
  });

  it('loads recent transactions with relations in one query and formats user-local dates', async () => {
    jest.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        id: 't',
        type: CategoryType.EXPENSE,
        amount: decimal('1.10'),
        transactionDate: new Date('2026-08-25T17:00:00Z'),
        note: null,
        createdAt: new Date('2026-08-25T18:00:00Z'),
        account: { id: 'a', name: 'Cash', type: 'CASH' },
        category: { id: 'c', name: 'Food', icon: null, color: null },
      },
    ] as never);
    const result = await service.recentTransactions('user', { limit: 5 });
    expect(result[0]).toEqual(
      expect.objectContaining({
        amount: '1.10',
        transactionDate: '2026-08-26',
      }),
    );
    const call = jest.mocked(prisma.transaction.findMany).mock.calls[0]?.[0];
    expect(call).toEqual(expect.objectContaining({ take: 5 }));
    expect(call).toHaveProperty('include.account');
    expect(call).toHaveProperty('include.category');
  });

  it('hides another user account as not found', async () => {
    jest.mocked(prisma.account.findFirst).mockResolvedValue(null);
    await expect(
      service.summary('user', { accountId: 'other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

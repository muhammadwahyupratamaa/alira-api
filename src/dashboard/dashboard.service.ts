import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { formatInTimeZone } from '../transactions/transaction-date.util';
import { dashboardPeriod } from './dashboard-period.util';
import {
  CategoryBreakdownQueryDto,
  DashboardPeriodQueryDto,
  RecentTransactionsQueryDto,
} from './dto/dashboard-query.dto';
import {
  CategoryBreakdownResponseDto,
  DashboardSummaryDto,
  MetricComparisonDto,
  RecentTransactionDto,
} from './dto/dashboard-response.dto';

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(
    userId: string,
    query: DashboardPeriodQueryDto,
  ): Promise<DashboardSummaryDto> {
    const timeZone = await this.timeZone(userId);
    await this.requireAccount(userId, query.accountId);
    const period = dashboardPeriod(timeZone, query.month, query.year);
    const accountFilter = query.accountId ? { accountId: query.accountId } : {};
    const activeAccounts = await this.prisma.account.findMany({
      where: {
        userId,
        isActive: true,
        ...(query.accountId ? { id: query.accountId } : {}),
      },
      select: { id: true, initialBalance: true },
    });
    const activeIds = activeAccounts.map(({ id }) => id);
    const [balanceGroups, currentGroups, previousGroups] = await Promise.all([
      activeIds.length === 0
        ? Promise.resolve([])
        : this.prisma.transaction.groupBy({
            by: ['type'],
            where: { userId, accountId: { in: activeIds }, deletedAt: null },
            _sum: { amount: true },
          }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          userId,
          ...accountFilter,
          deletedAt: null,
          transactionDate: { gte: period.start, lt: period.end },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          userId,
          ...accountFilter,
          deletedAt: null,
          transactionDate: {
            gte: period.previousStart,
            lt: period.previousEnd,
          },
        },
        _sum: { amount: true },
      }),
    ]);
    const initial = activeAccounts.reduce(
      (sum, account) => sum.plus(account.initialBalance),
      ZERO,
    );
    const balance = this.totals(balanceGroups);
    const current = this.totals(currentGroups);
    const previous = this.totals(previousGroups);
    const currentNet = current.income.minus(current.expense);
    const previousNet = previous.income.minus(previous.expense);
    return {
      month: period.month,
      year: period.year,
      totalBalance: initial
        .plus(balance.income)
        .minus(balance.expense)
        .toFixed(2),
      monthlyIncome: current.income.toFixed(2),
      monthlyExpense: current.expense.toFixed(2),
      netSaving: currentNet.toFixed(2),
      incomeComparison: this.comparison(current.income, previous.income),
      expenseComparison: this.comparison(current.expense, previous.expense),
      netSavingComparison: this.comparison(currentNet, previousNet),
    };
  }

  async categoryBreakdown(
    userId: string,
    query: CategoryBreakdownQueryDto,
  ): Promise<CategoryBreakdownResponseDto> {
    const timeZone = await this.timeZone(userId);
    await this.requireAccount(userId, query.accountId);
    const period = dashboardPeriod(timeZone, query.month, query.year);
    const groups = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: query.type,
        deletedAt: null,
        ...(query.accountId ? { accountId: query.accountId } : {}),
        transactionDate: { gte: period.start, lt: period.end },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
    const categories =
      groups.length === 0
        ? []
        : await this.prisma.category.findMany({
            where: {
              id: { in: groups.map(({ categoryId }) => categoryId) },
              OR: [{ userId }, { userId: null, isDefault: true }],
            },
            select: { id: true, name: true, icon: true, color: true },
          });
    const categoryMap = new Map(
      categories.map((category) => [category.id, category]),
    );
    const total = groups.reduce(
      (sum, group) => sum.plus(group._sum.amount ?? ZERO),
      ZERO,
    );
    return {
      month: period.month,
      year: period.year,
      type: query.type,
      total: total.toFixed(2),
      data: groups.flatMap((group) => {
        const category = categoryMap.get(group.categoryId);
        if (!category) return [];
        const amount = group._sum.amount ?? ZERO;
        return [
          {
            categoryId: category.id,
            name: category.name,
            icon: category.icon,
            color: category.color,
            total: amount.toFixed(2),
            percentage: total.isZero()
              ? '0.00'
              : amount.times(100).dividedBy(total).toFixed(2),
          },
        ];
      }),
    };
  }

  async recentTransactions(
    userId: string,
    query: RecentTransactionsQueryDto,
  ): Promise<RecentTransactionDto[]> {
    const timeZone = await this.timeZone(userId);
    await this.requireAccount(userId, query.accountId);
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(query.accountId ? { accountId: query.accountId } : {}),
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: query.limit,
      include: {
        account: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    });
    return transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount.toFixed(2),
      transactionDate: formatInTimeZone(transaction.transactionDate, timeZone),
      note: transaction.note,
      createdAt: transaction.createdAt,
      account: transaction.account,
      category: transaction.category,
    }));
  }

  private async timeZone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user.timezone;
  }
  private async requireAccount(
    userId: string,
    accountId?: string,
  ): Promise<void> {
    if (!accountId) return;
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Account not found');
  }
  private totals(
    groups: { type: CategoryType; _sum: { amount: Prisma.Decimal | null } }[],
  ): { income: Prisma.Decimal; expense: Prisma.Decimal } {
    let income = ZERO;
    let expense = ZERO;
    for (const group of groups) {
      if (group.type === CategoryType.INCOME)
        income = group._sum.amount ?? ZERO;
      else expense = group._sum.amount ?? ZERO;
    }
    return { income, expense };
  }
  private comparison(
    current: Prisma.Decimal,
    previous: Prisma.Decimal,
  ): MetricComparisonDto {
    return {
      previous: previous.toFixed(2),
      percentageChange: previous.isZero()
        ? null
        : current
            .minus(previous)
            .times(100)
            .dividedBy(previous.abs())
            .toFixed(2),
    };
  }
}

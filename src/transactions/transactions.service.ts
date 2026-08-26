import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CategoryType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  TransactionQueryDto,
  TransactionSort,
} from './dto/transaction-query.dto';
import {
  TransactionListResponseDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import {
  assertNotFutureDate,
  dateOnlyToUtcStart,
  formatInTimeZone,
  nextDateUtcStart,
  parseDateOnly,
  todayInTimeZone,
} from './transaction-date.util';

const transactionInclude = {
  account: {
    select: { id: true, name: true, type: true, isActive: true },
  },
  category: {
    select: {
      id: true,
      name: true,
      type: true,
      icon: true,
      color: true,
      isDefault: true,
      isActive: true,
    },
  },
} satisfies Prisma.TransactionInclude;

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: typeof transactionInclude;
}>;

const SORT_ORDERS: Record<
  TransactionSort,
  Prisma.TransactionOrderByWithRelationInput[]
> = {
  [TransactionSort.TRANSACTION_DATE_DESC]: [
    { transactionDate: 'desc' },
    { createdAt: 'desc' },
  ],
  [TransactionSort.TRANSACTION_DATE_ASC]: [
    { transactionDate: 'asc' },
    { createdAt: 'asc' },
  ],
  [TransactionSort.CREATED_AT_DESC]: [{ createdAt: 'desc' }],
  [TransactionSort.CREATED_AT_ASC]: [{ createdAt: 'asc' }],
  [TransactionSort.AMOUNT_DESC]: [{ amount: 'desc' }, { createdAt: 'desc' }],
  [TransactionSort.AMOUNT_ASC]: [{ amount: 'asc' }, { createdAt: 'desc' }],
};

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    query: TransactionQueryDto,
  ): Promise<TransactionListResponseDto> {
    const timeZone = await this.getUserTimeZone(userId);
    const where = this.buildListWhere(userId, query, timeZone);
    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: transactionInclude,
        orderBy: SORT_ORDERS[query.sort],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions.map((transaction) =>
        this.toResponse(transaction, timeZone),
      ),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const timeZone = await this.getUserTimeZone(userId);
    const dateValue = dto.transactionDate ?? todayInTimeZone(timeZone);
    assertNotFutureDate(dateValue, timeZone);
    const amount = this.positiveAmount(dto.amount);
    await this.requireActiveAccount(userId, dto.accountId);
    const category = await this.requireVisibleCategory(
      userId,
      dto.categoryId,
      true,
    );
    this.assertMatchingType(dto.type, category.type);

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        type: dto.type,
        amount,
        transactionDate: dateOnlyToUtcStart(dateValue, timeZone),
        note: dto.note,
      },
      include: transactionInclude,
    });
    return this.toResponse(transaction, timeZone);
  }

  async findOne(userId: string, id: string): Promise<TransactionResponseDto> {
    const timeZone = await this.getUserTimeZone(userId);
    const transaction = await this.requireActiveTransaction(userId, id);
    return this.toResponse(transaction, timeZone);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const timeZone = await this.getUserTimeZone(userId);
    const existing = await this.requireActiveTransaction(userId, id);

    if (dto.accountId && dto.accountId !== existing.account.id) {
      await this.requireActiveAccount(userId, dto.accountId);
    }

    const category =
      dto.categoryId && dto.categoryId !== existing.category.id
        ? await this.requireVisibleCategory(userId, dto.categoryId, true)
        : existing.category;
    const type = dto.type ?? existing.type;
    this.assertMatchingType(type, category.type);

    const data: Prisma.TransactionUncheckedUpdateManyInput = {};
    if (dto.accountId !== undefined) data.accountId = dto.accountId;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.amount !== undefined) data.amount = this.positiveAmount(dto.amount);
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.transactionDate !== undefined) {
      assertNotFutureDate(dto.transactionDate, timeZone);
      data.transactionDate = dateOnlyToUtcStart(dto.transactionDate, timeZone);
    }

    const updated = await this.prisma.transaction.updateMany({
      where: { id, userId, deletedAt: null },
      data,
    });
    if (updated.count !== 1)
      throw new NotFoundException('Transaction not found');
    const transaction = await this.requireActiveTransaction(userId, id);
    return this.toResponse(transaction, timeZone);
  }

  async duplicate(userId: string, id: string): Promise<TransactionResponseDto> {
    const timeZone = await this.getUserTimeZone(userId);
    const source = await this.requireActiveTransaction(userId, id);
    await this.requireActiveAccount(userId, source.account.id);
    const category = await this.requireVisibleCategory(
      userId,
      source.category.id,
      true,
    );
    this.assertMatchingType(source.type, category.type);

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        accountId: source.account.id,
        categoryId: source.category.id,
        type: source.type,
        amount: source.amount,
        transactionDate: dateOnlyToUtcStart(
          todayInTimeZone(timeZone),
          timeZone,
        ),
        note: source.note,
      },
      include: transactionInclude,
    });
    return this.toResponse(transaction, timeZone);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const deleted = await this.prisma.transaction.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (deleted.count !== 1)
      throw new NotFoundException('Transaction not found');
  }

  async restore(userId: string, id: string): Promise<TransactionResponseDto> {
    const timeZone = await this.getUserTimeZone(userId);
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      include: transactionInclude,
    });
    if (!existing) throw new NotFoundException('Transaction not found');

    const restored = await this.prisma.transaction.updateMany({
      where: { id, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (restored.count !== 1)
      throw new NotFoundException('Transaction not found');
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
      include: transactionInclude,
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    return this.toResponse(transaction, timeZone);
  }

  private buildListWhere(
    userId: string,
    query: TransactionQueryDto,
    timeZone: string,
  ): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = { userId, deletedAt: null };
    if (query.accountId) where.accountId = query.accountId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.type) where.type = query.type;
    if (query.search) {
      where.note = { contains: query.search, mode: 'insensitive' };
    }

    if (query.startDate || query.endDate) {
      if (query.startDate) parseDateOnly(query.startDate);
      if (query.endDate) parseDateOnly(query.endDate);
      if (query.startDate && query.endDate && query.startDate > query.endDate) {
        throw new BadRequestException('startDate must not be after endDate');
      }
      where.transactionDate = {
        ...(query.startDate
          ? { gte: dateOnlyToUtcStart(query.startDate, timeZone) }
          : {}),
        ...(query.endDate
          ? { lt: nextDateUtcStart(query.endDate, timeZone) }
          : {}),
      };
    }
    return where;
  }

  private async requireActiveTransaction(
    userId: string,
    id: string,
  ): Promise<TransactionWithRelations> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
      include: transactionInclude,
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  private async requireActiveAccount(
    userId: string,
    id: string,
  ): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
      select: { isActive: true },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (!account.isActive) throw new BadRequestException('Account is inactive');
  }

  private async requireVisibleCategory(
    userId: string,
    id: string,
    requireActive: boolean,
  ): Promise<{ id: string; type: CategoryType; isActive: boolean }> {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        OR: [
          { userId: null, isDefault: true },
          { userId, isDefault: false },
        ],
      },
      select: { id: true, type: true, isActive: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (requireActive && !category.isActive) {
      throw new BadRequestException('Category is inactive');
    }
    return category;
  }

  private positiveAmount(value: string): Prisma.Decimal {
    const amount = new Prisma.Decimal(value);
    if (!amount.greaterThan(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    return amount;
  }

  private assertMatchingType(
    transactionType: CategoryType,
    categoryType: CategoryType,
  ): void {
    if (transactionType !== categoryType) {
      throw new BadRequestException(
        'Transaction type must match category type',
      );
    }
  }

  private async getUserTimeZone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) throw new UnauthorizedException();
    return user.timezone;
  }

  private toResponse(
    transaction: TransactionWithRelations,
    timeZone: string,
  ): TransactionResponseDto {
    return {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount.toFixed(2),
      transactionDate: formatInTimeZone(transaction.transactionDate, timeZone),
      note: transaction.note,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      deletedAt: transaction.deletedAt,
      account: transaction.account,
      category: transaction.category,
    };
  }
}

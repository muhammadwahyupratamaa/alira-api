import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Account, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AccountResponseDto } from './dto/account-response.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

const MAX_TRANSACTION_RETRIES = 3;

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        initialBalance: new Prisma.Decimal(dto.initialBalance),
      },
    });
    return this.toResponse(account, account.initialBalance);
  }

  async findAll(userId: string): Promise<AccountResponseDto[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    const balances = await this.currentBalances(userId, accounts);
    return accounts.map((account) =>
      this.toResponse(
        account,
        balances.get(account.id) ?? account.initialBalance,
      ),
    );
  }

  async findOne(userId: string, id: string): Promise<AccountResponseDto> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!account) throw new NotFoundException('Account not found');
    const balances = await this.currentBalances(userId, [account]);
    return this.toResponse(
      account,
      balances.get(account.id) ?? account.initialBalance,
    );
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    const data: Prisma.AccountUpdateManyMutationInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.initialBalance !== undefined) {
      data.initialBalance = new Prisma.Decimal(dto.initialBalance);
    }

    const updated = await this.prisma.account.updateMany({
      where: { id, userId },
      data,
    });
    if (updated.count !== 1) throw new NotFoundException('Account not found');
    return this.findOne(userId, id);
  }

  async deactivate(userId: string, id: string): Promise<void> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
      try {
        await this.deactivateInTransaction(userId, id);
        return;
      } catch (error: unknown) {
        if (
          !this.isTransactionConflict(error) ||
          attempt === MAX_TRANSACTION_RETRIES
        ) {
          throw error;
        }
      }
    }
  }

  private async deactivateInTransaction(
    userId: string,
    id: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const account = await transaction.account.findFirst({
          where: { id, userId },
          select: { id: true, isActive: true },
        });
        if (!account) throw new NotFoundException('Account not found');
        if (!account.isActive) return;

        const activeCount = await transaction.account.count({
          where: { userId, isActive: true },
        });
        if (activeCount <= 1) {
          throw new ConflictException(
            'At least one active account must remain',
          );
        }

        const updated = await transaction.account.updateMany({
          where: { id, userId, isActive: true },
          data: { isActive: false },
        });
        if (updated.count !== 1) {
          throw new NotFoundException('Account not found');
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async currentBalances(
    userId: string,
    accounts: Pick<Account, 'id' | 'initialBalance'>[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (accounts.length === 0) return new Map();
    const accountIds = accounts.map(({ id }) => id);
    const totals = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { userId, accountId: { in: accountIds }, deletedAt: null },
      _sum: { amount: true },
    });
    const balances = new Map(
      accounts.map(({ id, initialBalance }) => [id, initialBalance]),
    );
    for (const total of totals) {
      const balance = balances.get(total.accountId);
      const amount = total._sum.amount;
      if (!balance || !amount) continue;
      balances.set(
        total.accountId,
        total.type === 'INCOME' ? balance.plus(amount) : balance.minus(amount),
      );
    }
    return balances;
  }

  private toResponse(
    account: Account,
    currentBalance: Prisma.Decimal,
  ): AccountResponseDto {
    const initialBalance = account.initialBalance.toFixed(2);
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      initialBalance,
      currentBalance: currentBalance.toFixed(2),
      isActive: account.isActive,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private isTransactionConflict(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    );
  }
}

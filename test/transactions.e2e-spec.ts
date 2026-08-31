import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import { Server } from 'node:http';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CategoryType } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

interface TransactionBody {
  id: string;
  type: CategoryType;
  amount: string;
  transactionDate: string;
  note: string | null;
  deletedAt: string | null;
  account: { id: string; name: string; isActive: boolean };
  category: { id: string; name: string; isActive: boolean };
  userId?: string;
}

interface AccountBody {
  id: string;
  currentBalance: string;
}

describe('Transactions (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let prisma: PrismaService;
  let userAToken: string;
  let userBToken: string;
  let accountA: AccountBody;
  let spareAccountA: AccountBody;
  let accountB: AccountBody;
  let expenseCategoryA: { id: string };
  let expenseCategoryB: { id: string };
  let salaryCategoryId: string;
  let incomeTransaction: TransactionBody;
  let expenseTransaction: TransactionBody;
  let deletedTransactionB: TransactionBody;
  const password = 'Password123';
  const today = todayJakarta();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    await prisma.transaction.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.category.deleteMany({ where: { isDefault: false } });
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();

    userAToken = await createUserAndLogin('transactions-a@example.com');
    userBToken = await createUserAndLogin('transactions-b@example.com');
    accountA = await createAccount(userAToken, 'Bank A', '1000.00');
    spareAccountA = await createAccount(userAToken, 'Cash A', '0');
    accountB = await createAccount(userBToken, 'Bank B', '500.00');
    expenseCategoryA = await createCategory(userAToken, 'Coffee A');
    expenseCategoryB = await createCategory(userBToken, 'Coffee B');
    salaryCategoryId = (
      await prisma.category.findFirstOrThrow({
        where: { name: 'Salary', type: CategoryType.INCOME, isDefault: true },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.category.deleteMany({ where: { isDefault: false } });
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('requires JWT and rejects invalid financial or ownership input', async () => {
    await request(httpServer).get('/api/v1/transactions').expect(401);
    const invalidPayloads = [
      transactionPayload(accountA.id, salaryCategoryId, 'INCOME', '0'),
      transactionPayload(accountA.id, salaryCategoryId, 'INCOME', '-1'),
      transactionPayload(accountA.id, salaryCategoryId, 'EXPENSE', '10'),
      {
        ...transactionPayload(accountA.id, salaryCategoryId, 'INCOME', '10'),
        transactionDate: '2999-01-01',
      },
      {
        ...transactionPayload(accountA.id, salaryCategoryId, 'INCOME', '10'),
        userId: 'fd90444f-587d-42f1-992d-c08068883942',
      },
    ];
    for (const payload of invalidPayloads) {
      await request(httpServer)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload)
        .expect(400);
    }
    await request(httpServer)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .send(transactionPayload(accountB.id, salaryCategoryId, 'INCOME', '10'))
      .expect(404);
    await request(httpServer)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .send(
        transactionPayload(accountA.id, expenseCategoryB.id, 'EXPENSE', '10'),
      )
      .expect(404);
  });

  it('enforces transaction ownership at the database boundary', async () => {
    const userA = await prisma.user.findUniqueOrThrow({
      where: { email: 'transactions-a@example.com' },
    });

    await expect(
      prisma.transaction.create({
        data: {
          userId: userA.id,
          accountId: accountB.id,
          categoryId: salaryCategoryId,
          type: CategoryType.INCOME,
          amount: '10.00',
          transactionDate: new Date(),
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.transaction.create({
        data: {
          userId: userA.id,
          accountId: accountA.id,
          categoryId: expenseCategoryB.id,
          type: CategoryType.EXPENSE,
          amount: '10.00',
          transactionDate: new Date(),
        },
      }),
    ).rejects.toThrow();

    const owned = await prisma.transaction.create({
      data: {
        userId: userA.id,
        accountId: accountA.id,
        categoryId: salaryCategoryId,
        type: CategoryType.INCOME,
        amount: '10.00',
        transactionDate: new Date(),
      },
    });
    await expect(
      prisma.transaction.update({
        where: { id: owned.id },
        data: { accountId: accountB.id },
      }),
    ).rejects.toThrow();
    await prisma.transaction.delete({ where: { id: owned.id } });
  });

  it('creates income and expense and calculates current balance', async () => {
    incomeTransaction = await createTransaction(
      userAToken,
      transactionPayload(accountA.id, salaryCategoryId, 'INCOME', '500', {
        note: 'Monthly salary',
        transactionDate: '2026-08-20',
      }),
    );
    expenseTransaction = await createTransaction(
      userAToken,
      transactionPayload(accountA.id, expenseCategoryA.id, 'EXPENSE', '200', {
        note: 'Morning coffee',
        transactionDate: '2026-08-21',
      }),
    );

    expect(incomeTransaction.amount).toBe('500.00');
    expect(incomeTransaction.userId).toBeUndefined();
    expect(await currentBalance(userAToken, accountA.id)).toBe('1300.00');
  });

  it('updates a transaction and updates balance without changing initial balance', async () => {
    const response = await request(httpServer)
      .patch(`/api/v1/transactions/${expenseTransaction.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ amount: '250.25', note: 'Updated coffee' })
      .expect(200);
    expenseTransaction = response.body as TransactionBody;

    expect(expenseTransaction.amount).toBe('250.25');
    expect(await currentBalance(userAToken, accountA.id)).toBe('1249.75');
    const storedAccount = await prisma.account.findUniqueOrThrow({
      where: { id: accountA.id },
    });
    expect(storedAccount.initialBalance.toFixed(2)).toBe('1000.00');

    await request(httpServer)
      .patch(`/api/v1/categories/${expenseCategoryA.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ type: CategoryType.INCOME })
      .expect(409);
  });

  it('preserves exact decimal cents through update, delete, restore, and duplicate', async () => {
    const preciseAccount = await createAccount(userAToken, 'Precise', '0.01');
    const income = await createTransaction(
      userAToken,
      transactionPayload(preciseAccount.id, salaryCategoryId, 'INCOME', '0.20'),
    );
    const expense = await createTransaction(
      userAToken,
      transactionPayload(
        preciseAccount.id,
        expenseCategoryA.id,
        'EXPENSE',
        '0.10',
      ),
    );
    expect(await currentBalance(userAToken, preciseAccount.id)).toBe('0.11');
    await request(httpServer)
      .patch(`/api/v1/transactions/${expense.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ amount: '0.01' })
      .expect(200);
    expect(await currentBalance(userAToken, preciseAccount.id)).toBe('0.20');
    await request(httpServer)
      .delete(`/api/v1/transactions/${income.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(204);
    expect(await currentBalance(userAToken, preciseAccount.id)).toBe('0.00');
    await request(httpServer)
      .post(`/api/v1/transactions/${income.id}/restore`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const duplicate = await request(httpServer)
      .post(`/api/v1/transactions/${income.id}/duplicate`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);
    expect((duplicate.body as TransactionBody).amount).toBe('0.20');
    expect(await currentBalance(userAToken, preciseAccount.id)).toBe('0.40');
  });

  it('accepts the Decimal(19,2) maximum and rejects excess precision', async () => {
    const maximum = '99999999999999999.99';
    const response = await request(httpServer)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .send(
        transactionPayload(accountA.id, salaryCategoryId, 'INCOME', maximum),
      )
      .expect(201);
    expect((response.body as TransactionBody).amount).toBe(maximum);
    await request(httpServer)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .send(
        transactionPayload(accountA.id, salaryCategoryId, 'INCOME', '0.001'),
      )
      .expect(400);
    await request(httpServer)
      .delete(`/api/v1/transactions/${(response.body as TransactionBody).id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(204);
  });

  it('supports combined filters, search, sorting, and pagination', async () => {
    await createTransaction(
      userAToken,
      transactionPayload(accountA.id, salaryCategoryId, 'INCOME', '75', {
        note: 'Filter target bonus',
        transactionDate: '2026-08-22',
      }),
    );
    const filtered = await request(httpServer)
      .get('/api/v1/transactions')
      .query({
        startDate: '2026-08-22',
        endDate: '2026-08-22',
        accountId: accountA.id,
        categoryId: salaryCategoryId,
        type: 'INCOME',
        search: 'TARGET',
        page: 1,
        limit: 1,
        sort: 'amount:asc',
      })
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const body = filtered.body as {
      data: TransactionBody[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };

    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.note).toBe('Filter target bonus');
    expect(body).toEqual(
      expect.objectContaining({ page: 1, limit: 1, total: 1, totalPages: 1 }),
    );

    await request(httpServer)
      .get('/api/v1/transactions?sort=raw_sql&limit=101')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(400);
  });

  it('soft-deletes, hides, and restores a transaction with accurate balances', async () => {
    await request(httpServer)
      .delete(`/api/v1/transactions/${incomeTransaction.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(204);
    await request(httpServer)
      .get(`/api/v1/transactions/${incomeTransaction.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(404);
    await request(httpServer)
      .delete(`/api/v1/transactions/${incomeTransaction.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(404);
    expect(await currentBalance(userAToken, accountA.id)).toBe('824.75');

    const restored = await request(httpServer)
      .post(`/api/v1/transactions/${incomeTransaction.id}/restore`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect((restored.body as TransactionBody).deletedAt).toBeNull();
    expect(await currentBalance(userAToken, accountA.id)).toBe('1324.75');
    await request(httpServer)
      .post(`/api/v1/transactions/${incomeTransaction.id}/restore`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(404);
  });

  it('duplicates transaction data with a new ID and today date', async () => {
    const response = await request(httpServer)
      .post(`/api/v1/transactions/${expenseTransaction.id}/duplicate`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);
    const duplicate = response.body as TransactionBody;

    expect(duplicate.id).not.toBe(expenseTransaction.id);
    expect(duplicate.amount).toBe(expenseTransaction.amount);
    expect(duplicate.note).toBe(expenseTransaction.note);
    expect(duplicate.account.id).toBe(expenseTransaction.account.id);
    expect(duplicate.category.id).toBe(expenseTransaction.category.id);
    expect(duplicate.transactionDate).toBe(today);
  });

  it('restores with inactive references but refuses duplicate with them', async () => {
    const source = await createTransaction(
      userAToken,
      transactionPayload(
        spareAccountA.id,
        expenseCategoryA.id,
        'EXPENSE',
        '25',
      ),
    );
    await request(httpServer)
      .delete(`/api/v1/transactions/${source.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(204);
    await request(httpServer)
      .delete(`/api/v1/accounts/${spareAccountA.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(204);
    await request(httpServer)
      .delete(`/api/v1/categories/${expenseCategoryA.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(204);

    await request(httpServer)
      .post(`/api/v1/transactions/${source.id}/restore`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/transactions/${source.id}/duplicate`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(400);
  });

  it('does not leak another user transaction through any operation', async () => {
    const foreign = await createTransaction(
      userBToken,
      transactionPayload(accountB.id, expenseCategoryB.id, 'EXPENSE', '10'),
    );
    const auth = `Bearer ${userAToken}`;
    await request(httpServer)
      .get(`/api/v1/transactions/${foreign.id}`)
      .set('Authorization', auth)
      .expect(404);
    await request(httpServer)
      .patch(`/api/v1/transactions/${foreign.id}`)
      .set('Authorization', auth)
      .send({ amount: '20' })
      .expect(404);
    await request(httpServer)
      .post(`/api/v1/transactions/${foreign.id}/duplicate`)
      .set('Authorization', auth)
      .expect(404);
    await request(httpServer)
      .delete(`/api/v1/transactions/${foreign.id}`)
      .set('Authorization', auth)
      .expect(404);

    await request(httpServer)
      .delete(`/api/v1/transactions/${foreign.id}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(204);
    deletedTransactionB = foreign;
    await request(httpServer)
      .post(`/api/v1/transactions/${deletedTransactionB.id}/restore`)
      .set('Authorization', auth)
      .expect(404);
  });

  async function createUserAndLogin(email: string): Promise<string> {
    await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);
    const login = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return (login.body as { accessToken: string }).accessToken;
  }

  async function createAccount(
    token: string,
    name: string,
    initialBalance: string,
  ): Promise<AccountBody> {
    const response = await request(httpServer)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, type: 'BANK', initialBalance })
      .expect(201);
    return response.body as AccountBody;
  }

  async function createCategory(
    token: string,
    name: string,
  ): Promise<{ id: string }> {
    const response = await request(httpServer)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, type: CategoryType.EXPENSE })
      .expect(201);
    return response.body as { id: string };
  }

  async function createTransaction(
    token: string,
    payload: Record<string, unknown>,
  ): Promise<TransactionBody> {
    const response = await request(httpServer)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
    return response.body as TransactionBody;
  }

  async function currentBalance(token: string, id: string): Promise<string> {
    const response = await request(httpServer)
      .get(`/api/v1/accounts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return (response.body as AccountBody).currentBalance;
  }
});

function transactionPayload(
  accountId: string,
  categoryId: string,
  type: CategoryType | 'INCOME' | 'EXPENSE',
  amount: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return { accountId, categoryId, type, amount, ...extras };
}

function todayJakarta(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

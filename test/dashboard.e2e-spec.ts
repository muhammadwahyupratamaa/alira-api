import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import { Server } from 'node:http';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  AccountType,
  CategoryType,
  Prisma,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

interface SummaryBody {
  totalBalance: string;
  monthlyIncome: string;
  monthlyExpense: string;
  netSaving: string;
  incomeComparison: { previous: string; percentageChange: string | null };
}
interface BreakdownBody {
  data: { name: string; percentage: string }[];
}
interface RecentBody {
  amount: string;
  account: { id: string };
  category: { name: string };
}
interface LoginBody {
  accessToken: string;
}

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let tokenA: string;
  let userA: string;
  let userB: string;
  let activeAccount: string;
  let inactiveAccount: string;
  let otherAccount: string;
  const password = 'Password123';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
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
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    await prisma.transaction.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.category.deleteMany({ where: { isDefault: false } });
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    ({ token: tokenA, userId: userA } = await register(
      'dashboard-a@example.com',
    ));
    ({ userId: userB } = await register('dashboard-b@example.com'));
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.category.deleteMany({ where: { isDefault: false } });
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('requires JWT, validates queries, and returns an empty state', async () => {
    await request(server).get('/api/v1/dashboard/summary').expect(401);
    await request(server)
      .get('/api/v1/dashboard/summary?month=13')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);
    await request(server)
      .get('/api/v1/dashboard/recent-transactions?limit=21')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);
    const response = await request(server)
      .get('/api/v1/dashboard/summary?month=8&year=2026')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const body = response.body as SummaryBody;
    expect(body).toEqual(
      expect.objectContaining({
        totalBalance: '0.00',
        monthlyIncome: '0.00',
        monthlyExpense: '0.00',
        netSaving: '0.00',
      }),
    );
    expect(body.incomeComparison.percentageChange).toBeNull();
  });

  it('aggregates multiple accounts/categories, inactive history, and excludes soft deletes', async () => {
    const accounts = await Promise.all([
      prisma.account.create({
        data: {
          userId: userA,
          name: 'Active',
          type: AccountType.BANK,
          initialBalance: new Prisma.Decimal('1000'),
          isActive: true,
        },
      }),
      prisma.account.create({
        data: {
          userId: userA,
          name: 'Inactive',
          type: AccountType.CASH,
          initialBalance: new Prisma.Decimal('500'),
          isActive: false,
        },
      }),
      prisma.account.create({
        data: {
          userId: userB,
          name: 'Other',
          type: AccountType.BANK,
          initialBalance: new Prisma.Decimal('9000'),
        },
      }),
    ]);
    activeAccount = accounts[0].id;
    inactiveAccount = accounts[1].id;
    otherAccount = accounts[2].id;
    const defaultExpense = await prisma.category.findFirstOrThrow({
      where: { name: 'Food', type: CategoryType.EXPENSE, isDefault: true },
    });
    const defaultIncome = await prisma.category.findFirstOrThrow({
      where: { name: 'Salary', type: CategoryType.INCOME, isDefault: true },
    });
    const inactiveCategory = await prisma.category.create({
      data: {
        userId: userA,
        name: 'Archived',
        type: CategoryType.EXPENSE,
        isActive: false,
      },
    });
    const rows = [
      [
        activeAccount,
        defaultIncome.id,
        CategoryType.INCOME,
        '200',
        '2026-08-01T00:00:00Z',
        null,
      ],
      [
        activeAccount,
        defaultExpense.id,
        CategoryType.EXPENSE,
        '50',
        '2026-08-15T00:00:00Z',
        null,
      ],
      [
        inactiveAccount,
        inactiveCategory.id,
        CategoryType.EXPENSE,
        '25',
        '2026-08-20T00:00:00Z',
        null,
      ],
      [
        activeAccount,
        defaultExpense.id,
        CategoryType.EXPENSE,
        '999',
        '2026-08-21T00:00:00Z',
        new Date(),
      ],
      [
        activeAccount,
        defaultIncome.id,
        CategoryType.INCOME,
        '100',
        '2026-07-15T00:00:00Z',
        null,
      ],
    ] as const;
    for (const [accountId, categoryId, type, amount, date, deletedAt] of rows) {
      await prisma.transaction.create({
        data: {
          userId: userA,
          accountId,
          categoryId,
          type,
          amount: new Prisma.Decimal(amount),
          transactionDate: new Date(date),
          deletedAt,
        },
      });
    }
    const summary = await request(server)
      .get('/api/v1/dashboard/summary?month=8&year=2026')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const summaryBody = summary.body as SummaryBody;
    expect(summaryBody).toEqual(
      expect.objectContaining({
        totalBalance: '1250.00',
        monthlyIncome: '200.00',
        monthlyExpense: '75.00',
        netSaving: '125.00',
      }),
    );
    expect(summaryBody.incomeComparison).toEqual({
      previous: '100.00',
      percentageChange: '100.00',
    });
    const breakdown = await request(server)
      .get('/api/v1/dashboard/category-breakdown?month=8&year=2026')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const breakdownBody = breakdown.body as BreakdownBody;
    expect(breakdownBody.data.map((item) => item.name)).toEqual([
      'Food',
      'Archived',
    ]);
    expect(breakdownBody.data.map((item) => item.percentage)).toEqual([
      '66.67',
      '33.33',
    ]);
  });

  it('scopes every result by owned account and hides another user resources', async () => {
    const filtered = await request(server)
      .get(
        `/api/v1/dashboard/summary?month=8&year=2026&accountId=${inactiveAccount}`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(filtered.body).toEqual(
      expect.objectContaining({
        totalBalance: '0.00',
        monthlyExpense: '25.00',
      }),
    );
    for (const path of [
      'summary',
      'category-breakdown',
      'recent-transactions',
    ]) {
      await request(server)
        .get(`/api/v1/dashboard/${path}?accountId=${otherAccount}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    }
  });

  it('returns recent transactions ordered with account/category relations and no deleted rows', async () => {
    const response = await request(server)
      .get('/api/v1/dashboard/recent-transactions?limit=2')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const body = response.body as RecentBody[];
    expect(body).toHaveLength(2);
    expect(body[0]?.amount).toBe('25.00');
    expect(body[0]?.account.id).toBe(inactiveAccount);
    expect(body[0]?.category.name).toBe('Archived');
    expect(body.some((row) => row.amount === '999.00')).toBe(false);
  });

  async function register(
    email: string,
  ): Promise<{ token: string; userId: string }> {
    await request(server)
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const body = response.body as LoginBody;
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: body.accessToken, userId: user.id };
  }
});

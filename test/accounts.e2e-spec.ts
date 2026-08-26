import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import { Server } from 'node:http';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AccountType, Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

interface AccountResponseBody {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: string;
  currentBalance: string;
  isActive: boolean;
  userId?: string;
}

describe('Accounts (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let prisma: PrismaService;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let userAPrimaryAccount: AccountResponseBody;
  let userASecondaryAccount: AccountResponseBody;
  let userBAccount: AccountResponseBody;
  const password = 'Password123';

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
    await prisma.refreshSession.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();

    const userA = await createUserAndLogin('accounts-a@example.com');
    userAId = userA.userId;
    userAToken = userA.accessToken;
    const userB = await createUserAndLogin('accounts-b@example.com');
    userBId = userB.userId;
    userBToken = userB.accessToken;
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('requires JWT authentication for every account endpoint', async () => {
    await request(httpServer).get('/api/v1/accounts').expect(401);
    await request(httpServer)
      .post('/api/v1/accounts')
      .send({ name: 'Cash', type: 'CASH', initialBalance: '0' })
      .expect(401);
  });

  it('rejects invalid types, negative/numeric balances, and userId injection', async () => {
    const invalidPayloads = [
      { name: 'Crypto', type: 'CRYPTO', initialBalance: '0' },
      { name: 'Cash', type: 'CASH', initialBalance: '-1' },
      { name: 'Cash', type: 'CASH', initialBalance: 100 },
      {
        name: 'Cash',
        type: 'CASH',
        initialBalance: '0',
        userId: userBId,
      },
    ];

    for (const payload of invalidPayloads) {
      await request(httpServer)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload)
        .expect(400);
    }
  });

  it('enforces non-negative balances at the database layer', async () => {
    await expect(
      prisma.account.create({
        data: {
          userId: userAId,
          name: 'Invalid balance',
          type: AccountType.CASH,
          initialBalance: new Prisma.Decimal('-0.01'),
        },
      }),
    ).rejects.toThrow();
  });

  it('creates accounts and returns monetary values only as strings', async () => {
    userAPrimaryAccount = await createAccount(userAToken, {
      name: '  Main Bank  ',
      type: AccountType.BANK,
      initialBalance: '1500000.50',
    });
    userASecondaryAccount = await createAccount(userAToken, {
      name: 'Cash',
      type: AccountType.CASH,
      initialBalance: '0',
    });
    userBAccount = await createAccount(userBToken, {
      name: 'Wallet B',
      type: AccountType.EWALLET,
      initialBalance: '25000',
    });

    expect(userAPrimaryAccount).toEqual(
      expect.objectContaining({
        name: 'Main Bank',
        initialBalance: '1500000.50',
        currentBalance: '1500000.50',
        isActive: true,
      }),
    );
    expect(userASecondaryAccount.initialBalance).toBe('0.00');
    expect(userASecondaryAccount.currentBalance).toBe('0.00');
    expect(userAPrimaryAccount.userId).toBeUndefined();
  });

  it('lists and fetches only accounts owned by the authenticated user', async () => {
    const list = await request(httpServer)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const accounts = list.body as AccountResponseBody[];

    expect(accounts).toHaveLength(2);
    expect(accounts.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        userAPrimaryAccount.id,
        userASecondaryAccount.id,
      ]),
    );
    expect(accounts.map(({ id }) => id)).not.toContain(userBAccount.id);

    await request(httpServer)
      .get(`/api/v1/accounts/${userAPrimaryAccount.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
  });

  it('treats another user account as not found for read, update, and delete', async () => {
    const authorization = `Bearer ${userAToken}`;
    await request(httpServer)
      .get(`/api/v1/accounts/${userBAccount.id}`)
      .set('Authorization', authorization)
      .expect(404);
    await request(httpServer)
      .patch(`/api/v1/accounts/${userBAccount.id}`)
      .set('Authorization', authorization)
      .send({ name: 'Stolen' })
      .expect(404);
    await request(httpServer)
      .delete(`/api/v1/accounts/${userBAccount.id}`)
      .set('Authorization', authorization)
      .expect(404);
  });

  it('updates an owned account without accepting ownership changes', async () => {
    const response = await request(httpServer)
      .patch(`/api/v1/accounts/${userAPrimaryAccount.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'Salary Bank',
        initialBalance: '1750000.25',
      })
      .expect(200);
    const body = response.body as AccountResponseBody;

    expect(body.name).toBe('Salary Bank');
    expect(body.initialBalance).toBe('1750000.25');
    expect(body.currentBalance).toBe('1750000.25');
    expect(body.userId).toBeUndefined();
  });

  it('soft-disables an account, keeps it readable, and preserves one active account', async () => {
    await request(httpServer)
      .delete(`/api/v1/accounts/${userASecondaryAccount.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(204);

    const inactive = await request(httpServer)
      .get(`/api/v1/accounts/${userASecondaryAccount.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect((inactive.body as AccountResponseBody).isActive).toBe(false);
    expect(
      await prisma.account.count({
        where: { id: userASecondaryAccount.id },
      }),
    ).toBe(1);

    await request(httpServer)
      .delete(`/api/v1/accounts/${userAPrimaryAccount.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(409);
  });

  async function createUserAndLogin(email: string): Promise<{
    userId: string;
    accessToken: string;
  }> {
    const registration = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);
    const login = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      userId: (registration.body as { id: string }).id,
      accessToken: (login.body as AuthResponseBody).accessToken,
    };
  }

  async function createAccount(
    accessToken: string,
    payload: { name: string; type: AccountType; initialBalance: string },
  ): Promise<AccountResponseBody> {
    const response = await request(httpServer)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);
    return response.body as AccountResponseBody;
  }
});

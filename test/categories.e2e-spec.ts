import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import { Server } from 'node:http';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CategoryType } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}

interface CategoryResponseBody {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  isActive: boolean;
  userId?: string;
}

describe('Categories (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let prisma: PrismaService;
  let userAToken: string;
  let userBToken: string;
  let userBId: string;
  let defaultSalary: CategoryResponseBody;
  let userACategory: CategoryResponseBody;
  let userBCategory: CategoryResponseBody;
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
    await prisma.category.deleteMany({ where: { isDefault: false } });
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();

    const userA = await createUserAndLogin('categories-a@example.com');
    userAToken = userA.accessToken;
    const userB = await createUserAndLogin('categories-b@example.com');
    userBId = userB.userId;
    userBToken = userB.accessToken;
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await prisma.category.deleteMany({ where: { isDefault: false } });
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('requires JWT authentication for all category endpoints', async () => {
    await request(httpServer).get('/api/v1/categories').expect(401);
    await request(httpServer)
      .post('/api/v1/categories')
      .send({ name: 'Freelance', type: 'INCOME' })
      .expect(401);
  });

  it('returns all twelve active system defaults', async () => {
    const response = await request(httpServer)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const categories = response.body as CategoryResponseBody[];

    expect(categories).toHaveLength(12);
    expect(categories.every(({ isDefault }) => isDefault)).toBe(true);
    expect(categories.every(({ isActive }) => isActive)).toBe(true);
    expect(categories.every(({ userId }) => userId === undefined)).toBe(true);
    expect(
      categories.filter(({ type }) => type === CategoryType.INCOME),
    ).toHaveLength(4);
    expect(
      categories.filter(({ type }) => type === CategoryType.EXPENSE),
    ).toHaveLength(8);
    defaultSalary = categories.find(({ name }) => name === 'Salary')!;
    expect(defaultSalary).toBeDefined();
  });

  it('rejects invalid filters, colors, and ownership/default injection', async () => {
    await request(httpServer)
      .get('/api/v1/categories?type=TRANSFER')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(400);
    await request(httpServer)
      .get('/api/v1/categories?includeInactive=yes')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(400);

    const invalidPayloads = [
      { name: 'Invalid color', type: 'EXPENSE', color: 'red' },
      { name: 'Injected', type: 'EXPENSE', userId: userBId },
      { name: 'Injected', type: 'EXPENSE', isDefault: true },
      { name: '   ', type: 'EXPENSE' },
    ];
    for (const payload of invalidPayloads) {
      await request(httpServer)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload)
        .expect(400);
    }
  });

  it('creates trimmed custom categories with optional icon and color', async () => {
    userACategory = await createCategory(userAToken, {
      name: '  Coffee  ',
      type: CategoryType.EXPENSE,
      icon: 'cup',
      color: '#abc',
    });
    userBCategory = await createCategory(userBToken, {
      name: 'Coffee',
      type: CategoryType.EXPENSE,
      color: '#AABBCC',
    });

    expect(userACategory).toEqual(
      expect.objectContaining({
        name: 'Coffee',
        icon: 'cup',
        color: '#abc',
        isDefault: false,
        isActive: true,
      }),
    );
    expect(userACategory.userId).toBeUndefined();
  });

  it('enforces case-insensitive uniqueness per user and type', async () => {
    await request(httpServer)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'cOfFeE', type: CategoryType.EXPENSE })
      .expect(409);

    const sameNameDifferentType = await createCategory(userAToken, {
      name: 'Coffee',
      type: CategoryType.INCOME,
    });
    expect(sameNameDifferentType.type).toBe(CategoryType.INCOME);
  });

  it('filters by type and never lists another user custom category', async () => {
    const response = await request(httpServer)
      .get('/api/v1/categories?type=EXPENSE')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    const categories = response.body as CategoryResponseBody[];

    expect(categories.every(({ type }) => type === CategoryType.EXPENSE)).toBe(
      true,
    );
    expect(categories.map(({ id }) => id)).toContain(userACategory.id);
    expect(categories.map(({ id }) => id)).not.toContain(userBCategory.id);
  });

  it('updates an owned custom category', async () => {
    const response = await request(httpServer)
      .patch(`/api/v1/categories/${userACategory.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Cafe', icon: null, color: '#123456' })
      .expect(200);
    const body = response.body as CategoryResponseBody;

    expect(body.name).toBe('Cafe');
    expect(body.icon).toBeNull();
    expect(body.color).toBe('#123456');
  });

  it('prevents editing or disabling a default category', async () => {
    await request(httpServer)
      .patch(`/api/v1/categories/${defaultSalary.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Changed Salary' })
      .expect(403);
    await request(httpServer)
      .delete(`/api/v1/categories/${defaultSalary.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(403);

    const stored = await prisma.category.findUniqueOrThrow({
      where: { id: defaultSalary.id },
    });
    expect(stored.name).toBe('Salary');
    expect(stored.isActive).toBe(true);
  });

  it('treats another user custom category as not found', async () => {
    await request(httpServer)
      .patch(`/api/v1/categories/${userBCategory.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Stolen' })
      .expect(404);
    await request(httpServer)
      .delete(`/api/v1/categories/${userBCategory.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(404);
  });

  it('soft-disables custom categories and includes them only when requested', async () => {
    await request(httpServer)
      .delete(`/api/v1/categories/${userACategory.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(204);

    const activeOnly = await listCategoryIds(userAToken, '');
    expect(activeOnly).not.toContain(userACategory.id);
    const includingInactive = await listCategoryIds(
      userAToken,
      '?includeInactive=true',
    );
    expect(includingInactive).toContain(userACategory.id);

    const stored = await prisma.category.findUniqueOrThrow({
      where: { id: userACategory.id },
    });
    expect(stored.isActive).toBe(false);
  });

  it('rejects recreating an inactive custom category case-insensitively', async () => {
    await request(httpServer)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'cAfE', type: CategoryType.EXPENSE })
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

  async function createCategory(
    accessToken: string,
    payload: {
      name: string;
      type: CategoryType;
      icon?: string;
      color?: string;
    },
  ): Promise<CategoryResponseBody> {
    const response = await request(httpServer)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);
    return response.body as CategoryResponseBody;
  }

  async function listCategoryIds(
    accessToken: string,
    query: string,
  ): Promise<string[]> {
    const response = await request(httpServer)
      .get(`/api/v1/categories${query}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    return (response.body as CategoryResponseBody[]).map(({ id }) => id);
  }
});

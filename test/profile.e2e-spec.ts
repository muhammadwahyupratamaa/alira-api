import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import { Server } from 'node:http';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

interface ProfileBody {
  id: string;
  email: string;
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  passwordHash?: string;
  refreshSessions?: unknown;
}
interface AuthBody {
  accessToken: string;
}

describe('Profile (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let userBId: string;
  let refreshA1: string;
  let refreshA2: string;
  const password = 'Password123';
  const nextPassword = 'NewPassword123';

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
    await register('profile-a@example.com');
    await register('profile-b@example.com');
    const loginA1 = await login('profile-a@example.com', password);
    const loginA2 = await login('profile-a@example.com', password);
    const loginB = await login('profile-b@example.com', password);
    tokenA = loginA2.token;
    tokenB = loginB.token;
    refreshA1 = loginA1.cookie;
    refreshA2 = loginA2.cookie;
    userAId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'profile-a@example.com' },
      })
    ).id;
    userBId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'profile-b@example.com' },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('requires JWT and returns only the authenticated safe profile', async () => {
    await request(server).get('/api/v1/profile').expect(401);
    const response = await request(server)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const body = response.body as ProfileBody;
    expect(body).toEqual(
      expect.objectContaining({
        id: userAId,
        email: 'profile-a@example.com',
        currency: 'IDR',
        timezone: 'Asia/Jakarta',
      }),
    );
    expect(body.passwordHash).toBeUndefined();
    expect(body.refreshSessions).toBeUndefined();
  });

  it('updates only owned preferences and rejects unsupported or foreign fields', async () => {
    const response = await request(server)
      .patch('/api/v1/profile/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ timezone: 'Asia/Makassar', currency: 'IDR' })
      .expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: userAId,
        timezone: 'Asia/Makassar',
        currency: 'IDR',
      }),
    );
    await request(server)
      .patch('/api/v1/profile/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ currency: 'USD' })
      .expect(400);
    await request(server)
      .patch('/api/v1/profile/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ timezone: 'Invalid/Zone' })
      .expect(400);
    await request(server)
      .patch('/api/v1/profile/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userId: userBId, email: 'takeover@example.com' })
      .expect(400);
    const userB = await prisma.user.findUniqueOrThrow({
      where: { id: userBId },
    });
    expect(userB.timezone).toBe('Asia/Jakarta');
    expect(userB.email).toBe('profile-b@example.com');
  });

  it('rejects foreign password DTO fields', async () => {
    await request(server)
      .patch('/api/v1/profile/password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        currentPassword: password,
        newPassword: nextPassword,
        userId: userBId,
      })
      .expect(400);
  });

  it('changes password, clears cookie, and atomically revokes every session', async () => {
    const response = await request(server)
      .patch('/api/v1/profile/password')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Cookie', refreshA2)
      .send({ currentPassword: password, newPassword: nextPassword })
      .expect(204);
    const setCookies = response.headers['set-cookie'] as unknown as string[];
    expect(setCookies.join(';')).toEqual(
      expect.stringContaining('alira_refresh='),
    );
    expect(setCookies.join(';')).toEqual(
      expect.stringContaining('Path=/api/v1/auth'),
    );
    const activeSessions = await prisma.refreshSession.count({
      where: { userId: userAId, revokedAt: null },
    });
    expect(activeSessions).toBe(0);
    for (const cookie of [refreshA1, refreshA2]) {
      await request(server)
        .post('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', cookie)
        .expect(401);
    }
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'profile-a@example.com', password })
      .expect(401);
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'profile-a@example.com', password: nextPassword })
      .expect(200);
    await request(server)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)
      .then((result) => {
        expect((result.body as ProfileBody).id).toBe(userBId);
      });
  });

  async function register(email: string): Promise<void> {
    await request(server)
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);
  }

  async function login(
    email: string,
    value: string,
  ): Promise<{ token: string; cookie: string }> {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: value })
      .expect(200);
    const body = response.body as AuthBody;
    const header = response.headers['set-cookie'] as unknown;
    const cookies = Array.isArray(header) ? (header as string[]) : [];
    const cookie = cookies[0]?.split(';')[0];
    if (!cookie) throw new Error('Refresh cookie missing');
    return { token: body.accessToken, cookie };
  }
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import { Server } from 'node:http';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

interface AuthBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
  refreshToken?: string;
  passwordHash?: string;
}

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let prisma: PrismaService;
  const origin = 'http://localhost:5173';
  const email = 'auth-user@example.com';
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
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('registers with a normalized email and never exposes a password', async () => {
    const response = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ email: `  ${email.toUpperCase()}  `, password })
      .expect(201);
    const body = response.body as AuthBody['user'] & { passwordHash?: string };

    expect(body.email).toBe(email);
    expect(body.passwordHash).toBeUndefined();
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash).not.toBe(password);
  });

  it('rejects duplicate email and unknown DTO properties', async () => {
    await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(409);
    await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ email: 'other@example.com', password, role: 'admin' })
      .expect(400);
  });

  it('rejects invalid credentials', async () => {
    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword1' })
      .expect(401);
  });

  it('logs in, returns only access token JSON, and protects /auth/me', async () => {
    const response = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: email.toUpperCase(), password })
      .expect(200);
    const body = response.body as AuthBody;
    const cookie = getRefreshCookie(response.headers['set-cookie']);

    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toBeUndefined();
    expect(body.passwordHash).toBeUndefined();
    expect(cookie.attributes).toEqual(
      expect.arrayContaining(['HttpOnly', 'SameSite=Lax', 'Path=/api/v1/auth']),
    );
    const [cookieName, rawRefreshToken] = cookie.header.split('=');
    expect(cookieName).toBe('alira_refresh');
    expect(rawRefreshToken).toEqual(expect.any(String));
    const storedSession = await prisma.refreshSession.findFirstOrThrow({
      orderBy: { createdAt: 'desc' },
    });
    expect(storedSession.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedSession.tokenHash).not.toBe(rawRefreshToken);
    await request(httpServer)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200)
      .expect(({ body: meBody }) => {
        expect((meBody as AuthBody['user']).email).toBe(email);
      });
  });

  it('rotates refresh tokens atomically and rejects reuse', async () => {
    const login = await loginAndReadTokens();

    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .set('Cookie', login.cookie.header)
      .expect(403);

    const refreshResponse = await request(httpServer)
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', login.cookie.header)
      .expect(200);
    const nextCookie = getRefreshCookie(refreshResponse.headers['set-cookie']);

    expect(nextCookie.header).not.toBe(login.cookie.header);
    expect((refreshResponse.body as AuthBody).refreshToken).toBeUndefined();
    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', login.cookie.header)
      .expect(401);

    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', 'alira_refresh=malformed')
      .expect(401);
  });

  it('logs out one session and rejects its reuse', async () => {
    const login = await loginAndReadTokens();
    await request(httpServer)
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', login.cookie.header)
      .expect(204);
    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', login.cookie.header)
      .expect(401);
  });

  it('logs out all sessions for the authenticated user', async () => {
    const first = await loginAndReadTokens();
    const second = await loginAndReadTokens();

    await request(httpServer)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .set('Cookie', first.cookie.header)
      .expect(204);

    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', first.cookie.header)
      .expect(401);
    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', second.cookie.header)
      .expect(401);
  });

  it('rate limits repeated login attempts', async () => {
    let status = 0;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword1' });
      status = response.status;
      if (status === 429) break;
    }
    expect(status).toBe(429);
  });

  async function loginAndReadTokens(): Promise<{
    accessToken: string;
    cookie: { header: string; attributes: string[] };
  }> {
    const response = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      accessToken: (response.body as AuthBody).accessToken,
      cookie: getRefreshCookie(response.headers['set-cookie']),
    };
  }
});

function getRefreshCookie(value: string[] | string | undefined): {
  header: string;
  attributes: string[];
} {
  if (!value) throw new Error('Expected refresh cookie');
  const serialized = Array.isArray(value) ? value[0] : value;
  if (!serialized) throw new Error('Expected refresh cookie');
  const parts = serialized.split(';').map((part) => part.trim());
  const header = parts[0];
  if (!header) throw new Error('Expected refresh cookie');
  return { header, attributes: parts.slice(1) };
}

import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.API_PREFIX = 'api/v1';
const databaseUrl = new URL(
  process.env.DATABASE_URL ??
    'postgresql://alira:alira_dev_password@localhost:5432/alira',
);
databaseUrl.searchParams.set('schema', 'auth_e2e');
process.env.DATABASE_URL = databaseUrl.toString();
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.SWAGGER_ENABLED = 'false';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
process.env.JWT_ACCESS_TTL_SECONDS = '900';
process.env.JWT_ISSUER = 'alira-api';
process.env.JWT_AUDIENCE = 'alira-web';
process.env.REFRESH_TOKEN_TTL_SECONDS = '604800';
process.env.REFRESH_COOKIE_NAME = 'alira_refresh';
process.env.BCRYPT_ROUNDS = '10';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'lax';

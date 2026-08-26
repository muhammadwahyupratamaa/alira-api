import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    NODE_ENV: 'test',
    PORT: '3000',
    API_PREFIX: 'api/v1',
    DATABASE_URL: 'postgresql://alira:secret@localhost:5432/alira_test',
    CORS_ORIGIN: 'http://localhost:5173',
    SWAGGER_ENABLED: 'false',
    JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
    JWT_ACCESS_TTL_SECONDS: '900',
    JWT_ISSUER: 'alira-api',
    JWT_AUDIENCE: 'alira-web',
    REFRESH_TOKEN_TTL_SECONDS: '604800',
    REFRESH_COOKIE_NAME: 'alira_refresh',
    BCRYPT_ROUNDS: '10',
    COOKIE_SECURE: 'false',
    COOKIE_SAME_SITE: 'lax',
  };

  it('converts valid environment values', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.PORT).toBe(3000);
    expect(result.SWAGGER_ENABLED).toBe(false);
  });

  it('rejects a missing database URL', () => {
    const environment = { ...validEnvironment, DATABASE_URL: undefined };

    expect(() => validateEnvironment(environment)).toThrow(
      'Environment validation failed',
    );
  });

  it('requires secure cookies in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow('Environment validation failed');
  });
});

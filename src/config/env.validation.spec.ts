import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    NODE_ENV: 'test',
    PORT: '3000',
    API_PREFIX: 'api/v1',
    DATABASE_URL: 'postgresql://alira:secret@localhost:5432/alira_test',
    CORS_ORIGIN: 'http://localhost:5173',
    SWAGGER_ENABLED: 'false',
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
});

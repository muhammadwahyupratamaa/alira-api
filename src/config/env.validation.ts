import * as Joi from 'joi';

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  API_PREFIX: string;
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  SWAGGER_ENABLED: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  REFRESH_TOKEN_TTL_SECONDS: number;
  REFRESH_COOKIE_NAME: string;
  BCRYPT_ROUNDS: number;
  COOKIE_SECURE: boolean;
  COOKIE_SAME_SITE: 'lax' | 'strict' | 'none';
}

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().trim().min(1).default('api/v1'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  CORS_ORIGIN: Joi.string().trim().min(1).required(),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().positive().default(900),
  JWT_ISSUER: Joi.string().trim().min(1).default('alira-api'),
  JWT_AUDIENCE: Joi.string().trim().min(1).default('alira-web'),
  REFRESH_TOKEN_TTL_SECONDS: Joi.number().integer().positive().default(604800),
  REFRESH_COOKIE_NAME: Joi.string()
    .pattern(/^[A-Za-z0-9_-]+$/)
    .default('alira_refresh'),
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(14).default(10),
  COOKIE_SECURE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .when('NODE_ENV', { is: 'production', then: Joi.valid(true) })
    .default(false),
  COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
}).unknown(true) as Joi.ObjectSchema<EnvironmentVariables>;

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validationResult = environmentSchema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  if (validationResult.error) {
    throw new Error(
      `Environment validation failed: ${validationResult.error.message}`,
    );
  }

  if (
    validationResult.value.COOKIE_SAME_SITE === 'none' &&
    !validationResult.value.COOKIE_SECURE
  ) {
    throw new Error(
      'Environment validation failed: COOKIE_SECURE must be true when COOKIE_SAME_SITE is none',
    );
  }

  return validationResult.value;
}

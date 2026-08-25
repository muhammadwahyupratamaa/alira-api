import * as Joi from 'joi';

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  API_PREFIX: string;
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  SWAGGER_ENABLED: boolean;
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

  return validationResult.value;
}

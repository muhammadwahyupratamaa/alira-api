import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  accessSecret: string;
  accessTtlSeconds: number;
  issuer: string;
  audience: string;
  refreshTtlSeconds: number;
  bcryptRounds: number;
}

export default registerAs(
  'auth',
  (): AuthConfig => ({
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    issuer: process.env.JWT_ISSUER ?? 'alira-api',
    audience: process.env.JWT_AUDIENCE ?? 'alira-web',
    refreshTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 604800),
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 10),
  }),
);

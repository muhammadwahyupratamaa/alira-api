import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

const databaseUrl = new URL(env('DATABASE_URL'));
databaseUrl.searchParams.set('schema', 'auth_e2e');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl.toString(),
  },
});

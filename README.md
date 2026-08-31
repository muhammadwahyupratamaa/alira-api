# Alira API

REST API untuk Alira Personal Finance Tracker, dibangun dengan NestJS, strict TypeScript, PostgreSQL, dan Prisma. Fitur MVP mencakup authentication, account, category, transaction, dashboard, profile/settings, Swagger, dan database-aware health check.

## Persyaratan

- Node.js 26 dan npm
- Docker dengan Compose plugin
- PostgreSQL 18 (langsung atau melalui Docker)

## Environment

Salin `.env.example` menjadi `.env` untuk development, lalu ganti seluruh nilai `change-me`/placeholder. Variabel utama:

| Variable                                               | Kegunaan                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `DATABASE_URL`                                         | PostgreSQL URL; gunakan hostname `db` di production Compose |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`    | Inisialisasi PostgreSQL                                     |
| `PORT`, `API_PORT`, `API_PREFIX`                       | Port internal, port host, dan prefix API                    |
| `CORS_ORIGIN`                                          | Origin frontend yang diizinkan, dipisahkan koma             |
| `JWT_ACCESS_SECRET`                                    | Secret acak minimal 32 karakter                             |
| `JWT_ACCESS_TTL_SECONDS`, `JWT_ISSUER`, `JWT_AUDIENCE` | Konfigurasi access token                                    |
| `REFRESH_TOKEN_TTL_SECONDS`, `REFRESH_COOKIE_NAME`     | Refresh session/cookie                                      |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE`                    | Kebijakan cookie; secure wajib di production                |
| `BCRYPT_ROUNDS`                                        | Cost bcrypt, minimal 10                                     |
| `SWAGGER_ENABLED`                                      | Mengaktifkan Swagger                                        |

Secret production harus disimpan di secret manager atau environment host di luar Git. Jangan commit `.env` atau credential nyata.

## Local development

```bash
cp .env.example .env
npm ci
npm run docker:up
npm run db:migrate:deploy
npm run start:dev
```

PostgreSQL development memakai `compose.yaml` dan port lokal `POSTGRES_PORT`. Pastikan `DATABASE_URL` memakai credential yang sama dengan `POSTGRES_*`. Hentikan dengan `npm run docker:down`.

## Quality checks

```bash
npm run prisma:validate
npm run prisma:generate
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`npm run verify` menjalankan gate utama berurutan. E2E memakai schema PostgreSQL `auth_e2e` dan menjalankan migration deploy sebelum test.

## Production image dan Compose

`Dockerfile` menyediakan target `runtime` non-root dan target `migration` terpisah. Build memakai konfigurasi Prisma generate-only sehingga tidak membutuhkan database credential:

```bash
docker build --target runtime -t alira-api:local .
docker compose -f compose.production.yaml build
```

Untuk smoke test lokal, sediakan environment production yang aman dan gunakan `DATABASE_URL` dengan hostname `db`, misalnya `postgresql://alira:<password>@db:5432/alira`. PostgreSQL production Compose tidak dipublikasikan ke host dan memakai named volume.

Urutan update production wajib:

```bash
npm run docker:prod:build
npm run docker:prod:migrate
npm run docker:prod:up
```

Runner migration memakai target image tersendiri dengan Prisma CLI. Kegagalan `prisma migrate deploy` harus menghentikan rollout; jangan lanjutkan update API. Jangan gunakan `prisma migrate dev` atau seed development di production. Service API juga bergantung pada migration yang sukses.

Container menjalankan `node dist/main.js` sebagai user non-root. Docker health check mengikuti `API_PREFIX` (default `GET /api/v1/health`); `init: true` membantu forwarding signal dan process reaping.

## API documentation dan health

- Swagger: `http://localhost:3000/docs` ketika `SWAGGER_ENABLED=true`
- Health: `http://localhost:3000/api/v1/health`

## Continuous Integration

`.github/workflows/ci.yml` berjalan pada pull request ke `main` dan push ke `main` menggunakan Node.js 26 serta PostgreSQL 18. CI menjalankan `npm ci`, migration deploy dengan test credential, Prisma validation/generation, format, lint, strict typecheck, unit test, coverage, E2E, build, dan Docker target builds. Workflow ini tidak melakukan deployment, backup, rollback, atau secret rotation.

Refresh-token replay policy: a replay of a known revoked refresh session revokes all active sessions for that user. This safe MVP containment remains in place until refresh-session families are modeled explicitly. Malformed or unknown tokens do not revoke any session.

Migrations are forward-only. `prisma migrate deploy` must complete before an API rollout; recovery requires a reviewed forward migration rather than editing applied history. The dashboard currently has monthly summary/breakdown/recent endpoints, but no multi-period chart API.

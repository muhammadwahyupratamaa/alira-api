# Alira API Repository Guidelines

## Product context

Alira is a mobile-first personal finance tracker for fast income and expense recording, account balances, and monthly insights. Read `docs/PRD.md` before implementing any feature and keep changes within the requested MVP scope.

## Required technology

- NestJS with strict TypeScript and REST APIs.
- Prisma ORM with PostgreSQL.
- Jest for unit and end-to-end tests.
- Docker and GitHub Actions for delivery workflows.

## NestJS architecture

- Organize code by feature module with thin controllers, business logic in services, and validated DTOs at API boundaries.
- Use dependency injection; keep shared infrastructure focused and reusable.
- Apply the global validation pipe with whitelist and unknown-property rejection.
- Return consistent errors without production stack traces or sensitive data.
- Do not add speculative abstractions, dependencies, or features.

## Prisma and PostgreSQL

- Model relations with foreign keys, appropriate unique constraints, check constraints, and indexes.
- Reinforce application validation with database constraints.
- Use database transactions for atomic multi-record operations.
- Use controlled migrations; never use `prisma migrate dev` in production.
- Avoid N+1 queries and use database aggregation and backend pagination where required.
- Preserve referenced financial entities with soft deletion or deactivation.

## Financial data integrity

- Never use `Float` for monetary values. Use Prisma `Decimal` and PostgreSQL `NUMERIC`.
- Accept and return monetary API values as decimal strings.
- Never convert monetary values through JavaScript `number`.
- Store timestamps in UTC and calculate financial date boundaries using the user's timezone (`Asia/Jakarta` by default).
- Calculate balances and dashboard totals from source transactions; do not maintain a separate mutable balance.
- Validate positive transaction amounts, matching transaction/category types, active references, and non-future transaction dates.

## Authentication and authorization

- Hash passwords with bcrypt using at least 10 rounds; never store, return, or log plaintext credentials or tokens.
- Keep access tokens short-lived. Hash, rotate, expire, and revoke refresh sessions; send refresh tokens only in appropriately secured `httpOnly` cookies.
- Rate-limit registration, login, and refresh endpoints.
- Never trust `userId` from request bodies, parameters, or queries for authorization.
- Derive `userId` from the authenticated token and include it in every private-data query and mutation.
- Validate ownership of related accounts, categories, and transactions without revealing another user's resource existence.

## Testing

- Add or update focused unit tests for business logic and regression tests for every bug fix.
- Cover critical authentication, ownership isolation, money precision, transaction lifecycle, balance, and dashboard flows with end-to-end tests.
- Run Prisma validation, formatting, lint, strict type-checking, unit tests, end-to-end tests, and build before declaring work complete.

## Git workflow

- Never work directly on `main`; use one branch per feature or fix.
- Keep changes small and scoped. Do not implement anything outside the request.
- Use Conventional Commits.
- Do not commit, push, or merge without explicit user approval.

## Definition of Done

- The implementation matches `docs/PRD.md` and the requested scope.
- Authorization, validation, financial precision, database integrity, and migrations are correct.
- Relevant documentation and tests are updated.
- Prisma validation, formatting, lint, type-checking, unit tests, end-to-end tests, and build pass.
- No secrets, sensitive logs, unrelated changes, or unapproved commits are present.

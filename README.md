# Alira API

Backend REST API for the Alira personal finance tracker.

## Development

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Start PostgreSQL with `npm run docker:up`.
4. Start the API with `npm run start:dev`.

The health endpoint is available at `http://localhost:3000/api/v1/health` and
Swagger at `http://localhost:3000/docs` when enabled.

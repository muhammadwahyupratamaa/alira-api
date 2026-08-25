Based on docs/PRD.md and your previous analysis, create a concise
repository-level AGENTS.md for Alira API.

It must include:

- Product context
- Required technology
- NestJS architecture rules
- Prisma and PostgreSQL rules
- Financial data integrity rules
- Authentication and authorization rules
- Testing requirements
- Git workflow
- Definition of Done

Important rules:

- Read docs/PRD.md before implementing features.
- Never use Float for monetary values.
- Return monetary values from the API as strings.
- Never trust userId from request body, params, or query for authorization.
- Scope private data using the authenticated userId.
- Never work directly on main.
- Use one branch per feature.
- Use Conventional Commits.
- Do not commit, push, or merge unless I explicitly approve.
- Do not implement features outside the requested scope.

Only create AGENTS.md. Do not initialize NestJS yet.
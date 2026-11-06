# Lead Connect Clone — Step 2B

Use Node.js 22.12+, 24.x, or 26+ (Node.js 24.22.1 verified). Requires npm and local PostgreSQL or Docker.

## Setup

1. `cp .env.example .env`
2. Edit `.env`: choose a strong `POSTGRES_PASSWORD`, use the same URL-encoded password in `DATABASE_URL`, and set `JWT_ACCESS_SECRET` to at least 48 random characters. Set bootstrap credentials before running bootstrap.
3. `npm ci`
4. `docker compose up -d`
5. `npm run db:validate`
6. `npm run db:deploy` (apply the committed migration to your local development database)
7. `npm run db:generate`
8. `npm run db:bootstrap` (once on an empty database)
9. Remove `BOOTSTRAP_ADMIN_PASSWORD` from `.env` after successful bootstrap.
10. `npm run build && npm run dev`
11. `curl http://localhost:4000/api/ready`

## Verify schema and migration

- `npx prisma migrate status` — migration state
- `npx prisma validate` — schema validity
- `npx prisma studio` — inspect tables
- `curl http://localhost:4000/api/ready` — database connectivity

## Authentication examples

Login:

```sh
curl -i -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"manager@example.com","password":"YOUR_PASSWORD","propertyCode":"DEMO"}' \
  http://localhost:4000/api/auth/login
```

Web clients use the HttpOnly refresh cookie; mobile clients send `X-Client-Platform: mobile` and store the returned refresh token in the OS secure credential store. **Production must not trust this header for security decisions**; before production, implement explicit client registration or another authenticated mobile client flow. Never persist access tokens in browser localStorage.

## Integration tests

Tests require a **disposable local** PostgreSQL database named exactly `leadconnect_test`. The test setup rejects remote hosts, other database names, non-public schemas, and connection override parameters **before importing the app**. Do not run these commands with a Neon URL.

Example for a local shell (the test container has no password and binds only to loopback):

```sh
docker compose -f docker-compose.test.yml up -d --wait
export DATABASE_URL=postgresql://leadconnect@127.0.0.1:55432/leadconnect_test
unset DIRECT_URL
npm ci
npm run db:validate
npm run build
npm run db:deploy
npm test
npm run test:integration
docker compose -f docker-compose.test.yml down
```

The test database uses temporary storage and is destroyed with the test container. Never use the test compose configuration for a network-accessible service. Temporary users and passwords are generated for tests and cleaned up afterward.

`npm test` runs token, environment, database-safety, and integration tests. The dedicated integration command runs just the HTTP/database suite. `npm run build` explicitly generates Prisma Client before TypeScript compilation; generated files remain ignored.

`prisma.config.ts` uses optional `DIRECT_URL` for migration/CLI connections, falling back to `DATABASE_URL`. Runtime Prisma uses `DATABASE_URL` through `@prisma/adapter-pg`. Set private values only in ignored local environment files or the hosting secret store. No production migration is authorized by these instructions.

## Production hardening before deployment

- Configure HTTPS/TLS and trusted proxy settings for the actual host. Production startup requires a TLS database URL and HTTPS browser origin. Auth mutations reject mismatched browser origins; cookies remain HttpOnly, SameSite=Strict, and Secure in production. Decide the final same-site frontend/API domain arrangement before rollout.
- Add centralized login throttling (Redis), account lockout policies, request tracing, and monitoring.
- Add refresh-token family tracking for robust replay detection and race handling.
- Add DB constraints ensuring cross-property references and photo associations are consistent.
- Move to a workspace monorepo and add CI, secret management, backups, and automated migration deployment.
- Never put guest personal information or passwords in audit logs.

## Committed migration

`prisma/migrations/20261106224608_init/migration.sql` initializes all 12 models and 10 enums, including indexes and foreign keys. `migration_lock.toml` records PostgreSQL as the provider. It was generated and tested on disposable local PostgreSQL 18.3; it has **not** been applied to Neon.

Use `prisma migrate dev --name <change>` only against a local development database for later schema changes. Apply committed migrations with `prisma migrate deploy` only to a deliberately chosen target. See `VERIFICATION.md` for checked results and remaining deployment requirements.

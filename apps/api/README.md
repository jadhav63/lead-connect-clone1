# Lead Connect Clone — Step 2B

Node.js 22.12+ recommended. Requires Docker and npm.

## Setup

1. `cp .env.example .env`
2. Edit `.env`: choose a strong `POSTGRES_PASSWORD`, use the same URL-encoded password in `DATABASE_URL`, and set `JWT_ACCESS_SECRET` to at least 48 random characters. Set bootstrap credentials before running bootstrap.
3. `npm install`
4. `docker compose up -d`
5. `npm run db:validate`
6. `npm run db:migrate -- --name init`
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

Tests must run against a **separate disposable** PostgreSQL database named `leadconnect_test`.
Create that database, set `DATABASE_URL` to its URL, run `npx prisma migrate deploy`, then `npm run test:integration`.

## Production hardening before deployment

- HTTPS/TLS, trusted proxy configuration, CSRF protection for cookie-auth endpoints, and secure cookie policy.
- Add centralized login throttling (Redis), account lockout policies, request tracing, and monitoring.
- Add refresh-token family tracking for robust replay detection and race handling.
- Add DB constraints ensuring cross-property references and photo associations are consistent.
- Move to a workspace monorepo and add CI, secret management, backups, and automated migration deployment.
- Never put guest personal information or passwords in audit logs.

No migrations are pre-generated in this package: `prisma migrate dev --name init` generates them from the complete schema against your own database. Commit the resulting migration files to version control.

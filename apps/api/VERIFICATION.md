# Backend verification — November 6, 2026

## Scope and environment

Reviewed all supplied backend source, schema, configuration, documentation, and tests. Kept the Express/TypeScript/Prisma/PostgreSQL architecture and all 12 models and 10 enums. No Neon access, Neon migrations, Render deployment, real employee accounts, or guest records were used.

Executed with Node.js 24.22.1, npm 11.9.0, Prisma CLI/Client 7.10.1, Vitest 5.1.0, and a disposable local PostgreSQL 18.3 cluster bound to loopback. Docker/system PostgreSQL were unavailable, so a temporary PostgreSQL binary package was used outside the repository. The local cluster was stopped after validation. The committed Docker test configuration is provided for reproducibility but was not itself run in this environment.

## Results

| Check | Result |
| --- | --- |
| Dependency installation | npm install and subsequent clean npm ci succeeded; package-lock.json committed |
| Prisma schema | prisma validate passed after fixing invalid one-line enum declarations |
| Client and TypeScript | npm run build (prisma generate followed by tsc) passed |
| Migration generation | prisma migrate dev --name init generated and applied the initial migration locally |
| Fresh database migration | Recreated only the disposable local leadconnect_test database, then prisma migrate deploy succeeded |
| Migration status | Up to date |
| Schema drift | prisma migrate diff reported no difference, exit code 0 |
| Full test suite | 31 passed across 4 files: 14 unit/configuration/safety cases and 17 integration cases |
| Dedicated integration command | 17 passed |
| Fixture cleanup | Zero users and zero properties remained afterward |
| Dependency audit | npm audit reported 0 known vulnerabilities at verification time |
| Secret exclusions | .env, .env.production, .env.test, node_modules, dist, and generated client excluded; .env.example contains placeholders only |

Committed migration: `prisma/migrations/20261106224608_init/migration.sql`, with PostgreSQL provider recorded in `prisma/migrations/migration_lock.toml`. SQL includes all model tables, enum types, unique constraints, indexes, and foreign keys.

## Security review and corrections

- Password creation uses Argon2id; tests verify the stored hash and that it is omitted from account creation responses. Unknown-user login now verifies a valid process-local random dummy hash instead of an embedded hash.
- JWT verification constrains HS256, issuer, audience, subject, and property scope. Access tokens expire in 15 minutes. Tests reject expired, incorrectly signed, incorrectly scoped, and unexpected-algorithm tokens.
- Authorization rechecks active user status and property membership on each authenticated request. Tests cover cross-property token denial, inactive users/memberships, staff role restrictions, and preventing managers from creating managers.
- Refresh secrets use 48 random bytes and are persisted as SHA-256 hashes. Rotation uses a serializable transaction; replay revokes active refresh sessions. Tests cover expiry, rotation, replay, inactive users, and concurrent rotation. Serialization conflicts return HTTP 409 rather than an internal server error.
- Browser refresh cookies are HttpOnly and SameSite=Strict, with Secure enabled in production. Auth mutations reject foreign browser origins, including login. CORS remains restricted to the configured frontend origin. Native responses still use the existing client-platform header convention, which grants no authorization.
- Added password/token size bounds, cookie-token validation, appropriate malformed/oversized JSON responses, and generic error logs that do not print database driver errors or connection strings. Bootstrap failure logs likewise avoid raw driver errors.
- Test setup now rejects remote hosts, misleading database-name substrings, connection override parameters, and non-public schemas before importing the app. Test signing keys and account passwords are generated at runtime.
- Production runtime configuration rejects non-TLS database settings and non-HTTPS browser origins. Migration CLI configuration optionally uses DIRECT_URL; runtime connections continue using DATABASE_URL and the Prisma PostgreSQL adapter.
- Upgraded the development test runner from Vitest 3 to 5.1 to remove the advisories found by npm audit. The application architecture and Prisma major version remain unchanged.

## Remaining requirements before production

1. Separately authorize and apply the migration to the intended Neon target. This verification does not prove connectivity, permissions, or TLS behavior for the actual Neon role.
2. Configure hosting secrets, a restricted application database role distinct from migration privileges, HTTPS, trusted proxy settings, the final same-site frontend/API origins, and backups/monitoring. The application currently relies on backend authorization; database row-level security is not configured.
3. Existing foreign keys do not enforce that every room/task/ticket/photo relationship belongs to the same property, or that assigned users are members of that property. Add database constraints and service checks before exposing those operational write features or storing real data.
4. The limiter is in-memory and IP-based. Choose shared rate limiting and account-level lockout controls before multiple backend instances or public rollout.
5. Refresh replay currently revokes all active refresh sessions for the user, rather than tracking individual token families. Concurrent refresh attempts can require reauthentication. Design token-family/race handling for production UX; do not blindly retry refresh POSTs. Logout revokes the refresh token, while already-issued access tokens can remain valid for up to 15 minutes unless the user or membership is deactivated.
6. Confirm the native-client flow and browser cookie/domain design, run deployment-specific security checks, and validate monitoring and graceful shutdown under the actual hosting environment.

The GitHub source is ready for the next controlled deployment-preparation stage, but this report is not production approval.

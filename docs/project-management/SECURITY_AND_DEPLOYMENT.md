# Security and deployment
No production rollout is approved. Never target Neon production, the existing housekeeping application, the hotel website, or SynXis.

Environment variable names only: DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET, NODE_ENV, NODE_VERSION, PORT, CORS_ORIGIN, ACCESS_TOKEN_TTL, REFRESH_TOKEN_DAYS. Do not record secret values or full database connection URLs.

Current test deployment: Render Free/Oregon, Node 24, runtime PORT 10000, auto-deploy off. CORS_ORIGIN remains a reserved invalid placeholder and must change before browser integration. No Render configuration changed in this verification session.

Migration: from apps/api, after npm ci and configuring ignored private .env, run node scripts/migrate-render-test.mjs --check, then node scripts/migrate-render-test.mjs. Guard accepts only independently verified test endpoints; no database or branch deletion occurs. Executor PostgreSQL access is blocked, so no cloud migration has succeeded here.

Before real hotel data: enforce tenant relationship constraints and assignee membership; use restricted runtime DB role; add shared/account rate controls; improve refresh token-family/race handling; configure same-site browser domains and trusted proxy; validate TLS, monitoring, backups and recovery. No public registration.

Frontend recommendation: a React/Vite static site on Render free hosting (https://render.com/docs/static-sites), with separately chosen same-site HTTPS custom subdomains for frontend/API. Existing main website need not be replaced. Do not relax cookie protection merely to work around unrelated test domains. Expo clients should use SecureStore (https://docs.expo.dev/versions/latest/sdk/securestore/). No services or domains have been created by this recommendation.

## New local increment
- Composite matching-property foreign keys now protect room/task/ticket/photo references and front desk inspection rooms.
- All new operational mutations verify property-scoped membership/room IDs and write audit events in the same transaction. Staff cannot edit other assignees' work; verification requires a supervisor. Completed cleaning assignments are immutable with respect to reassignment.
- Room saves include versions, imports are transactional, maintenance closure requires notes, incoming handovers cannot self-verify, and membership deactivation revokes refresh sessions.
- API data responses are no-store. Frontend keeps access tokens in memory and coalesces refresh requests, validates operational CSVs, and uses explicit Save confirmations. No secret values are placed in client build variables.
- Both local migrations and 60 backend / 14 web tests passed; actual browser cookie/CORS and all-page visual QA remain outstanding.
- No new Render config, automatic deploy, cloud migration, cloud fixture account, DNS change, paid service or production modification occurred. Native database access in this executor remains blocked; follow the guarded manual workflow from NEXT_SESSION.md.
- The new schema has 14 models / 11 enums. Review both migration files before a future isolated test deployment. The currently live backend is still b4f909d.

## Current checkpoint — November 08, 2026, 12:56 AM Arizona
This section supersedes earlier current-state deployment descriptions above. Latest verified web source: https://github.com/jadhav63/lead-connect-clone1/commit/f12897a6e9641ff1ea3cd02d9573c49a6c78c05c. Render remains b4f909d; auto-deploy Off; no secret/configuration changes. Dashboard grouping is named Production, so verify actual test-only designation/traffic before any deployment. Masked runtime values were not read or exported; runtime DB target/TLS was not freshly validated this session.
Neon render-test ID and leadconnect/public zero-table view independently verified. Guarded --check failed before connecting because private DATABASE_URL is absent (DIRECT_URL also absent). Do not substitute guessed credentials, change the guard or apply console SQL. No cloud migration succeeded.
Local tests ran only against loopback leadconnect_test with fictional accounts, isolated from Neon. Both migrations passed; no drift; 14 models/11 enums/41 indexes/34 FKs. Backend 60 tests and web 19 tests passed; both builds passed; exact fixtures removed to zero users/properties.
Observed pg runtime warning concerns future TLS mode semantics; review explicit verify-full privately before future dependency upgrades. No encryption setting was weakened. Health/ready succeeded but do not demonstrate installed schema.
Free frontend settings are prepared in apps/web/TEST_DEPLOYMENT.md. No host, domain, public fixture or staff rollout created. Preserve Strict/HttpOnly/Secure cookies and exact HTTPS CORS configuration. Browser/device/print and cloud cookie/CORS tests remain pending.

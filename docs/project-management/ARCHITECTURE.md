# Architecture

## Backend and database
apps/api: Node 24, Express 5, TypeScript, Prisma 7 with PostgreSQL adapter. PostgreSQL is authoritative operational storage; Drive is documentation/backup storage only.

14 models: Property, User, PropertyMembership, Room, CleaningTask, MaintenanceTicket, TicketEvent, RoomStatusEvent, Photo, Notification, AuditLog, RefreshToken, FrontDeskTask and ShiftHandover. 11 enums. Initial migration plus 20261106233500_operations. Both tested locally. JD reports both migrations were successfully applied to Neon render-test on November 8, 2026; see current status for supplied verification and limits.

Membership roles: ADMIN, MANAGER, FRONT_DESK, HOUSEKEEPING, MAINTENANCE. Access tokens carry property identity; each authenticated request checks active membership. Passwords are Argon2id hashes; refresh tokens are random secrets stored hashed, rotated in serializable transactions.

Operational endpoints and permissions: see apps/api/OPERATIONS.md. Families: /properties/current, /employees, /users, /rooms, /housekeeping, /maintenance, /front-desk/tasks, /front-desk/handovers, /dashboard, /reports and /audit. Property identity is never accepted from operational request bodies. Assignee membership and roles are checked transactionally. Composite foreign keys protect room/task/ticket/photo tenant references. Audit writes are atomic with mutations. Room updates use versions; completed assignments cannot be reassigned.

## Web
apps/web: React 19 + TypeScript + Vite 7; production static build in dist. Eight pages call the actual backend. In-memory access tokens, HttpOnly refresh cookies, single-flight refresh. No permanent mocks, no localStorage credentials, no public registration. Dates use America/Phoenix. CSV accepts only normalized operational fields and requires an explicit save. No guest data or PMS imports.

Current tests: component/session/CSV tests and an enabled jsdom workflow through the real local API/database. Full browser/CORS/visual/print/device QA remains outstanding. Forms are minimal MVPs; pagination, recurring templates, payroll-minute aggregates, PDF ingestion, photos and live updates need further work.

## Mobile
Expo/React Native is not implemented. apps/mobile/README.md specifies API usage, SecureStore, refresh serialization and device-test requirements. Reuse API endpoints and extract shared response contracts when the mobile package is added.

## Deployment
GitHub main; Render root apps/api; build npm ci --include=dev && npm run build; start npm start; health /api/health; Node 24; production runtime env; port 10000; auto-deploy off. Live source b4f909d predates operational endpoints. Neon render-test is independently verified and separate from production, but remains unmigrated due executor native PostgreSQL networking.

Recommended test frontend: free Render static hosting, root apps/web, build npm ci --include=dev && npm run build, publish dist. Select actual same-site HTTPS frontend/API custom domains before browser auth. No frontend hosting service or DNS change was created.

## November 08, 2026, 12:56 AM Arizona checkpoint
Web source: https://github.com/jadhav63/lead-connect-clone1/commit/f12897a6e9641ff1ea3cd02d9573c49a6c78c05c. Parallel page loads commit results only when identity, page, date and request sequence still match; stale success/error results are ignored. Loading and failure states hide incomplete operational content while preserving component drafts; Retry clears the error. Room fields lock during saves. Transport catches network/non-JSON failures without exposing raw proxy bodies. Keyboard skip navigation, touch sizing and print CSS are implemented; rendered acceptance QA is pending.
Fresh local PostgreSQL 18.6 catalog: 14 models, 11 enums, 41 indexes, 34 FKs; both migrations/status/no-drift checks and 60 backend/19 web tests passed, with zero fixture users/properties remaining.
Cloud preflight is currently blocked by absent private credentials, before any connection. Neon console still reports zero leadconnect/public tables. Render's environment is named Production, so test-only designation is unresolved and no deployment occurred. Prepared frontend settings: apps/web/TEST_DEPLOYMENT.md; no service created.

## Secure recovery checkpoint — November 08, 2026, 01:07 AM Arizona
Verified source: https://github.com/jadhav63/lead-connect-clone1/commit/dea2aaf443df360f60c630e7a29fa986a6bf0c73. Existing guarded migration runner additionally validates server current_database, current_schema and pg_stat_ssl before row checks/DDL. Application table reads are public-qualified. A shared migration-catalog.mjs derives exact expectations from the two reviewed DDL files, including replaced FKs and primary-key indexes, and verifies named objects and ordered enum labels after Prisma drift checks.
78 backend tests, 19 frontend tests plus one default-skipped local fixture test, and both builds passed. Fresh PostgreSQL 18.6 migrations/catalog match 14/11/41/34; zero fixture users/properties remain. Successful negotiated cloud TLS and a complete guarded Neon run remain unverified.
Neon browser metadata is accessible; secrets remain masked and unavailable in the separate execution workspace. Required migration variables: DATABASE_URL and DIRECT_URL only. The private Windows workflow in apps/api/NEON_WINDOWS_SETUP.md avoids chat/Drive credential transfer.
Print output uses saved notes and assignments plus selected Arizona business date. Browser print pagination/cross-browser QA remains outstanding. Render b4f909d/auto-deploy Off is unchanged; test-only status/traffic and runtime target still require verification.

Dashboard API returns property-scoped groups plus counts for unverified daily work and overdue cleaning/front-desk tasks/open maintenance. Overdue task dates precede the selected business date; same-day work is not labeled overdue without time-of-day rules. Frontend derives arrivals from the property-scoped room list and displays cleaning closed/total progress.


## TLS guard and reporting checkpoint — November 08, 2026, 02:18 AM Arizona
Code commit: https://github.com/jadhav63/lead-connect-clone1/commit/7cafe8312405cc87d48bf7e106c9a032ae437057. The render-test migration guard requires sslmode=verify-full, explicit Node TLS certificate verification and SCRAM channel binding; it checks the live TLS socket, database and schema before row reads or DDL. A false backend pg_stat_ssl value with ssl=off is accepted only for the exact Neon render-test endpoint when the Node TLS certificate is authorized, consistent with TLS termination at the Neon proxy. Private URLs remain unavailable; cloud preflight exits before connecting.
The reports API supports daily detail and monthly, property-scoped employee/status totals. React Reports has daily/monthly controls. Local database/API verification: 78 tests, migrations current, no drift, catalog 14/11/41/34 and fixture cleanup; frontend: 19 pass/1 default skip, production build passes. Render status unchanged; no deployment.


## Current environment status — November 8, 2026
The schema migration is reported complete on Neon render-test (14 models, 11 enums, 41 indexes, 34 FKs). This workspace did not rerun it and lacks private test connection strings, so cloud API workflow verification remains open. Backend local suite: 79 passed; frontend default: 21 passed/1 skipped; enabled local UI/API/database workflow: 22 passed; builds passed. Existing Render is Production-labeled; no staging service is verified or deployed.

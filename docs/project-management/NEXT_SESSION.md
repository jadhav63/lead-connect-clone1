# Next session
Updated November 08, 2026, 01:07 AM Arizona.

## Exact stopping point
Latest verified source: https://github.com/jadhav63/lead-connect-clone1/commit/dea2aaf443df360f60c630e7a29fa986a6bf0c73
Backend implementation: 0691f1a. Render live: b4f909d. Automatic deploy remains Off. No cloud migration or frontend service created.
Neon console confirms render-test / br-polished-bread-artfes8a / leadconnect with zero public tables. Guarded --check stopped before connecting: private DATABASE_URL missing; DIRECT_URL also absent. Earlier networking failures do not establish current connectivity, which remains untested without credentials.
Local results: 72 backend + 19 web tests passed (including the actual local API/database UI workflow); both builds passed; both migrations applied to fresh PostgreSQL 18.6; no drift; 14 models / 11 enums / 41 indexes / 34 FKs; fixtures cleaned to zero users/properties.

## Credential access status
Authorized Neon test console metadata verified again: project gentle-rice-55255812, render-test ID, database, direct and pooled endpoints, required TLS setting. Passwords stayed masked. No secure bridge or approved secret facility is available to deliver them into this workspace. Both private variables and local .env are absent; preflight exits before connecting. Do not reveal or paste credentials into tool output/chat or extract them from Render/other applications.

Start with apps/api/NEON_WINDOWS_SETUP.md on JD's Windows computer. Privately copy pooled/direct URLs into the ignored apps/api/.env there. Running migration on that computer does not configure this separate execution workspace. If credentials are later provisioned here via an approved private facility, rerun all target/preflight checks before any migration.

## Exact next steps
1. Pull main. Inspect both migrations and scripts/render-test-target.mjs against the Neon console's render-test branch identity and endpoint names. Never target production.
2. In apps/api run npm ci. Configure DATABASE_URL (pooled test endpoint) and DIRECT_URL (direct test endpoint) privately in ignored .env. Confirm leadconnect, public schema and required TLS. Never paste secret URLs into chat, GitHub or Drive.
3. Run node scripts/migrate-render-test.mjs --check. If it fails, document the fixed safe message; do not bypass the guard or run SQL migrations through the console.
4. Only after preflight passes, run node scripts/migrate-render-test.mjs. Record migrate status/drift and catalog checks; expected local baseline is 14 models, 11 enums, 41 indexes and 34 FKs. The strengthened guard verifies actual negotiated TLS/database/schema before writes and exact named catalog/enum values after migrations. Refuse pre-existing application rows.
5. Verify the Render service's test-only designation and traffic. The dashboard currently groups lead-connect-api under Production, so do not deploy based solely on prior handoff descriptions. Review environment targets privately without exposing values. Keep automatic deployment Off.
6. After schema/compatibility checks, run disposable cloud authentication, permissions, rooms, housekeeping, maintenance, front desk, refresh/logout and audit checks on the compatible test backend. If old deployed code cannot cover new endpoints, record that limitation before the manual verified backend deployment, then run full cloud smoke/workflow checks. Delete only exact fixtures created by that test run.
7. Manually deploy the verified backend only when all deployment gates are met; confirm commit, logs, health, readiness and operations. No paid services.
8. Follow apps/web/TEST_DEPLOYMENT.md for isolated free frontend settings. Select same-site HTTPS origins or a reviewed same-origin proxy; exact CORS origin, Strict refresh cookies unchanged. No hotel website/DNS changes.
9. Complete actual browser, keyboard, 320/375/768/1280px mobile/desktop, zoom, print, reload/refresh/logout and cloud cookie/CORS acceptance checks. Do not release to staff.
10. Update the six matching GitHub and existing Drive management documents with actual outcomes.

## Local commands
apps/api: npm ci; configure disposable loopback leadconnect_test; npm run db:deploy; npm run build; npm test; prisma migrate status/diff.
apps/web: npm ci; npm run build; npm test. Default run is 18 passed + 1 intentionally skipped; enable LOCAL_UI_FIXTURE_FILE and VITE_API_BASE only for the guarded fictional local fixture to run all 19.
The helper apps/api/scripts/local-web-fixture.mjs refuses remote databases and must not be used for Neon/cloud fixture creation.

Dashboard now includes arrivals, cleaning progress and overdue task summaries. Next product priorities: date-range/monthly reports, housekeeping workload balancing and configurable time estimates, maintenance recurring tasks, audit history UI, and Expo implementation.

## Outstanding product work
Monthly reports, service rotations/minutes, PDF ingestion, photo storage, live updates, pagination, production security/recovery and Expo/device implementation remain separate work. Current source includes eight operational web pages; full rendered QA is not yet claimed.

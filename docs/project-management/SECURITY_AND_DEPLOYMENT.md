# Security and deployment
Updated November 08, 2026, 02:25 AM Arizona. This is the current consolidated checkpoint.

## Protected systems and scope
No production rollout, paid service or real staff use is authorized. Never target Neon production, housekeeping-portal-3, the existing housekeeping application, hotel website, SynXis, or real guest/employee records. Do not delete databases or enable automatic deployment.

## Credential handling and verified metadata
Migration variables: DATABASE_URL (pooled) and DIRECT_URL (direct). The guarded runner/Prisma migration needs no JWT or bootstrap credentials. Both private variables and apps/api/.env are absent in this workspace; Git ignores .env and private variants. No private values were revealed, committed or copied into Drive.
The authorized Neon console was checked with passwords masked: project lead-connect-clone / gentle-rice-55255812; branch render-test / br-polished-bread-artfes8a; database leadconnect; direct ep-old-truth-aror3gey.c-4.us-west-2.aws.neon.tech; pooled ep-old-truth-aror3gey-pooler.c-4.us-west-2.aws.neon.tech; displayed sslmode=require. These hostnames/IDs are non-secret target metadata. The branch's leadconnect/public view had zero tables at the preceding checkpoint; no cloud connection or row query occurred in this recovery run.
There is no supported secure transfer mechanism from the connected browser to this separate workspace or an approved secret facility available here. Do not print/copy secret values through chat/tool results to bridge that gap. Use apps/api/NEON_WINDOWS_SETUP.md on JD's own computer or an approved private secret facility; do not extract credentials from production or unrelated applications. A local Windows migration does not place secrets in this workspace.

## Guarded migration
After independent target verification and private local setup in apps/api, run npm ci, then node scripts/migrate-render-test.mjs --check. Only after success run node scripts/migrate-render-test.mjs. Never bypass through SQL Editor or weaken the allowlist. Preflight this session exited 1 before connecting: DATABASE_URL: private render-test connection required. No Neon migrations or cloud fixture accounts/tests ran.
The runner checks the actual connected database/schema and the Node TLS socket before any application rows/DDL, explicitly reads public tables and refuses existing rows. It requires sslmode=verify-full, `rejectUnauthorized: true`, successful certificate authorization and SCRAM channel binding. The reported Neon endpoint shows pg_stat_ssl=false and ssl=off on the PostgreSQL backend; this is consistent with client TLS ending at the Neon connection proxy. The guard accepts this backend observation only for the exact allowlisted test endpoint and only when the Node-to-Neon TLS socket is encrypted and certificate-authorized. It runs Prisma validate/deploy/status/drift and exact named table/index/FK plus ordered enum checks. Target/schema/required-TLS/override/data restrictions remain intact. Baseline: 14 models/11 enums/41 indexes/34 foreign keys. Private connection strings must use explicit sslmode=verify-full; never disable TLS or certificate checks.

## Verification and source
Latest verified source: https://github.com/jadhav63/lead-connect-clone1/commit/7cafe8312405cc87d48bf7e106c9a032ae437057
Fresh local PostgreSQL 18.6: both migrations applied; status current; no drift; complete expected catalog verified. 78 backend tests, 19 frontend tests (1 actual local API/database fixture UI test skipped by default), and both builds passed. Monthly employee/status reporting is covered by API integration and component tests; the full local React/API/PostgreSQL workflow also passed, and the disposable fixture was cleaned up. Exact fixtures removed; zero users/properties remain. These results do not establish a successful full cloud guard run or cloud authentication.
The private Windows guide contains placeholders and public metadata only. No test credentials are embedded in web assets, logs or documentation. Frontend tokens remain in memory; refresh cookies retain HttpOnly/Strict/Secure rules. Print refinements use saved operational notes/assignments, not unsaved controls. Browser/device/physical print QA remains pending.

## Render safety gate
Service lead-connect-api / srv-dbn5vetg1s2s73blmjf0 remains on b4f909d3c6886591b90c74bf5b83b6cf45b5a3cb, Free/Oregon. Automatic deploy is Off, independently rechecked. Environment is named Production; test-only designation, actual real-user traffic and current secret database target remain unverified. Do not deploy or change settings merely to complete this task. No environment variables or service configuration changed.
Previous health/ready checks succeeded, but readiness proves reachability rather than schema. Runtime logs show startup on 10000 and a pg future TLS-mode semantics warning. Review explicit verify-full privately before future dependency upgrades; no TLS settings were weakened.
After migration, verify compatibility and test-only traffic/target before a manual deployment, then complete cloud disposable workflow tests and exact fixture cleanup. Old b4f909d lacks operational endpoints, so record limitations rather than claiming those tests passed against it.

## Frontend and remaining hardening
Free isolated frontend settings: apps/web/TEST_DEPLOYMENT.md. No hosted frontend, DNS change or staff release exists. Select same-site HTTPS origins or a reviewed same-origin proxy; exact CORS_ORIGIN required. Do not weaken Strict cookies to work around unrelated origins.
Before real data: restricted runtime database role, shared/account throttling, token-family/race handling, full database membership constraints, trusted proxy, monitoring, recovery and backups. Expo/device work remains preparation only. Preserve existing hotel systems throughout.

Dashboard metrics use authenticated property scope; overdue counts query the same property and do not include guest or employee personal details. Changes are local and committed; no cloud deployment was performed.


## Production release checklist (not a deployment approval)
1. Complete the guarded migration on the independently verified render-test Neon branch; record migration status, drift and catalog output. Never use production for test setup.
2. Verify staging service ownership, environment, database endpoint, actual traffic, auto-deploy Off and secret access controls before any manual staging deployment. Confirm deployed commit, logs, health, readiness and end-to-end disposable workflows.
3. Use separate least-privilege runtime credentials, strong unique JWT keys, HTTPS-only origins, reviewed CORS and cookie settings. Rotate any credential confirmed exposed through the credential owner’s secure console process.
4. Verify backup/restore, monitoring, error handling, rate limits, account recovery and incident contacts. Finish browser, keyboard, mobile, print and accessibility acceptance checks with fictional test data.
5. Confirm the production schema and migration plan, preserve a rollback path, and obtain JD's explicit approval before production deployment. Keep auto-deploy disabled unless separately approved.

Latest local check: backend 78 passed; frontend 19 passed/1 skipped; both builds and local migration/drift/catalog checks passed. Neon preflight still stops before connecting because DATABASE_URL and DIRECT_URL are not available here. No Neon migration or Render deployment was performed.


## November 8, 2026 continuation checkpoint
JD reports the guarded migration completed on Windows against only Neon `render-test` / `br-polished-bread-artfes8a`, database `leadconnect`, schema `public`; PowerShell confirmed Prisma validate/deploy/status/diff and catalog totals 14/11/41/34. This workspace did not rerun migration. Cloud application tests remain blocked because private `DATABASE_URL` and `DIRECT_URL` are unavailable here. Local API suite: 79 passed; frontend 21 passed/1 default-skipped, plus enabled local React/API/PostgreSQL workflow 22 passed; both production builds passed. Disposable local fixtures were removed and local counts returned to zero. No browser engine/cloud CORS or cookie test was run. Never paste them into chat; use an approved secret store or run cloud workflows from the secured Windows environment with fictional fixtures and exact cleanup.

The API adds per-user/property notification reads and mark-read ownership checks. Local tests cover notification ownership and event creation. Do not deploy the existing `lead-connect-api`: its Render environment is labeled Production, live traffic/test-only isolation is unverified, and the user explicitly requires no production deployment. Staging is not available from this workspace; prepare only after a separately isolated no-cost service and secrets are available. Keep auto-deploy off.

Published local-verification checkpoint: https://github.com/jadhav63/lead-connect-clone1/commit/68ff458d8cd87cb29c9608941a86de79b7d6c666.
## Staging security event and current status — November 8, 2026
A database URL and temporary JWT value briefly appeared in an agent-visible Render form accessibility result during staging setup. The Neon `render-test` role password was reset in the Neon console; the old password is revoked. No secret values belong in this document or source. Treat the earlier response value as compromised and do not reuse it. The staging API form was not submitted or deployed; its database URL was cleared and an unsent replacement JWT generated. The currently valid Neon password remains unavailable to this workspace. JD must privately create the Free staging API service and enter a fresh render-test pooled `DATABASE_URL` and new `JWT_ACCESS_SECRET` directly in Render. No production credential or production Render service was touched.

The live staging frontend is https://lead-connect-web-staging.onrender.com. It is static, HTTPS, and Auto-Deploy Off; login/API workflows remain blocked until the separate API service exists and is verified. No cloud connection, user, demo fixture or operational test is claimed. Do not repeat the completed Neon migration.

## Staging verification and credential response — November 8, 2026
The isolated Free API service is Live on `cb9add7`, Auto-Deploy Off. `/api/health` and `/api/ready` succeeded, and the configured target was checked as Neon `render-test` / `leadconnect`. The database URL appeared in an agent-visible tool result while reviewing Render settings. Treat the Neon test-branch password as compromised. The account owner must reset the `render-test` role password privately, then replace the Render staging `DATABASE_URL` with a fresh pooled URL using `sslmode=verify-full`. Do not paste secrets into chat or project documentation. No production credential/service was accessed. Pause cloud data/workflow tests until rotation and readiness recheck. No migrations were repeated. CORS/cookies and authenticated workflows remain unverified.

Production runtime configuration now rejects `sslmode=require` and `verify-ca`; only `verify-full` is accepted. Targeted regression tests pass. This change is not deployed to staging yet; do not deploy until the exposed test-branch credential is privately rotated and Render `DATABASE_URL` is updated.

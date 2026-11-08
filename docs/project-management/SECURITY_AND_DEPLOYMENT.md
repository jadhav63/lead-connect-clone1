# Security and deployment
Updated November 08, 2026, 01:07 AM Arizona. This is the current consolidated checkpoint.

## Protected systems and scope
No production rollout, paid service or real staff use is authorized. Never target Neon production, housekeeping-portal-3, the existing housekeeping application, hotel website, SynXis, or real guest/employee records. Do not delete databases or enable automatic deployment.

## Credential handling and verified metadata
Migration variables: DATABASE_URL (pooled) and DIRECT_URL (direct). The guarded runner/Prisma migration needs no JWT or bootstrap credentials. Both private variables and apps/api/.env are absent in this workspace; Git ignores .env and private variants. No private values were revealed, committed or copied into Drive.
The authorized Neon console was checked with passwords masked: project lead-connect-clone / gentle-rice-55255812; branch render-test / br-polished-bread-artfes8a; database leadconnect; direct ep-old-truth-aror3gey.c-4.us-west-2.aws.neon.tech; pooled ep-old-truth-aror3gey-pooler.c-4.us-west-2.aws.neon.tech; displayed sslmode=require. These hostnames/IDs are non-secret target metadata. The branch's leadconnect/public view had zero tables at the preceding checkpoint; no cloud connection or row query occurred in this recovery run.
There is no supported secure transfer mechanism from the connected browser to this separate workspace or an approved secret facility available here. Do not print/copy secret values through chat/tool results to bridge that gap. Use apps/api/NEON_WINDOWS_SETUP.md on JD's own computer or an approved private secret facility; do not extract credentials from production or unrelated applications. A local Windows migration does not place secrets in this workspace.

## Guarded migration
After independent target verification and private local setup in apps/api, run npm ci, then node scripts/migrate-render-test.mjs --check. Only after success run node scripts/migrate-render-test.mjs. Never bypass through SQL Editor or weaken the allowlist. Preflight this session exited 1 before connecting: DATABASE_URL: private render-test connection required. No Neon migrations or cloud fixture accounts/tests ran.
The existing runner now also checks the actual connected database/schema and negotiated TLS via pg_stat_ssl before any application rows/DDL, explicitly reads public tables and refuses existing rows. It runs Prisma validate/deploy/status/drift and exact named table/index/FK plus ordered enum checks. Target/schema/required-TLS/override/data restrictions remain intact. Baseline: 14 models/11 enums/41 indexes/34 foreign keys. Prefer explicit verify-full in private configuration; never disable TLS or certificate checks.

## Verification and source
Latest verified source: https://github.com/jadhav63/lead-connect-clone1/commit/dea2aaf443df360f60c630e7a29fa986a6bf0c73
Fresh local PostgreSQL 18.6: both migrations applied; status current; no drift; complete expected catalog verified. 72 backend tests (12 new guard/catalog regressions), 19 frontend tests including actual local API/database workflow, and both builds passed. Exact fixtures removed; zero users/properties remain. These results do not establish a successful full cloud guard run or cloud authentication.
The private Windows guide contains placeholders and public metadata only. No test credentials are embedded in web assets, logs or documentation. Frontend tokens remain in memory; refresh cookies retain HttpOnly/Strict/Secure rules. Print refinements use saved operational notes/assignments, not unsaved controls. Browser/device/physical print QA remains pending.

## Render safety gate
Service lead-connect-api / srv-dbn5vetg1s2s73blmjf0 remains on b4f909d3c6886591b90c74bf5b83b6cf45b5a3cb, Free/Oregon. Automatic deploy is Off, independently rechecked. Environment is named Production; test-only designation, actual real-user traffic and current secret database target remain unverified. Do not deploy or change settings merely to complete this task. No environment variables or service configuration changed.
Previous health/ready checks succeeded, but readiness proves reachability rather than schema. Runtime logs show startup on 10000 and a pg future TLS-mode semantics warning. Review explicit verify-full privately before future dependency upgrades; no TLS settings were weakened.
After migration, verify compatibility and test-only traffic/target before a manual deployment, then complete cloud disposable workflow tests and exact fixture cleanup. Old b4f909d lacks operational endpoints, so record limitations rather than claiming those tests passed against it.

## Frontend and remaining hardening
Free isolated frontend settings: apps/web/TEST_DEPLOYMENT.md. No hosted frontend, DNS change or staff release exists. Select same-site HTTPS origins or a reviewed same-origin proxy; exact CORS_ORIGIN required. Do not weaken Strict cookies to work around unrelated origins.
Before real data: restricted runtime database role, shared/account throttling, token-family/race handling, full database membership constraints, trusted proxy, monitoring, recovery and backups. Expo/device work remains preparation only. Preserve existing hotel systems throughout.

Dashboard metrics use authenticated property scope; overdue counts query the same property and do not include guest or employee personal details. Changes are local and committed; no cloud deployment was performed.

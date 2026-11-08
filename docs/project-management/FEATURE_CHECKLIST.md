# Feature checklist

## Current production-readiness checkpoint — November 8, 2026, 16:53 Arizona

This checkpoint supersedes historical connection/deployment blockers below. Main remains `4e24d541102f13ee21635a399bb8322df6358b4f`; production candidate code is `1100c3d352ffed2d871c617be4840f2e87bb17db` on `release/production-readiness-20261108`, [draft PR #1](https://github.com/jadhav63/lead-connect-clone1/pull/1). The existing production-labeled service was not changed. No paid resource, real employee/guest import or staff launch occurred.

Staging authentication was privately reconciled without another password reset; health/readiness pass. The completed Neon render-test migration was not repeated. The original 43 API assertions were audited as API evidence, not browser/restore/load certification. A NEW Free same-origin preview is live at https://lead-connect-rc-staging.onrender.com (`srv-dbogj2ajnfac73er4kag`, deploy `dep-dbogjhh5efls73dqemi0`, Auto-Deploy Off). It uses only the approved render-test database; original staging services remain unchanged. Its safe log confirms verify-full TLS, channel binding and target validation. Build dependency inclusion under production NODE_ENV was corrected for the preview and production draft.

Verified locally: 123 backend tests; 25 frontend tests and 1 old opt-in test skipped; both TypeScript/builds and production dependency audits passed; 3 actual Chromium workflow/viewport/accessibility/print/session/outage/password tests passed. Encrypted local dump/decrypt/restore, row/migration comparisons, restored login/property authorization and least-privilege grants passed. Independent [GitHub CI run 42536916013](https://github.com/jadhav63/lead-connect-clone1/actions/runs/42536916013) passed using PostgreSQL 18, including its three browser tests. Deployed authenticated browser acceptance did NOT pass: execution-environment proxy certificate trust blocked it; verification was not bypassed and temporary trust entries were removed. Only the owned temporary cloud acceptance fixture was cleaned up, preserving the original demo.

Production decision: **NO-GO until launch gates are closed.** A separate production architecture/configuration is prepared, not provisioned: new Render same-origin service, independent Neon project/database, unique runtime/migrator/backup credentials, seven-day recovery history and encrypted offsite backups. Estimated example $50.58/month; recommend $60 initial budget subject to JD approval and variable usage. No production identity or secret is yet confirmed.

Real room structure was extracted from the existing August 17 inventory: 60 identifiers, 26 first-floor/34 second-floor, seven room codes. Every room's current service status remains UNVERIFIED. No real inventory was imported. Current room/OOS approval, maintenance daily checklists/due dates/productivity reports, account recovery, cloud backup/restore, HTTPS authenticated acceptance and physical-device/printer testing remain launch gates.

Authoritative report: [Production readiness](../production/PRODUCTION_READINESS.md). Evidence: [Verification](../production/VERIFICATION.md). Exact approval gates: [Launch checklist](../production/LAUNCH_CHECKLIST.md). Procedures: [Onboarding](../production/OPERATING_AND_ONBOARDING.md) and [Backup/rollback](../production/BACKUP_AND_ROLLBACK.md). Do not use older demo/reset instructions as current production instructions.

Updated November 08, 2026, 02:25 AM Arizona.

## Verified locally
- [x] Authentication/session/property-membership foundation
- [x] Dependency lockfiles, Prisma generation and TypeScript builds
- [x] Initial and operations migrations applied to fresh disposable PostgreSQL; no drift
- [x] Property read/update and employee creation/membership controls
- [x] Room creation/search/filter/status/notes/history and versioned saves
- [x] Housekeeping assignment/save/staff scoping/progress/supervisor verification
- [x] Atomic normalized daily import preserving notes and rejecting invalid rooms
- [x] Maintenance tickets/assignment/priority/status/completion notes/history
- [x] Front desk checklist/inspection tasks and supervisor verification
- [x] Handover records with different incoming-user verification
- [x] Dashboard, daily cleaning/history/per-employee totals, audit API
- [x] React eight-page MVP with real API calls and save confirmations
- [x] CSV preview/explicit save, room colors, print/mobile CSS implementation
- [x] Local React/API/database workflow test and fixture cleanup, including monthly-report UI path

- [x] Stale page/date response protection and loading/Retry regression tests
- [x] Readable network/proxy errors and save-in-progress control locks
- [x] Keyboard skip link, narrow-screen touch sizing and print CSS implementation
- [x] Free isolated frontend deployment settings prepared (not provisioned)
- [x] November 8: 78 backend tests, 19 frontend tests (one local fixture test skipped by default), and both builds passed; fixtures removed

- [x] Authorized Neon test-console metadata reverified with passwords masked
- [x] Private Windows credential setup guide (no secret transfer through chat)
- [x] Actual session database/schema/TLS guard before migration writes
- [x] Named table/index/FK and ordered enum catalog checks; 12 new tests
- [x] Print business date and saved room notes/housekeeping assignees

- [x] Dashboard arrivals, cleaning progress and database-backed overdue counts
- [x] Property-scoped monthly cleaning totals by employee/status with Daily/Monthly Reports controls; live local UI workflow passed
- [x] Migration guard verifies Node TLS encryption and certificate authorization; Neon proxy backend TLS observation is accepted only for the exact test endpoint

## Partially verified / remaining
- [x] Neon render-test schema migration reported complete by JD on Windows; Prisma validate/deploy/status/diff passed and catalog 14/11/41/34 verified (not rerun here)
- [ ] Cloud API auth/permission/property-isolation/operations workflow tests and cloud fixture cleanup (private test credentials unavailable in this workspace)
- [ ] Deploy current backend and web increment to the isolated test environment
- [ ] Real frontend HTTPS origin, same-site cookie and CORS integration
- [ ] Full browser rendering/keyboard/accessibility/mobile/print pagination QA
- [ ] Automatic service rotations and payroll-minute balancing
- [ ] PDF ingestion and SynXis-compatible file mapping (no PMS integration authorized)
- [ ] Photo storage and upload workflow
- [ ] Real-time push and broader API pagination
- [ ] Shared throttling, account lockout, token families/race UX and restricted DB roles
- [ ] Complete database actor/assignee membership constraints
- [ ] Expo implementation, native secure storage and iOS/Android testing
- [ ] Production hardening/recovery verification and separate rollout approval

Render baseline health/readiness is verified, but this does not prove schema installation or cloud authentication. Mobile remains a documented plan. Do not mark unchecked items complete based only on generated source.

Current Render environment is named Production; test-only designation must be resolved before deployment. Latest verified source: https://github.com/jadhav63/lead-connect-clone1/commit/7cafe8312405cc87d48bf7e106c9a032ae437057

## Current continuation checkpoint — November 8, 2026
- [x] Property/user-scoped notification read API and assignment/maintenance/cleaning notification events (local API tests)
- [x] Manager activity feed screen backed by property-scoped audit API (component tests pending final run)
- [ ] Isolated staging deployment and browser CORS/cookie smoke test (no verified staging service or private deployment secrets)
- [ ] Guest/reservation workflows: not represented in current Prisma architecture; requires a separately scoped design and must not connect to SynXis without authorization

GitHub continuation commit: https://github.com/jadhav63/lead-connect-clone1/commit/68ff458d8cd87cb29c9608941a86de79b7d6c666.
## Staging status — November 8, 2026
- [x] Free Render staging project/environment and static frontend created; HTTPS sign-in page loads in desktop Chrome.
- [x] Static site Auto-Deploy Off. Existing Production-labeled API untouched.
- [ ] Create/deploy isolated staging API with render-test pooled DATABASE_URL; owner credential handoff required.
- [ ] Cloud database/API workflows, demo account/fictional fixtures, CORS/cookies, mobile/tablet/keyboard/print QA.
- [x] Latest frontend 21 passed/1 skipped and build passed; API build passed. Latest backend tests were blocked by missing disposable local PostgreSQL; prior 79-pass checkpoint remains historical.
- [ ] Update the GitHub commit link after publishing this documentation.

## Staging API verification — November 8, 2026
- [x] Separate free API service is Live in the Staging environment on `cb9add7`; Auto-Deploy Off.
- [x] `/api/health` and `/api/ready` returned success; configured target checked as Neon `render-test` / `leadconnect`.
- [ ] Rotate exposed test-branch password and update `DATABASE_URL` to pooled `sslmode=verify-full` before cloud workflow testing.
- [ ] Verify CORS/cookies, login, roles, property isolation, housekeeping, maintenance, front desk, notifications, audit, reports and fictional demo.

- [x] Production environment validation now requires PostgreSQL `sslmode=verify-full` (targeted regression tests pass).
- [ ] Deploy this TLS enforcement to staging only after private Neon password rotation and DATABASE_URL correction.

- [x] Monthly report source now shows default estimated minutes vs tracked elapsed minutes; fixed estimates are documented and pure tests pass.
- [ ] Verify monthly time aggregation with disposable PostgreSQL/API integration tests and then against fictional staging records.
- [ ] Make estimates manager-configurable; add pet-room supplement and pause/resume-aware actual time.

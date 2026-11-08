# Feature checklist
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
- [ ] Neon cloud schema migration and live disposable session/permission tests (private workspace credentials unavailable; secure transfer mechanism absent)
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

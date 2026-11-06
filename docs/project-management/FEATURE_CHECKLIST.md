# Feature checklist

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
- [x] Local React/API/database workflow test and fixture cleanup

## Partially verified / remaining
- [ ] Neon cloud schema migration and live disposable session/permission tests (network blocked)
- [ ] Deploy current backend and web increment to the isolated test environment
- [ ] Real frontend HTTPS origin, same-site cookie and CORS integration
- [ ] Full browser rendering/keyboard/accessibility/mobile/print pagination QA
- [ ] Monthly reports, automatic service rotations and payroll-minute balancing
- [ ] PDF ingestion and SynXis-compatible file mapping (no PMS integration authorized)
- [ ] Photo storage and upload workflow
- [ ] Real-time push and broader API pagination
- [ ] Shared throttling, account lockout, token families/race UX and restricted DB roles
- [ ] Complete database actor/assignee membership constraints
- [ ] Expo implementation, native secure storage and iOS/Android testing
- [ ] Production hardening/recovery verification and separate rollout approval

Render baseline health/readiness is verified, but this does not prove schema installation or cloud authentication. Mobile remains a documented plan. Do not mark unchecked items complete based only on generated source.

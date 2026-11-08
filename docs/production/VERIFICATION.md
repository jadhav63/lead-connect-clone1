# Release candidate verification — November 8, 2026

Application code: `1100c3d352ffed2d871c617be4840f2e87bb17db`; base main `4e24d541102f13ee21635a399bb8322df6358b4f`. Review: https://github.com/jadhav63/lead-connect-clone1/pull/1 (draft). Production approval has not been given.

## Local verification actually executed

| Check | Result |
|---|---|
| Backend unit/integration | 123 passed, 17 files, actual disposable PostgreSQL 17.11 |
| Frontend unit | 25 passed, 1 old opt-in live-local test skipped |
| API/frontend TypeScript and builds | Passed; Vite warns about a roughly 515 KB minified bundle |
| Production dependency audits | Zero reported vulnerabilities in both apps |
| Fresh local migrations/status/diff | Passed; no schema drift; existing cloud migration was not repeated |
| Chromium browser acceptance | 3 passed, actual headless Chromium 156.0.8078.79 |
| Encrypted dump/decrypt/restore | Passed with temporary age key, custom dump and isolated restored database |
| Restored application | Actual login and property authorization passed |
| Production runtime role simulation | Cannot create tables or update/delete audit; can perform permitted room writes |
| Production Blueprint | Current JSON schema validation and shell syntax passed; not applied |

Browser coverage: MANAGER assignment → HOUSEKEEPING start/complete → failed inspection with reason → rework → supervisor verification; MAINTENANCE ticket create/assign/start/close; FRONT_DESK start/complete and incoming handover verification; manager notifications/read state/activity/daily and monthly cleaning reports. Session reload, two-tab renewal, logout, employee password change, offline failure/recovery, keyboard skip navigation and axe WCAG 2 A/AA checks passed.

Desktop 1440 px, tablet 768 px and phone 390 px viewports passed without horizontal page overflow. These are Chromium viewport tests, not physical iPhone, Safari or Android certification. The printed synthetic 60-room board contains all room identifiers 901–960 over three A4 pages; a rendered page was visually inspected. Actual hotel-printer testing remains required.

Reproduce in a disposable development environment with `PG_BIN` set to PostgreSQL binaries and `CHROMIUM_PATH` if a browser is installed separately:

```
bash scripts/verify-release-local.sh
```

The script creates only a new loopback test cluster, never consumes a cloud DATABASE_URL, checks migrations and runs the test/build/browser/restore sequence. `AGE_BIN` and `AGE_KEYGEN_BIN` can select installed age tools. It removes its private credentials/keys and test databases. It does not install dependencies or system browser libraries.

## Independent GitHub CI

[Run 42536916013](https://github.com/jadhav63/lead-connect-clone1/actions/runs/42536916013) passed, using Node 24 and PostgreSQL 18. This independently verifies the committed code, fresh migrations and schema consistency, API/frontend tests, both builds/audits and three Playwright Chromium acceptance tests. CI contains no production credentials, deployment or cloud migration step.

## Cloud boundary

The separate Free RC service is live from application commit 1100c3d. Actual HTTPS health/readiness succeeded. Safe startup log records verified TLS and channel binding with `stagingTargetVerified: true`. No production endpoint or real hotel data was used.

The prior 43 staging assertions were API tests, not browser acceptance, restore or load tests. See PRODUCTION_READINESS.md for their audited scope. Cloud browser results and fixture cleanup are recorded below when completed; they must not be inferred from local/CI results.

## Not established by these results

No paid-host load/memory or high availability test; no cloud provider PITR/offsite restore drill; no approved real inventory/OOS import; no staff account recovery rehearsal; no physical-device/hotel-printer acceptance; no staff launch. Maintenance checklists, due-date entry and maintenance productivity reporting remain incomplete. Guest/reservation/PMS integration and offline/push/photo workflows are outside the implemented scope.

## Deployed browser attempt and environment limitation

The deployed browser suite did not complete successfully and is NOT marked passed. Direct Chromium egress failed, and the environment proxy certificate was not initially trusted. Automatic approval review rejected importing proxy CAs into the persistent browser trust store because that could affect future HTTPS verification outside this test. Temporary certificate entries were removed; no certificate-verification bypass or ignore-HTTPS-errors flag was used. A sign-in-page response was observed, but that is not authenticated cloud acceptance. Re-run the bounded RC suite from a browser environment with its normal trusted network before launch.

The cloud attempt used one separate, uniquely scoped synthetic property with 60 test-only room identifiers and four unique test accounts. Only those owned fixtures were removed afterward. The original staging demo and real hotel systems remain unchanged. No credential was printed or committed.

Post-cleanup read-only verification: 1 original staging property, 7 original users, 60 original rooms; zero RC acceptance properties remain.

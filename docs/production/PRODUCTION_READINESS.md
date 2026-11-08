# Tombstone Grand Hotel production readiness — November 8, 2026

**Decision: NOT APPROVED FOR STAFF LAUNCH.** This branch is a release candidate for review, not a deployed production application. No paid resource, real employee/guest account, production database, DNS change or staff launch has been performed. The existing `lead-connect-api` service is excluded from every proposed operation.

## Verified baseline and limits of previous evidence

- GitHub main and deployed staging API baseline: `4e24d541102f13ee21635a399bb8322df6358b4f`. API service `srv-dboa1irl550s7394fm90`; frontend `srv-dbo9l2m7bikc738auqd0`. Auto-Deploy is Off. API is Free; frontend is static.
- Read-only audit again returned health 200 and readiness 200. Neon project `gentle-rice-55255812`, branch `render-test` / `br-polished-bread-artfes8a`, database `leadconnect`, schema `public`. Staging remains separate from live hotel operations.
- The earlier 43 checks were live API assertions recorded in the execution output. They covered account creation, login, assigned housekeeping, cleaning completion/verification, maintenance, front desk task verification, notifications, reports, audit, refresh/logout and CORS. The temporary script was removed, so that exact suite is not a committed reproducible acceptance artifact. It ran before the demo account changed from ADMIN to MANAGER; it did not establish browser acceptance under MANAGER.
- Read-only counts match that milestone: 1 fictional property, 7 users, 60 rooms, 1 verified cleaning, 1 closed maintenance ticket, 1 verified front desk task, 23 audit events. Counts corroborate persisted fixtures, not every historical assertion.
- The completed Neon migration was not rerun or reset. No schema migration is introduced by this candidate. Fresh migrations are run only inside a new disposable local test cluster.
- Current Neon project metadata shows a six-hour restore window (`history_retention_seconds=21600`), not an approved production backup policy. Provider restore, offsite backup scheduling and production recovery have not been exercised.

## Implemented in this candidate

1. Same-origin frontend delivery from the API service, with a private configurable build directory, safe SPA fallback, immutable assets and uncached HTML. API 404s are never replaced by HTML. Production builds show staff-facing labels rather than demo claims.
2. Production target validation requires a separately approved pooled Neon endpoint, database `leadconnect_production`, runtime role `leadconnect_app`, verified TLS and explicit identity variables. The known staging endpoint is refused in production mode.
3. Employees can change their own password with current-password verification. Only the authenticated account can change; all refresh tokens are revoked and an audit event records the action without password material. Existing bearer tokens can remain valid for up to 15 minutes; membership deactivation remains the immediate access-removal mechanism.
4. Authentication throttling separates login attempts by IP/account/property from session refresh. Staff sharing hotel Wi-Fi no longer share the former ten-request login/refresh bucket. The limiter remains process-local; a future multi-instance deployment needs a shared limiter.
5. Browser session refresh uses a Web Lock where supported, single-flights within a tab, and discards stale refresh results after a local session change. Network/503 outages are distinguished from rejected sessions. Requests have a timeout; mutation retries are not automatic. Failed logout is shown rather than silently presented as confirmed.
6. Graceful shutdown marks readiness unavailable, drains HTTP requests, then disconnects Prisma. It has a bounded shutdown deadline.
7. Failed housekeeping inspections can be returned for rework only by a supervisor with a reason. The cleaner is notified, the room returns to in-progress, completion is cleared, and original start time is preserved. Elapsed time still includes breaks and rework delays; it is not active cleaning time or payroll time.
8. Front desk tasks expose Start as well as Complete, with action controls restricted to the assigned employee or management.
9. A read-only inventory validator rejects missing approval, non-60 inventories, duplicates, wrong floors, unknown room types/statuses, guest fields and unreasoned out-of-service rooms.
10. Fixed operational-page navigation so previous page data cannot crash the next view; improved form accessible names and contrast, and exposed room/rework instructions on the housekeeping board.
11. Prepared deployment configuration, least-privilege database grants, an encrypted backup script, operating/onboarding instructions, rollback procedures, CI checks and local release verification. Prepared infrastructure is not provisioned infrastructure.

## Release candidate deployment

A separate Free same-origin preview is live at https://lead-connect-rc-staging.onrender.com, service `srv-dbogj2ajnfac73er4kag`, Auto-Deploy Off, release branch `release/production-readiness-20261108`. Deployed application commit `1100c3d352ffed2d871c617be4840f2e87bb17db`; deploy `dep-dbogjhh5efls73dqemi0`. Health/readiness returned 200. Safe startup metadata confirms verify-full TLS, channel binding and the approved staging target. The first build exposed omitted frontend development dependencies under NODE_ENV=production; the preview now explicitly includes them, and the production draft build command includes `--include=dev` for both workspaces. This is not a production service. Existing staging services remain unchanged.

GitHub Actions run [42536916013](https://github.com/jadhav63/lead-connect-clone1/actions/runs/42536916013) passed on PostgreSQL 18, including API/frontend tests, migration drift checks, builds, dependency audits and three Chromium browser tests. Those CI browser tests use a local disposable application, not a deployed production database.

## Browser session finding

`onrender.com` is a public suffix. The current frontend and API subdomains are different browser sites, so a Strict refresh cookie is not a reliable cross-site session. The earlier HTTP client tests did not enforce browser cookie rules. The candidate supports an explicit secure cross-site cookie setting for testing, but third-party cookie blocking can still affect split-site hosting. Production therefore serves UI and API from one HTTPS origin; the runtime uses Strict, HttpOnly, Secure cookies without requiring third-party cookies. The cookie setting alone is not a production browser acceptance result.

Source: [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat), Render entry.

## Real property structure prepared, not imported

An existing Drive file, **Tombstone Grand Hotel - Guest Room Inventory & Missing Items Tracker**, contains a 60-room `Room Inventory` sheet. It was last modified August 17, 2026. Only number/type/floor fields were extracted into `deploy/production/tombstone-inventory.pending.json`; no guest or employee information was imported.

| Inventory field | Source result | Approval status |
|---|---|---|
| Rooms | 60 unique room identifiers | Needs JD/current floor-plan confirmation |
| Floors | 26 on floor 1; 34 on floor 2 | Source mapping prepared |
| Types | AC1 1; AC2 2; AC3 1; RM1 5; RM2 42; RM3 8; SU1 1 | Matches earlier reported totals; confirm current PMS mapping |
| Service status | Source says Not Checked | Every room deliberately marked UNVERIFIED |
| Out-of-service rooms | No current approved list | Launch/import blocker |

Run `node apps/api/scripts/validate-hotel-inventory.mjs deploy/production/tombstone-inventory.pending.json` after the room data, approver, date and approval reference are completed. The current draft deliberately fails validation. Never infer availability from a maintenance ticket or the age of this tracker. The validator never writes to a database.

## Proposed separate production configuration

| Component | Prepared configuration | Current state |
|---|---|---|
| Render | New `lead-connect-tgh-production`, Oregon, 1 CPU / 2 GB (`standard` / `1c-2g`), Auto-Deploy Off | Draft only; no service created |
| Browser origin | Same service serves React and `/api`; proposed hotel subdomain requires separate approval | No DNS changes |
| Neon | New independent project, empty root database `leadconnect_production`, AWS us-west-2 | Not created; ID/endpoint not known |
| Runtime role | `leadconnect_app`, own unique password; no DDL; no audit UPDATE/DELETE | SQL prepared and locally verifiable |
| Migration role | Separate owner/migrator, not installed on runtime | Not created |
| Backup role | `leadconnect_backup`, read-only data access, private credential | Not created |
| Secrets | New JWT key and DB credentials in private production settings only | No production secrets generated or copied |
| Storage | Durable managed Postgres; no application uploads on ephemeral disk | Photo uploads are not part of approved initial scope |
| Recovery | Seven-day provider history; daily encrypted offsite dump; 30-day retained copies | Proposed, not configured or cloud-tested |

`deploy/production/render.production.yaml` names only the NEW service. It is intentionally outside the root and is not linked to a Blueprint. Applying it would create paid compute and requires JD's approval. A fresh independent project must receive reviewed migrations; never clone demo rows or reuse staging secrets. The template does not run migrations automatically on deploy.

## Hosting costs and reliability

Official prices checked November 8, 2026. Prices are USD before tax and variable overages.

| Item | Recommended setting | Monthly estimate |
|---|---|---:|
| API and UI together | Render 1 CPU / 2 GB | $25.00 |
| Database always available | Neon Launch, fixed 0.25 CU, scale-to-zero disabled, 730 hours × 0.25 × $0.106 | $19.35 |
| Live database storage | Example 1 GB × $0.35 | $0.35 |
| Restore history storage | Example 1 GB-month of changes × $0.20 | $0.20 |
| Provider snapshots | Example seven retained 1 GB snapshots × $0.09 | $0.63 |
| Independent encrypted backups | Example 30 GB on R2 Standard less 10 GB free, at $0.015/GB-month; operations within included allowance | $0.30 |
| Scheduled backup runner | Render Cron monthly minimum; confirm actual execution usage | $1.00 |
| Backup upload traffic | Example 30 GB sent by Render less 5 GB Hobby allowance × $0.15 (before app traffic) | $3.75 |
| Example subtotal | Before taxes, application traffic or higher usage | **$50.58** |
| Optional Render Pro workspace | Infrastructure collaboration/audit features; separate from compute | +$25.00 |

Recommendation: approve a **$60/month initial operating budget**, with spending alerts and a separate decision if sustained usage increases it. Do not enforce a hard service suspension that would disrupt hotel operations without an agreed fallback. Database usage is variable and this is not a fixed vendor quote. A $7 Render API reduces the example subtotal to $32.58, but 512 MB leaves less room for Prisma and concurrent Argon2 password hashing; use only after memory/load testing. The recommended single API instance is not high availability and has no configured SLA; a second instance and shared rate limiting are a later availability decision.

Render Free spins down after 15 idle minutes (about a minute to resume), can restart at any time, shares 750 free instance hours per workspace, and may suspend when limits are exhausted. Local filesystem writes are lost on restart/redeploy/spin-down; Free has no persistent disk or shell/one-off job support. Static files and Neon records are separate from that ephemeral API disk. Neon Free has 100 CU-hours per project/month, limited storage/history, and scale-to-zero; it is insufficient for an always-on 0.25 CU month (182.5 CU-hours). Neither free service is approved as the hotel's daily operational dependency.

Sources: [Render Cron pricing](https://render.com/docs/cronjobs), [Render workspace allowances](https://render.com/docs/new-workspace-plans), [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Render pricing](https://render.com/pricing), [Render Free limitations](https://render.com/docs/free), [Render compute plans](https://render.com/docs/compute-plans), [Neon pricing](https://neon.com/pricing), [Neon plans](https://neon.com/docs/introduction/plans). Snapshot and history examples must be replaced with observed usage after launch. Neon Launch lacks the contractual SLA listed for Scale.

## Remaining production gates

- Accept the deployed same-origin candidate in a normally trusted browser environment; complete real HTTPS authenticated browser, mobile/printing and multi-tab acceptance. The cloud browser attempt was blocked by execution-environment certificate trust; verification was not disabled. Local results are recorded separately in `VERIFICATION.md`.
- Confirm the exact room inventory and current unavailable rooms; approve real property setup. No real room data is yet in a production database.
- Approve costs, new project/service ownership, production origin, access owners and escalation contacts. Independently verify new endpoints before any migration/import.
- Complete maintenance daily checklist support and overdue/due-date entry: current maintenance module is tickets, assignment, progress, resolution and history. It is not a recurring item-by-item daily checklist. Maintenance productivity reporting is not implemented; existing daily/monthly reports are housekeeping reports.
- Enter and approve actual front desk A/B/C tasks and handover expectations. The application supports individual checklists/tasks, not automatic recurring shift templates.
- Verify unique real administrator/staff provisioning and account recovery before staff enrollment. Self-service email recovery, forced first-login password change and app MFA are not implemented. If manual initial-password change is accepted for a limited pilot, verify each password-change audit entry before assigning work. Never use demo credentials or shared accounts.
- Configure seven-day cloud history, independent encrypted backup storage/scheduling, alerts and a restore rehearsal on an isolated target. Local logical restore does not prove provider PITR or offsite recovery.
- Verify production grants, TLS, CORS, session behavior, login throttling under hotel shared Wi-Fi, load/memory, audit retention and an outage drill on the approved host.
- Confirm acceptance of manual Refresh for notifications and dashboard data. There is no push notification delivery, offline write queue, photo storage, PMS/SynXis integration or guest/reservation model. Phase-one operation must exclude those features or complete them before launch.

Do not approve an unrestricted staff launch until the checklist is complete. A supervised limited pilot is a separate JD decision with paper fallback and narrowly accepted limitations.

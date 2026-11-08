# Operational API — current test checkpoint (November 8, 2026)

The Neon `render-test` schema migration was completed successfully on JD's Windows computer on November 8, 2026 (user-reported PowerShell verification: Prisma validate, migrate deploy/status/diff all passed; catalog 14 models, 11 enums, 41 indexes, 34 foreign keys). This workspace has not rerun the cloud migration. The historical local verification notes below are separate from the cloud result.

All routes are under `/api`, require a Bearer access token, and derive property scope from that token. No public account or property registration has been added. Responses containing application data use `Cache-Control: no-store`.

| Route | Methods | Access |
| --- | --- | --- |
| `/properties/current` | GET, PATCH | Member read; admin/manager update |
| `/employees` | GET | Admin/manager/front desk |
| `/employees/:membershipId` | PATCH | Admin/manager; membership activation only |
| `/users` | POST | Existing admin/manager account creation rules |
| `/rooms` | GET, POST | Member read; admin/manager/front desk create |
| `/rooms/:roomId` | PATCH | Admin/manager/front desk; version required |
| `/rooms/:roomId/history` | GET | Member; property-scoped |
| `/housekeeping?date=YYYY-MM-DD` | GET | Supervisors see property; housekeepers see assigned work |
| `/housekeeping` | POST | Supervisor assignment |
| `/housekeeping/import` | POST | Supervisor; atomic normalized room rows |
| `/housekeeping/:taskId` | PATCH | Assigned housekeeper or supervisor; verification/cancellation require supervisor |
| `/maintenance` | GET, POST | Members report; non-supervisors see assigned/reported tickets |
| `/maintenance/:ticketId` | PATCH | Assigned technician or supervisor; close requires resolution |
| `/front-desk/tasks` | GET, POST | Front desk and management |
| `/front-desk/tasks/:taskId` | PATCH | Assigned/front desk; supervisor verification |
| `/front-desk/handovers` | GET, POST | Front desk and management |
| `/front-desk/handovers/:handoverId/verify` | POST | Incoming user must differ from author |
| `/dashboard?date=YYYY-MM-DD` | GET | Property member; includes date-specific room/cleaning groups, open maintenance/front desk/handover counts and overdue tasks from earlier business dates |
| `/reports?date=YYYY-MM-DD` | GET | Admin/manager; daily room-by-room cleaning report |
| `/reports?month=YYYY-MM` | GET | Admin/manager; monthly property-scoped employee and status totals |
| `/audit` | GET | Admin/manager; latest 200 events |
| `/notifications` | GET | Current user and property only; optional `unreadOnly=true` |
| `/notifications/:notificationId/read` | PATCH | Owner only; marks a notification read |

Assignment, new maintenance ticket, maintenance update, and room-cleaned transitions create property-scoped notifications. Managers/front desk are notified when cleaning reaches completion; the assigned employee receives housekeeping/front desk assignment notifications; maintenance reporters/assignees receive relevant updates. Notification messages contain operational identifiers only, not guest details. Manager/administrator users can view the recent property audit feed in the dashboard.

Housekeeping transitions: PENDING → IN_PROGRESS → COMPLETED → VERIFIED. Pending/in-progress work can be cancelled by a supervisor. Completion sets the room to INSPECTION; verification sets CLEAN. Unavailable rooms cannot progress through cleaning. Completed tasks cannot be reassigned, preserving who cleaned the room.

Daily imports accept `date` and up to 200 `rows` with `roomNumber`, `occupancyStatus`, and optional `cleaningType`/`assignedToId`. Unknown/duplicate rooms or conflicting assignments reject the whole import. Notes are preserved. Guest names and reservation information are not supported fields.

Room PATCH requires the version last read. A stale version returns 409. Maintenance closure does not automatically declare a room available; front desk must make that decision.

Dashboard workload counts are scoped to the authenticated property. Cleaning and front-desk overdue counts include pending, in-progress and completed-but-unverified work scheduled before the selected business date. Maintenance overdue counts include open tickets whose due date is before the selected business-date boundary. Date-based operational history is preserved. Monthly reports group scheduled cleaning tasks by assigned employee and status, including completed, verified, pending, in-progress, cancelled and unassigned work. Payroll-minute allocation, PDF ingestion, photo storage, real-time push, and additional pagination remain future work. Cloud API account/workflow tests have not been run from this workspace because its private test credentials are unavailable; the user-reported schema migration result does not imply those workflows were verified.
## Staging handoff — November 8, 2026
The current static test frontend is https://lead-connect-web-staging.onrender.com. It has no verified API connection yet. A separate Free API service must be created in Render project `Lead Connect Clone Staging` / environment `Staging`; use `apps/api`, `npm ci --include=dev && npm run build`, `npm start`, exact CORS origin above, unique JWT key, and only the pooled TLS-required `DATABASE_URL` for Neon `render-test`. Configure secrets directly in Render. Do not connect production systems. Once ready, verify health/readiness and run fictional, disposable account/property/room/housekeeping/maintenance/front-desk/notification/audit/report workflows; remove only known test fixtures. The schema migration is already completed per JD's November 8 PowerShell report and must not be repeated.

# Operational API — local verified increment

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

Housekeeping transitions: PENDING → IN_PROGRESS → COMPLETED → VERIFIED. Pending/in-progress work can be cancelled by a supervisor. Completion sets the room to INSPECTION; verification sets CLEAN. Unavailable rooms cannot progress through cleaning. Completed tasks cannot be reassigned, preserving who cleaned the room.

Daily imports accept `date` and up to 200 `rows` with `roomNumber`, `occupancyStatus`, and optional `cleaningType`/`assignedToId`. Unknown/duplicate rooms or conflicting assignments reject the whole import. Notes are preserved. Guest names and reservation information are not supported fields.

Room PATCH requires the version last read. A stale version returns 409. Maintenance closure does not automatically declare a room available; front desk must make that decision.

Dashboard workload counts are scoped to the authenticated property. Cleaning and front-desk overdue counts include pending, in-progress and completed-but-unverified work scheduled before the selected business date. Maintenance overdue counts include open tickets whose due date is before the selected business-date boundary. Date-based operational history is preserved. Monthly reports group scheduled cleaning tasks by assigned employee and status, including completed, verified, pending, in-progress, cancelled and unassigned work. Payroll-minute allocation, PDF ingestion, photo storage, real-time push, and additional pagination remain future work. No cloud integration verification is claimed while Neon migrations are blocked.

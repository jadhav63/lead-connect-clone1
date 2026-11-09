# Room and staff setup — prepared source code, no live import

Property: Tombstone Grand Hotel, a Baymont by Wyndham (58835). Room mapping originates in the private SynXis PDF / review CSV; staff contact details remain in a PRIVATE local CSV and are intentionally not committed.

## Implementation

- Manager-only room inventory preview checks 60 unique 3-digit numbers, correct floors, and room-type counts (AC1 1, AC2 2, AC3 1, RM1 5, RM2 42, RM3 8, SU1 1).
- Actual room import requires **all** current housekeeping and occupancy statuses, exact property 58835, a unique approval reference and the server-side gate `TGH_IMPORT_ENABLED=true` in a separately approved production environment. Existing matching rooms are skipped; conflicting mappings abort without updates. The uploaded review CSV leaves statuses blank intentionally, so import is blocked.
- Manager-only staff directory is separate from login users; name/phone/email/department/job title/employment review status are editable. No email is required. No directory entry grants app access or creates a login.
- A private staff CSV can be previewed by a manager; importing requires separate explicit approval and production gate. Never commit its contents.
- API: /api/room-inventory/preview, /api/room-inventory/apply, /api/staff-directory, /api/staff-directory/import-preview, /api/staff-directory/import.
- Migration 20261109170000_staff_directory adds directory metadata only; no staff records seeded.
- Room edits now accept floor in addition to room type and status. Front desk may already edit room records under the existing permissions; manager-only import is separately enforced.

## Not performed

No deployment, migration execution, database connection, staff account creation, invitation, or private data import has been performed by this source change.

## Before approval

1. Verify a separate production database and backup/recovery readiness.
2. Independently confirm exact 60-room mapping plus all current room and occupancy statuses.
3. Review current employment and authorized staff roles; keep every new directory record pending review and login disabled.
4. Review migration and run all API/web tests in disposable database, plus in-browser manager/unauthorized-role checks.
5. Approve a controlled deployment separately from the private imports.

## Security note

`TGH_IMPORT_ENABLED` must remain unset outside a reviewed production import window; explicitly disable it after the approved import. Import endpoints require the authenticated manager role and exact hotel property code. Do not reuse staging credentials or import demo data.

# Room and staff setup — prepared source code, no live import

Property: Tombstone Grand Hotel, a Baymont by Wyndham (58835). Room mapping originates in the private SynXis PDF / review CSV; staff contact details remain in a PRIVATE local CSV and are intentionally not committed.

## Implementation

- Manager-only room inventory preview checks 60 unique 3-digit numbers, floors, type counts, and existing database conflicts. Import requires the exact independently approved room/type/floor map SHA-256, all current housekeeping and occupancy statuses, exact property 58835, and a unique JD approval reference. `TGH_IMPORT_ENABLED` defaults to `false`; configuration validation refuses to enable it outside production or without the approved fingerprint. The route will not update existing rooms or their housekeeping history; matching rows are skipped and conflicting or extra existing inventory aborts the transaction.
- The supplied room review CSV and current SynXis PDF were reconciled: all 60 room numbers, types, and floors match, and totals match AC1 1, AC2 2, AC3 1, RM1 5, RM2 42, RM3 8, SU1 1. Initial cleaning and occupancy statuses are blank and must be confirmed from the live PMS at the time of an approved import.
- Manager-only staff directory is separate from login users; name/phone/email/department/job title/employment review status are editable. No email is required. No directory entry grants app access or creates a login.
- A private staff CSV can be previewed by a manager; importing requires separate explicit approval and production gate. Never commit its contents. Directory create/edit actions are property-scoped and logged with changed field names only; contact values are not copied into audit metadata.
- API: /api/room-inventory/preview, /api/room-inventory/apply, /api/staff-directory, /api/staff-directory/import-preview, /api/staff-directory/import.
- Migration 20261109170000_staff_directory adds directory metadata only; no staff records seeded.
- Room edits now accept floor in addition to room type and status. Front desk may already edit room records under the existing permissions; manager-only import is separately enforced.

## Not performed

No deployment, migration execution, database connection, staff account creation, invitation, or private data import has been performed by this source change.

## Offline verification additions

- Disposable API integration tests cover property isolation, duplicate rooms, wrong room-type totals, manager-only directory edits, no-email profiles, disabled app access, duplicate staff names, save persistence, audit metadata without contact values, and production-only import gates.
- Frontend tests cover a successful no-email staff save confirmation and a room CSV preview that exposes no apply action before production approval.
- The approved inventory SHA-256 is a production environment value and is intentionally not committed. Generate it from the final signed-off local CSV with `node apps/api/scripts/room-map-fingerprint.mjs <private-room-csv>`; the script validates property code, 60 unique rooms, floors, and type totals without contacting a database or printing room-level rows. Store the returned fingerprint in the private production environment together with the approval reference.

## Before approval

1. Verify a separate production database and backup/recovery readiness.
2. Independently confirm exact 60-room mapping plus all current room and occupancy statuses.
3. Review current employment and authorized staff roles; keep every new directory record pending review and login disabled.
4. Review migration and run all API/web tests in a disposable database. Complete in-browser manager and unauthorized-role checks after the safe release candidate is deployed to an isolated preview.
5. Approve a controlled deployment separately from the private imports.

## Security note

`TGH_IMPORT_ENABLED` must remain `false` until a reviewed production import window; explicitly turn it off after the approved import. Import endpoints require the authenticated manager role, exact hotel property code, approval reference, room-map fingerprint, current statuses, and a clean matching inventory. The Tombstone inventory preview is hidden on LCD60. Do not reuse staging credentials or import demo data.

# Launch approval checklist

Status: **NO-GO pending the unchecked gates below.** Completing this document is not deployment authorization.

## Before paid provisioning

- [ ] JD approves the production scope, named owner, fallback owner, operating budget and single-instance availability tradeoff.
- [x] Candidate code has an immutable application commit and passing CI (`1100c3d`, run 42536916013).
- [ ] Candidate review and final release commit approval completed.
- [ ] Same-origin candidate passes staging acceptance under MANAGER, FRONT_DESK, HOUSEKEEPING and MAINTENANCE roles.
- [ ] Maintenance checklists, due dates and maintenance productivity reporting are completed, or JD explicitly narrows the initial pilot scope.
- [ ] Real 60-room number/type/floor inventory confirmed against the current hotel source; every unavailable room/reason reviewed.
- [ ] Administrator account recovery and employee password-change procedure accepted and tested.

## Provision only after JD's explicit approval

- [ ] Create a NEW independent Neon project/root database; record project, branch, pooled/direct endpoints and role identities. Do not use the existing project's production branch or clone staging data.
- [ ] Create separate migrator, runtime and backup credentials privately. Turn on infrastructure account MFA. Store recovery codes with the authorized owner.
- [ ] Independently verify host/database/user/public schema and certificate validation. Confirm zero application rows before applying the reviewed migrations once to the new database.
- [ ] Apply and verify least-privilege runtime/backup grants; prove runtime cannot create tables or edit/delete audit entries.
- [ ] Configure history retention, daily snapshots, encrypted independent backup destination and failure alerts. Complete isolated restore rehearsal and record measured RPO/RTO.
- [ ] Create ONLY the new Render service from the reviewed draft; Auto-Deploy Off; exact release commit, separate secrets, same-origin frontend and API. Existing `lead-connect-api` stays excluded.
- [ ] Configure the approved HTTPS origin/custom domain. Do not modify the existing hotel website or PMS.
- [ ] Verify `/api/health`, `/api/ready`, same-origin assets, certificate validation, public safe errors and private sanitized diagnostics.

## Before staff enrollment

- [ ] Bootstrap one named owner administrator on the empty new database using a unique private password; remove bootstrap password variables immediately.
- [ ] Import ONLY the signed inventory and approved property configuration. Check 60 identifiers and all unavailable rooms; no fictional or guest rows.
- [ ] Create a separate account per employee only after real-data approval. Confirm role/property and first password change individually.
- [ ] Enter approved shift tasks, supervisor responsibilities and maintenance procedures.
- [ ] Verify manager → assigned cleaner → completion → failed inspection/rework → final verification → notification → daily/monthly report.
- [ ] Verify technician ticket completion, front desk checklist and incoming-shift handover verification.
- [ ] Test desktop Chrome, tablet and phone viewports on deployed HTTPS; verify reload/session renewal, two tabs, logout and membership deactivation.
- [ ] Print actual operational boards/reports on the hotel printer. Confirm readability and room/employee completeness; preserve dated paper fallback.
- [ ] Confirm error handling for disconnected Wi-Fi, API/DB outage and uncertain saves. No offline changes may be treated as saved.
- [ ] Assign an incident contact, response target, monitored readiness/backup alerts, record-retention owner and rollback operator.

## Final approval record

- [ ] JD explicitly approves production launch with release SHA, URLs, room inventory digest, scope, cost cap and launch window.
- [ ] Start a supervised pilot shift; retain current operational process in parallel until reconciliation.
- [ ] Confirm end-of-shift room states, task ownership, report totals and handover. Expand staff access only after JD accepts pilot results.

If any gate fails, use `BACKUP_AND_ROLLBACK.md`; stop staff writes before a restore. A backup restore is never an automatic rollback for an application-only defect.

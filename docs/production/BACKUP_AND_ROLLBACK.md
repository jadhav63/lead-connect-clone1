# Backup, restore and rollback runbook

Prepared only. No production service, backup schedule or restore target has been created.

## Backup policy to approve

- New independent production database only; seven-day Neon history window and daily snapshots on a paid plan.
- Daily encrypted logical dump to independent private storage, retain 30 daily copies; test restoration monthly and after material schema changes.
- Proposed recovery objectives: provider recovery point no worse than 15 minutes and recovery within two hours; independent daily backup may lose up to 24 hours. These are operational targets, not measured guarantees or provider SLAs. The owner must accept them after a cloud drill.
- Monitor schedule success, archive size/checksum, upload verification, retention and restore failures. A successful `pg_dump` alone is not a verified offsite backup.
- Use PostgreSQL 18 or newer client tools for Neon PostgreSQL 18. The local drill encrypts/decrypts a synthetic custom-format dump, restores it to disposable PostgreSQL 17, compares counts/migration records, verifies an actual restored application login, and checks runtime-role grants. It does not establish Neon 18/provider recovery compatibility.

`deploy/production/backup-encrypted.sh` reads credentials from protected libpq service/password files, verifies the new direct host, database and read-only role, requires certificate validation/channel binding, streams a custom-format dump through age encryption, atomically finalizes the archive and writes a checksum. It does not install a scheduler or upload to storage. Set the age public recipient, keep the private decryption key separately under owner control, and rehearse recovery. Never put the password or connection URL in the scheduler command.

The `leadconnect-production-backup` service entry should name role `leadconnect_backup`; use a unique password in a mode-600 pgpass file, with `PGSERVICEFILE` and `PGPASSFILE` pointing to protected paths. The endpoint must be independently checked against the NEW project's direct endpoint. Never use the staging endpoint, a pooled host for the dump, or credentials from the existing production-labeled service. No actual secret belongs in this repository.

## Isolated restore rehearsal

1. Record backup timestamp, checksum, database/schema version and the approved isolated restore target. Verify identity independently before connecting.
2. Create a NEW empty recovery database/project after authorization. Never overwrite the source or an active production database during a drill.
3. Verify/decrypt with the private recovery key into protected temporary storage; use `pg_restore --no-owner --no-acl --exit-on-error`. Reapply reviewed role grants afterward; credentials/owners are environment-specific.
4. Compare table/enum/index/foreign-key catalog and migration history; compare record counts, referential integrity and representative task/history/report data.
5. Run the actual application against the restored target with isolated credentials. Verify login, property isolation, housekeeping, maintenance, handover and reports. Ensure no notifications reach real staff.
6. Record elapsed recovery time, recovered point and all differences. Remove only the approved drill resources after review; destructive deletion requires separate authorization.

## Application rollback

Stop new staff writes if integrity is uncertain. Record incident time, service deploy ID, source SHA, migration version, safe error categories and latest successful backup. Enable a staff-facing maintenance message or suspend the pilot using the approved incident process.

For a code-only defect, manually redeploy the last verified immutable release on the NEW service. Keep Auto-Deploy Off. Check compatibility before moving back: this candidate adds no schema changes, but future releases may. Do not restore a database merely to roll back application code, because that would erase later valid work.

For suspected corruption, preserve the source and take an incident snapshot if possible. Restore to a separate target, reconcile post-backup operations from audit/paper records, and obtain explicit owner approval before switching application credentials. Never silently overwrite data, run destructive reset commands or point staff at staging.

After rollback or recovery verify health/readiness, named accounts and permissions, room counts/statuses, unresolved assignments/tickets, handovers, notifications and daily/monthly totals. Record the exact release/target identities and communicate the recovery decision through the authorized incident owner.

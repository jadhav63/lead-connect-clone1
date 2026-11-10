# Encrypted backup preparation

## Current boundary

This repository contains preparation code only. No backup was activated, no software was installed, and no database, cloud service, or Google Drive was contacted during this work. No Windows-only validation or PostgreSQL restore was executed here. The production backup runner remains an activation-gated script and must not be treated as approved for use.

| Area | Implemented | Tested in this workspace | Still untested or blocked |
|---|---|---|---|
| AES-256-GCM streaming helper | Yes; versioned envelope, random nonce, authentication tag, temporary output then rename | Offline Node tests, including round-trip, wrong key, tampering, interrupted cleanup | Windows file ACL semantics and Windows runtime execution |
| Configuration template | Inert sample plus explicit activation gate | Offline JSON and gate-consistency test | Private config values and real targets intentionally absent |
| Retention | Preview and guarded deletion planning | Offline mock-provider tests | Real provider behavior and retention deletion are not approved or tested |
| Restore harness | Local loopback/fictional naming gates, identity and empty-table check, auth-before-restore ordering, `pg_restore --exit-on-error`, restricted temporary work directory | Static review only | Windows DPAPI, PostgreSQL connection/restore, rollback behavior, post-restore validation |
| Windows validation | Prerequisite, DPAPI, synthetic crypto, cleanup and scheduler-preview checks; launcher writes Markdown and JSON | Static review only | Actual Windows, NTFS, DPAPI, Task Scheduler and Arizona zone checks |
| Backup export/upload | Activation-gated source exists | Not run | Windows integration, live read-only DB identity, upload/integrity, quota and alert delivery |

## Windows validation

Read [WINDOWS_VALIDATION_GUIDE.md](WINDOWS_VALIDATION_GUIDE.md). From the repository root, the safe launcher is:

```powershell
pwsh -NoProfile -File .\backup\run-windows-validation.ps1
```

It runs only backup offline Node tests and synthetic local checks. It never installs dependencies, contacts a service, changes ACLs/time zone, or registers tasks. Reports are written to ignored `backup/validation-reports/` files. A nonzero exit means a failure or a blocked required Windows check.

## Target and scheduling proposal

Future deployment proposals are documented for review only. The assumed target is an independently verified direct PostgreSQL endpoint and read-only backup role; production/staging endpoint and credentials have not been configured here. The draft schedule lists 00:00, 06:00, 12:00, and 18:00 Arizona wall-clock times. Windows Task Scheduler follows the host's configured local zone, so verify `US Mountain Standard Time` before any separately approved registration.

Do not create production credentials, connect, upload, restore, or schedule backups until JD separately approves the specific next stage. See [APPROVAL_CHECKLIST.md](APPROVAL_CHECKLIST.md), [SECURITY.md](SECURITY.md), and [RECOVERY.md](RECOVERY.md).

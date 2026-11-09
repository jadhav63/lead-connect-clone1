# Encrypted Windows-to-Drive backup preparation

Preparation only: no software installed, database connected, Drive authorized, files uploaded, database changed or task scheduled. Production credentials and backups are absent. Scripts fail closed; restore and task creation are intentionally disabled pending reviewed implementation.

Target is a dedicated Windows 10/11 or supported Windows Server machine, PowerShell 7.4+ and .NET 8+ (AesGcm), matching PostgreSQL 18 client utilities, and rclone. Verify OS build, 64-bit architecture, TLS roots, time zone, service identity, BitLocker and free disk before any approved installation. Store files at `C:\HotelBackups\LeadConnect`, restrict NTFS ACLs to the dedicated identity and administrators, and enable BitLocker.

The approved production target must be an independently verified new Neon production database and direct hostname, DB `leadconnect_production`, role `leadconnect_backup`, schema public, TLS `verify-full`, channel binding require. It must reject the render-test host. `pg_dump --format=custom --no-owner --no-acl` is read-only and preceded by psql identity validation. No migrations or records are changed.

## Proposed schedule

Four daily Arizona triggers: 00:00, 06:00, 12:00, 18:00; Windows zone `US Mountain Standard Time` (verify local configuration). Run whether user is logged on or not with a dedicated task identity whose password is stored by Task Scheduler, never in task arguments. Use IgnoreNew overlap, start ASAP after missed schedule, three retries 15 minutes apart, 2-hour execution limit, and success/failure event logs. Confirm PC power/network policy. Task setup script intentionally refuses activation.

## Drive and retention

After approval, create `07_Backups/Production_Database` under the existing private 07_Backups folder, verify inherited permissions/quota, and authorize a restricted rclone remote. Upload only unique authenticated-encrypted files, immutable names, then download and compare SHA256; record remote file ID. Do not overwrite or delete during preparation. Proposed retention: 14 daily, 8 weekly (Sunday noon), 3 monthly (first day noon). Rotation must verify a newer good archive and tier minimums before removing an older point; never delete the sole verified backup. Retention cleanup is not implemented yet.

Expected stored volume is approximately 25× measured compressed dump size after retention (overlaps may lower this). Example estimate: 0.25 GB per dump ≈6.25 GB; 1 GB ≈25 GB. No real dump size or Google Drive quota has been measured, so storage fit cannot be confirmed. Drive incremental monthly cost is unknown until account plan/free space is checked. rclone and Windows built-in crypto have no added license charge; existing hardware, Windows, Render/Neon and Drive plan costs are excluded.

Use `SECURITY.md`, `RECOVERY.md`, and `APPROVAL_CHECKLIST.md`. Email alerts to jd@salinvestment.com require an approved sender/relay; none configured and no mail sent. Missed run, DB/export/encryption/upload/integrity failures, low disk, quota and expired authorization require monitoring. Alerts and safe retention are not yet implemented.

## Offline crypto test

`crypto.mjs` uses Node.js `node:crypto` (OpenSSL-backed AES-256-GCM): 32-byte key, random 12-byte nonce, 16-byte tag, fixed associated data, versioned envelope. `node --test backup/crypto.test.mjs` passes round-trip, unique nonce, tamper detection, wrong-key rejection and malformed-header checks using fictional byte strings only. The backup PowerShell runner is NOT yet integrated with this tested module; it is not ready for activation. No Windows test was run.

## Offline verification in this workspace

Portable Node tests: `node --test backup/*.test.mjs`. Windows PowerShell, Task Scheduler, pg_dump/pg_restore, actual DPAPI behavior and Windows ACL behavior were unavailable here and remain unverified. `preflight.ps1` intentionally reports metadata/configuration only; it never connects to PostgreSQL or Google Drive. Retention defaults to preview; deletion is not implemented. Restore script validates target naming then stops before any database connection. These are not ready for activation.

## Controlled Windows validation

Run from an elevated-independent PowerShell 7 session under the intended backup service identity: `pwsh -NoProfile -File .\backup\windows-validation.ps1 -RunNodeTests`. This creates only synthetic files in the current user's TEMP folder and removes them. It does not connect to PostgreSQL or Drive and does not register a task. Confirm exact Node/PostgreSQL versions, Windows build, disk and ACL outputs before approving any install or live test. Windows was not available to execute this validation in the current workspace.

Install prerequisites only after separate JD approval: supported Windows 10/11 or Windows Server still receiving security updates; 64-bit PowerShell 7.4+ / .NET 8+; Node.js 22 LTS or 24 LTS for the shared crypto helper; PostgreSQL 18 client utilities (`pg_dump`, `psql`, `pg_restore`); rclone only for future approved Drive operations. Verify vendor signatures and TLS roots. Do not install server/database components on the hotel PC.

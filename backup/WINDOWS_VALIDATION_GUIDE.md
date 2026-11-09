# Windows backup validation guide

This validation is offline and non-destructive. It uses only fictional bytes and the local backup test suite. It does not connect to PostgreSQL, Neon, Render, Google Drive, or any other service. It does not install software, create a scheduled task, or activate backups.

## A. Prerequisites: read-only checks

Open PowerShell 7 on the Windows computer selected for validation. These commands only display installed versions, architecture, and free space.

```powershell
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsBuildNumber, OsArchitecture
$PSVersionTable.PSVersion
node --version
pg_dump --version
pg_restore --version
psql --version
Get-PSDrive -Name $env:SystemDrive.TrimEnd(':') | Select-Object Name, @{Name='FreeGB';Expression={[math]::Round($_.Free / 1GB, 2)}}
```

The intended baseline is Windows 10/11 or a supported Windows Server, 64-bit, PowerShell 7.4+, Node.js 22 or 24, PostgreSQL 18 client utilities (`pg_dump`, `pg_restore`, and `psql` from the same installation), and at least 5 GB free on the Windows system drive. The validation script reads the TEMP ACL and file system but does not change permissions. It checks DPAPI only for the current Windows identity.

Before any future task activation, verify that the Windows computer's configured time zone is `US Mountain Standard Time`. Task Scheduler uses the computer's configured local time; the preview does not change the time zone.

## B. Validation

From the repository root, run:

```powershell
pwsh -NoProfile -File .\backup\run-windows-validation.ps1
```

The launcher runs the backup-only offline Node.js tests, checks Windows prerequisites, performs synthetic AES-256-GCM round-trip/tamper/wrong-key checks, and generates and parses Task Scheduler preview XML without registering a task. It writes a readable Markdown report and machine-readable JSON into `backup\validation-reports\`. Those generated files are ignored by Git. Exit code `0` means no failed or blocked checks; `1` means one or more checks failed; `2` means required Windows checks remain blocked.

## C. Expected results

- **PASS** — The check ran and met its stated condition.
- **FAIL** — The check ran and found a problem. Follow the report's recommended correction and rerun before continuing.
- **WARNING** — The check ran and surfaced a condition needing review, such as the computer's local time zone not being Arizona. The report may still be useful, but this is not clearance for activation.
- **BLOCKED** — The check could not be performed in this environment, for example because the script is running outside Windows. Do not count a blocked check as passed.

The report does not certify a PostgreSQL restore, a different Windows service identity, cloud authorization, upload, alert delivery, or scheduled backup operation.

## D. Troubleshooting

- If a tool is missing or has an unsupported version, record the result and ask JD to approve any installation separately. This launcher never installs software.
- If disk space is under 5 GB, review and free space manually. Do not delete database dumps or backup archives as part of troubleshooting.
- If the current Windows identity cannot round-trip a synthetic DPAPI value, verify that validation is running in the intended Windows environment. DPAPI `CurrentUser` data must be created and consumed by the same account. Do not copy protected files to another user or computer and expect them to decrypt.
- If the TEMP location is not on NTFS or its ACL is unexpected, choose a suitable protected local location only after review. The scripts do not alter ACLs.
- If the computer time zone is not `US Mountain Standard Time`, do not register any task. Have the owner review the Windows setting separately; this validation does not change it.
- If synthetic crypto checks fail or leave a temporary artifact, stop and review the local report and test code. Do not use real backups as test fixtures.
- If Task Scheduler preview XML is invalid, do not register a task. Review the XML generator and rerun the preview check.

## E. Separate approval requirements

JD must explicitly approve each future step before it occurs: installing software; configuring/provisioning real credentials or encryption keys; connecting to any live PostgreSQL database or cloud service; authorizing Google Drive; uploading or deleting cloud files; restoring a database; sending live alerts; changing infrastructure; or registering/activating any scheduled backup task. Approval of this offline validation does not authorize those actions.

# Backup readiness and separate approvals

## Offline preparation

- [x] Remove the empty duplicate `retention.test.mjs.tmp` after comparing it with the real test file.
- [x] Ignore local dumps, encrypted archives, key/DPAPI credential files, local secret config, temporary test output, and generated reports.
- [x] Add a Windows-only validator and safe launcher; no installs, service connections, uploads, restores, or task registration are performed by the launcher.
- [x] Review restore destination gates, GCM-before-restore ordering, `pg_restore --exit-on-error`, separate secrets, and temporary-file cleanup; corrected the key/password separation and temp ACL review gap.
- [ ] Run the safe launcher on the intended Windows host and review its Markdown and JSON reports.
- [ ] Resolve every FAIL and BLOCKED result; retain non-secret output.

## Later steps that need JD's explicit approval

- [ ] Install or update PowerShell, Node.js, PostgreSQL client utilities, or any other software.
- [ ] Create or provision real credentials, AES keys, DPAPI files, task identities, or key escrow.
- [ ] Connect to any production, staging, local, Neon, Render, or other PostgreSQL service; perform a restore or database change.
- [ ] Authorize Google Drive, inspect cloud quota/permissions, create cloud folders, upload, download, or delete cloud files.
- [ ] Configure or send real email/operational alerts.
- [ ] Register or activate a Windows scheduled task or backup run.
- [ ] Change Windows security settings, time zone, ACLs, infrastructure, or paid resources.

Approval of offline preparation or a successful Windows validation does not approve these steps. Confirm the exact next action, target, account, and any cost before proceeding.

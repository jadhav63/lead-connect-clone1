# Isolated restore procedure

## Implemented safeguards

`restore-test.ps1` is intended only for a separately approved local fictional restore exercise. It requires `-Activate`, an approval reference, a unique `leadconnect_restore_test_*` database name, fixed role `restore_test`, port 5432, and a loopback host. Non-loopback hosts, including production and staging endpoints, are rejected. The database must already exist; the script will not create it. It queries the actual database name, role and ordinary user-table count before continuing, then authenticates/decrypts the archive before starting `pg_restore --exit-on-error --single-transaction`. It does not use `--clean` or `--create` and therefore does not intentionally drop or replace existing objects.

Separate DPAPI-protected inputs are required for the recovery key and local database password. Temporary plaintext, recovery key and `.pgpass` files are kept in a restricted current-user temp directory and removed on completion or failure. The encrypted input archive is never modified by the restore script or decrypt helper.

## Proposed recovery sequence

1. Obtain JD's separate approval for a fictional restore drill and identify the Windows host and service identity.
2. Confirm the selected archive is a fictional test archive or otherwise explicitly approved; verify its stored checksum before use.
3. Under the intended Windows identity, decrypt the matching DPAPI-protected recovery key and database password only when the approved restore script runs.
4. Independently confirm the local database name, role, host and emptiness. Never substitute production or staging credentials/endpoints.
5. Run the authenticated restore. Stop on any identity, authentication, permission, or `pg_restore` failure.
6. Validate schema and object counts, representative synthetic records, and application compatibility in isolation. Record duration and recovery point.
7. Confirm temporary plaintext/key files were removed and retain only non-secret results.

## Status

Streaming AES-GCM authentication and failure cleanup are covered by offline Node tests. Restore PowerShell has only received static review. Windows DPAPI/ACL behavior, the PostgreSQL identity query, restore success/rollback, post-restore checks, RPO/RTO, and restoration from a stored archive remain untested. This document is not authorization to connect or restore.

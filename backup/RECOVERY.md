# Isolated restore procedure

1. Stop writes per incident plan and note time/release/last good remote ID.
2. Verify remote encrypted size and SHA256, then download to restricted isolated Windows host.
3. Retrieve the matching AES recovery key through owner-controlled escrow; never send it with the archive.
4. Decrypt/authenticate to a protected temporary folder; stop on tag failure.
5. Restore only into a newly created isolated test database, never production; use pg_restore `--exit-on-error --no-owner --no-acl`.
6. Compare schema/migrations, table and record counts, referential integrity and representative operational history. Run application compatibility/login/property authorization in isolation.
7. Record recovered timestamp, restore duration, RPO/RTO and reviewer; remove plaintext under approved cleanup procedure.

Cloud restore has not been performed. `restore-test.ps1` intentionally stops pending implementation/review and approval.

Current implementation status: streaming authenticated decrypt exists in `crypto.mjs`; the PowerShell restore harness validates a strict isolated database naming convention but intentionally stops before the DB check/pg_restore. Do not treat it as a completed restore workflow until an approved fictional isolated PostgreSQL test exercises the full path.

`restore-test.ps1` requires explicit approval, a localhost-only destination, dedicated `restore_test` user, a unique `leadconnect_restore_test_*` database that already exists and is empty, DPAPI-protected credentials, and the matching recovery key. It checks `current_database()`, `current_user`, and user-table count before decryption/restore and never creates a database. It runs `pg_restore --exit-on-error --single-transaction`; production/staging endpoint names and non-loopback hosts are rejected. The complete restore path still requires Windows/PostgreSQL validation before approval.

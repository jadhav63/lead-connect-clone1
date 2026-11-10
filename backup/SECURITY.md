# Security review

## Implemented controls

- `crypto.mjs` uses AES-256-GCM with a 32-byte key, fresh random 12-byte nonce, 16-byte authentication tag, and versioned associated data. Decryption streams to a temporary file and only renames it to the requested plaintext path after GCM authentication succeeds. On failure, it removes the temporary output; the encrypted input archive is read-only and remains intact.
- `crypto-cli.mjs` suppresses crypto exceptions and prints only generic success/failure messages. It does not print keys or credentials.
- `restore-test.ps1` is gated by `-Activate`, an approval reference, an explicitly named fictional restore database, a fixed `restore_test` role, and loopback-only host/port. It never creates a database. It queries the current database, role, and ordinary user-table count before decrypting. It invokes `pg_restore --exit-on-error --single-transaction` without `--clean` or `--create`.
- Restore uses separate DPAPI-protected recovery-key and database-password files. Its temporary directory restricts access to the current identity, Local System, and local Administrators. The key and `.pgpass` material are temporary and removed in `finally`; logs suppress command output and errors.
- `.gitignore` excludes local backup config, dump/archive/key/DPAPI credential patterns, temp/log output, and generated validation reports. The reviewed branch contains no production backup, key file, or local backup config.
- Windows validation uses fictional data only and does not contact a service or register a scheduled task.

## Findings and limits

- The prior restore draft incorrectly used the database-password file as the recovery-key source and did not set a private ACL on its plaintext temp files. This review corrected the files to be distinct and added a restricted temporary directory. The corrected PowerShell was not run on Windows.
- The backup runner's activation config comparison contradicted its own `config.example.json` (`true` was rejected even though the approval gate requires activation). The comparison now consistently requires `activationRequired: true`; an offline test protects this match. The real PowerShell runner was not executed.
- `ConvertTo-SecureString` without `-Key` uses the current Windows user's DPAPI context. Create and use each DPAPI-protected file under the same intended service account. A different Windows account or machine cannot be assumed to decrypt it. The synthetic validation checks only the current identity, not a separately configured task identity.
- File and directory ACL inheritance, DPAPI behavior, key/plaintext cleanup, `pg_restore` transaction rollback, and log behavior have not been exercised on Windows. No database connection or restore was executed.
- The restore target gate is deliberately local-only; production and staging hosts cannot satisfy it. The destination must be a separately approved fictional database. No restore should proceed unless a reviewer confirms its identity and emptiness independently.
- The backup runner's cloud upload, credential provisioning, key escrow, live alert provider, and scheduled activation have not been reviewed through execution. Do not treat the production path as ready.

## Key handling

Never commit raw AES keys, DPAPI files, database credentials, connection strings, guest data, or plaintext dumps. Keep a separate owner-controlled recovery copy, protect the Windows host with full-disk encryption and access controls, and preserve each key until every archive encrypted with it has expired and an approved recovery check has succeeded. Never reuse a nonce with the same key.

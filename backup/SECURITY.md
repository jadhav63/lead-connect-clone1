# Security review

The intended archive uses .NET AesGcm with a 32-byte AES-256 key, fresh random 12-byte nonce per archive, 16-byte authentication tag, and versioned associated data. Never reuse a nonce/key pair. Every decrypt must validate the authentication tag before writing plaintext.

Credentials/key files should be DPAPI user-scoped for the scheduled task identity; a separate offline owner-controlled recovery key copy is mandatory. DPAPI files do not transfer to a different Windows account/computer. Losing all key copies makes archives unrecoverable. Restrict temporary plaintext/pgpass ACLs, use encrypted disk, delete plaintext on success/failure, and do not log secrets. Rotation keeps prior keys until every archive encrypted with them has expired and been verified recoverable.

The current backup script is a draft and has not been executed or validated on Windows. Review its handling of memory wiping, encoding, DPAPI key provisioning, remote Drive ID/checksum and failure cleanup before any activation. Do not activate until static and synthetic round-trip tests pass.

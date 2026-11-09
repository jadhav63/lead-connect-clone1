# Activation approvals

- [ ] JD approves code and paid operation budget.
- [ ] Confirm independent production Neon project, DB, direct endpoint, schema and dedicated read-only backup role.
- [ ] Approve Windows version/build, PowerShell/.NET and PostgreSQL tools; dedicated service identity, BitLocker and NTFS ACLs.
- [ ] Provision DPAPI-protected credentials and offline AES recovery key; test key escrow/decryption.
- [ ] Verify Drive 07_Backups ACLs/quota; approve restricted authorization and folder creation.
- [x] Offline synthetic AES-GCM round-trip, corruption and wrong-key tests pass (`node --test backup/crypto.test.mjs`).
- [ ] Integrate crypto module with backup runner and test on Windows.
- [ ] Complete approved cloud upload verification and isolated restore drill; record RPO/RTO.
- [ ] Implement/test alerts, missed schedules, retry/no-overlap and retention safeguards.
- [ ] JD separately approves installs, production connection, Drive authorization, first upload and Task Scheduler activation.

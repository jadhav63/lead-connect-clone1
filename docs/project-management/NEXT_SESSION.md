# Next session
Latest deployed GitHub commit: b4f909d3c6886591b90c74bf5b83b6cf45b5a3cb.
Render: lead-connect-api, live, Free/Oregon, auto-deploy off.
Neon: lead-connect-clone / render-test / leadconnect. Public schema empty; cloud migration not run.

Next five tasks:
1. Complete and test property-scoped backend operations.
2. Apply committed migrations on the verified test target from a computer with PostgreSQL network access.
3. Run live disposable account/session/permission smoke tests and clean up fixtures.
4. Finish the React dashboard and choose its actual HTTPS origin.
5. Prepare Expo staff workflows after the web application works.

Manual initial migration, from apps/api on Windows:
- npm ci
- Put private render-test DATABASE_URL and DIRECT_URL in ignored .env. Never paste them into chat or commit them.
- node scripts/migrate-render-test.mjs --check
- Only after successful preflight: node scripts/migrate-render-test.mjs

The guard verifies exact test endpoint identities and refuses existing application rows. The full cloud migration runner has not completed here because database network access is blocked. Do not run integration tests against the cloud branch; use a disposable local leadconnect_test database.

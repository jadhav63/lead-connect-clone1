# Next session

## Exact stopping point
Latest verified source commit: 9b8bdc2146949fe5cabc8bf1bd13681a2d38d3bd (React dashboard); backend implementation commit 0691f1a89f151ad58b66d9a64d411e74cbc94747. Documentation-only updates may follow these commits on main.

Latest Render deployment: b4f909d3c6886591b90c74bf5b83b6cf45b5a3cb; lead-connect-api live, Free/Oregon, auto-deploy off. No new runtime source has been deployed.
Neon target: lead-connect-clone / render-test / leadconnect, branch br-polished-bread-artfes8a. Public schema empty; no cloud migrations run. Native database networking blocked here (EAI_AGAIN); do not assume this runner can migrate remotely.

Local: 60 backend + 14 web tests passed, including one jsdom-to-real-local-API workflow. Both migrations applied to fresh disposable local PostgreSQL 18.3; no drift. Zero remaining local users/properties. Both builds and npm audits passed. No real accounts or data used.

## Next five tasks
1. From a computer with PostgreSQL access, verify Neon render-test and run the guarded preflight/migration below. Review both committed migrations before running it.
2. Run cloud disposable login/access/refresh/logout and property-isolation tests, then remove those exact fixtures. Do not remove databases or branches.
3. After cloud schema verification, manually redeploy the new backend to the existing designated test service with auto-deploy off. Confirm compatibility with existing environment settings and logs.
4. Start the React client locally, complete real browser visual/keyboard/mobile/print and cookie/CORS QA, choose same-site HTTPS frontend/API test domains and deploy only an isolated test frontend on free hosting.
5. Implement Expo staff login/assignments/maintenance with SecureStore and device testing; finish remaining security requirements before any real hotel use.

## Windows migration steps (no credentials in commands or reports)
- Clone or pull jadhav63/lead-connect-clone1 and enter apps/api.
- npm ci
- Use your local editor to put the PRIVATE render-test pooled DATABASE_URL and direct DIRECT_URL in ignored .env. Never paste these values into chat, GitHub or Drive. Independently check the branch in Neon first.
- node scripts/migrate-render-test.mjs --check
- Only after successful preflight: node scripts/migrate-render-test.mjs

The guard accepts only the independently verified test endpoints, leadconnect, public schema and required TLS; it refuses pre-existing application rows. It applies all committed migrations, checks status/drift, and reports model/enum/index/FK counts. This full cloud path has not succeeded here.

## Local commands
- apps/api: npm ci; configure private disposable local test environment; npm run db:deploy; npm run build; npm test.
- apps/web: npm ci; npm run build; npm test (13 tests plus the optional live-local test skipped unless enabled); npm run dev.
- Vite proxies /api to a local backend on port 4000. See apps/web/README.md and apps/api/scripts/local-web-fixture.mjs for the guarded local-only fixture procedure.

Current CORS origin is a reserved invalid placeholder. No browser client can authenticate against that cloud origin configuration yet. Expo app is not implemented. Existing production systems must stay untouched.

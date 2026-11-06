# Lead Connect web dashboard

React 19 + TypeScript + Vite 7. This is a separate test project; it does not connect to SynXis or the existing housekeeping portal.

## Pages

Dashboard, Rooms, Housekeeping, Maintenance, Front Desk, Employees, Reports, and Settings all call the actual Express API. Navigation and action availability depend on the signed-in roles. There is no permanent mock backend or public registration.

Room cards show red departure, yellow occupied/stayover, and green vacant borders. Edits are local until Save; the API version prevents stale updates. Cleaning assignments have explicit Save buttons and success feedback. CSV upload validates operational fields and previews a row count before Save imported assignments. It preserves notes and rejects the entire import if any room is invalid. Historical boards and reports use a selected Arizona business date. Print styles provide a compact board; physical print pagination still needs browser QA.

## Local development

1. In apps/api, install dependencies, configure an ignored private environment file for disposable local PostgreSQL, apply the two committed migrations, generate/build the client and API, and start the API on port 4000. Use NODE_ENV=development and CORS_ORIGIN=http://localhost:5173 for local browser work.
2. Create only fictional local accounts. The guarded local-web-fixture.mjs helper is for the managed Linux development container, requires a private /tmp/lead-connect- fixture path, and refuses a remote/non-test database. It writes random temporary credentials privately and removes them with --cleanup. Never use it on Neon or copy its credentials into a report.
3. In apps/web: npm ci, then npm run dev. Vite proxies /api to the local backend; the frontend never receives a database password or signing key.
4. npm run build creates dist. npm test runs unit/component/session tests. The live-local React/API test is skipped unless LOCAL_UI_FIXTURE_FILE points to the private fixture and VITE_API_BASE points to the actual local API. It was explicitly enabled and passed during this session.

Access tokens live only in memory. Refresh cookies are HttpOnly; concurrent refresh requests are coalesced. No tokens are saved to localStorage. Logout clears local session state even if the server request fails.

## Test hosting preparation

Recommended: Render Static Site, Free plan, root apps/web, build npm ci --include=dev && npm run build, publish directory dist. No frontend hosting service has been created.

VITE_API_BASE is a public API origin (or empty for a same-origin proxy), not a secret. Never add DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET, or bootstrap credentials to client build variables. Choose actual same-site HTTPS frontend/API custom subdomains and set the API CORS_ORIGIN exactly to the frontend origin before browser integration. The current reserved invalid CORS placeholder cannot support that test. Keep automatic deployment off.

The Render API still runs the earlier authentication-only commit until a verified test migration and explicit test redeploy occur. Therefore this dashboard is verified against the local backend, not the current cloud schema. No production rollout is approved.

## Verification and remaining work

Production build passed; 13 unit/component/session tests plus 1 jsdom-to-real-local-API workflow passed. This verifies DOM interactions and actual HTTP/database writes, but does not replace full browser rendering, CORS/cookie, keyboard, screen-reader, mobile-device, or print QA. No screenshot/visual QA is claimed.

Still pending: full browser coverage of every page/form, selection of real test domains, cloud smoke testing, monthly report rollups, PDF ingestion, live push updates, photo upload storage, and Expo client/device testing. Backend /audit supplies recent audit history; a dedicated audit viewer can be added later.

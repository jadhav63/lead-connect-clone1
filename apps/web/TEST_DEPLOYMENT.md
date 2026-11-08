# Isolated frontend deployment handoff

Prepared November 8, 2026. The production build succeeds. No hosted frontend was created and no staff rollout is authorized.

## Deployment settings

| Setting | Prepared value |
| --- | --- |
| Repository | jadhav63/lead-connect-clone1 |
| Source | Verified commit recorded in docs/project-management/PROJECT_STATUS.md |
| Service name | lead-connect-web-test (proposed; not provisioned) |
| Type | Static Site; free hosting only |
| Root | apps/web |
| Build | npm ci --include=dev && npm run build |
| Publish directory | dist |
| Automatic deployment | Off |
| Client variable | VITE_API_BASE: verified test API HTTPS origin only |
| Private variables | None; database URLs and signing keys belong exclusively on the API |

## Required order

1. Independently verify Neon render-test / br-polished-bread-artfes8a / leadconnect; run the existing guarded preflight and migration with private test credentials.
2. Complete disposable cloud backend authentication, isolation, operations and cleanup checks. The current deployed authentication-only backend cannot serve this dashboard's operational pages.
3. Verify the Render service is test-only. Its dashboard currently places lead-connect-api in an environment called Production; do not infer test-only use from the repository name. Do not deploy while that designation is unresolved.
4. Verify the API's manual deployment, operational routes and runtime logs. Keep automatic deployment off.
5. Select an isolated same-site HTTPS frontend/API origin pair, or a reviewed same-origin proxy. Match CORS_ORIGIN exactly. Do not use the hotel website or change its DNS as part of this task. Preserve HttpOnly/Secure/SameSite=Strict refresh cookies.
6. Create the free frontend with the above settings only when those dependencies are satisfied. Do not store test credentials in its assets, environment variables, URLs, logs or README.
7. Validate browser login, refresh after reload, logout, forbidden origins and roles, all eight pages, 320/375/768/1280px widths, keyboard navigation, zoom and print pagination with fictional data. Record the actual URL and deployed source commit.
8. Remove only the exact disposable fixtures created by the test run. Keep the frontend clearly marked TEST ENVIRONMENT and out of staff workflows.

## Current verification limits

Current local verification: 21 web tests pass and one live test skips by default; the enabled jsdom workflow against the real disposable local API/database passes all 22 tests. The backend suite passes 79 tests and both production builds pass. This is not a real browser, cloud CORS/cookie, physical print, or mobile-device acceptance test. Mobile sizing, touch controls, keyboard skip navigation and print styles have been improved in source. These checks do not establish cross-browser rendering, physical print output or cloud cookie/CORS behavior. Those remain deployment acceptance checks.
## Current staging status — November 8, 2026
The free Render static site `lead-connect-web-staging` is deployed at https://lead-connect-web-staging.onrender.com from main commit `8469900496180e663bf11fcb34ef5d1a81309b19`. Desktop Chrome displayed the sign-in page over HTTPS. `VITE_API_BASE` points to `https://lead-connect-api-staging.onrender.com`, but no API service exists at that URL yet. Auto-Deploy is Off. Do not use the existing Production-labeled `lead-connect-api` service.

A database URL and temporary JWT briefly appeared in an agent-visible form result. The Neon `render-test` role password was reset; the old value is revoked. Never reuse it or paste secrets into chat. The staging API creation form was not submitted. Create the new Free API service, enter a fresh pooled `DATABASE_URL` from render-test and a newly generated 48+ character `JWT_ACCESS_SECRET` directly in Render's private environment settings, and set exact `CORS_ORIGIN` to the frontend URL. The current DB credential is not available to this workspace.

Current checks: desktop page load and HTTPS confirmed; frontend 21 tests passed/1 skipped and TypeScript/production build passed; backend TypeScript/production build passed. Backend tests could not run because local disposable PostgreSQL is unavailable. Cloud login, session, CORS, property isolation, operational workflows, reports, demo fixtures, mobile/tablet, keyboard and print remain unverified. No Neon migration was repeated.

## Staging API now deployed — November 8, 2026
Render has a separate Free API service `lead-connect-api-staging` Live at https://lead-connect-api-staging.onrender.com on commit `cb9add7`; health and readiness returned success. This confirms a working DB connection to the configured test target, checked against Neon `render-test` / `leadconnect`. Auto-Deploy is Off. The current DB URL uses `sslmode=require`, which must be updated to `verify-full`. Its password appeared in an agent-visible result; reset the Neon test-branch password and privately replace `DATABASE_URL` before API workflow/login tests. No secrets belong in chat. CORS/cookies, auth, data workflows, demo data and mobile/tablet/print acceptance remain unverified.

A follow-up backend source change now enforces `sslmode=verify-full` for production runtime configuration. It is not deployed yet; the Live staging API remains on `cb9add7` pending private credential rotation, URL correction and manual deployment.

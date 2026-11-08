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

19 web tests passed, including the jsdom-to-real-local-API/database workflow. Both builds passed. Mobile sizing, touch controls, keyboard skip navigation and print styles have been improved in source. These checks do not establish cross-browser rendering, physical print output or cloud cookie/CORS behavior. Those remain deployment acceptance checks.

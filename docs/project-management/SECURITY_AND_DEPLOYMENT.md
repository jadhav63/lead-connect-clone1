# Security and deployment
No production rollout is approved. Never target Neon production, the existing housekeeping application, the hotel website, or SynXis.

Environment variable names only: DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET, NODE_ENV, NODE_VERSION, PORT, CORS_ORIGIN, ACCESS_TOKEN_TTL, REFRESH_TOKEN_DAYS. Do not record secret values or full database connection URLs.

Current test deployment: Render Free/Oregon, Node 24, runtime PORT 10000, auto-deploy off. CORS_ORIGIN remains a reserved invalid placeholder and must change before browser integration. No Render configuration changed in this verification session.

Migration: from apps/api, after npm ci and configuring ignored private .env, run node scripts/migrate-render-test.mjs --check, then node scripts/migrate-render-test.mjs. Guard accepts only independently verified test endpoints; no database or branch deletion occurs. Executor PostgreSQL access is blocked, so no cloud migration has succeeded here.

Before real hotel data: enforce tenant relationship constraints and assignee membership; use restricted runtime DB role; add shared/account rate controls; improve refresh token-family/race handling; configure same-site browser domains and trusted proxy; validate TLS, monitoring, backups and recovery. No public registration.

Frontend recommendation: a React/Vite static site on Render free hosting (https://render.com/docs/static-sites), with separately chosen same-site HTTPS custom subdomains for frontend/API. Existing main website need not be replaced. Do not relax cookie protection merely to work around unrelated test domains. Expo clients should use SecureStore (https://docs.expo.dev/versions/latest/sdk/securestore/). No services or domains have been created by this recommendation.

# Private Windows setup for the Neon test migration

No password, full connection URL or signing secret belongs in chat, GitHub or Drive.

## Minimum steps

1. With Git and Node.js 24 available, open PowerShell in your local clone:

   ```powershell
   git pull --ff-only origin main
   cd apps/api
   npm ci
   git check-ignore .env
   notepad .env
   ```

   If you do not have a clone yet, first run `git clone https://github.com/jadhav63/lead-connect-clone1.git` and `cd lead-connect-clone1`.
   `git check-ignore .env` must print `.env`. If it does not, stop before entering secrets. Do not overwrite an existing private .env; add/update only the two test variables while preserving other needed settings.

2. In the authenticated Neon console, open project **lead-connect-clone**, project ID **gentle-rice-55255812**. Select branch **render-test**, branch ID **br-polished-bread-artfes8a**. Click **Connect** and select database **leadconnect**. Use the branch's existing authorized database role; do not reset its password or use a production connection.

3. In Notepad, enter these two variable names, replacing only the placeholders privately:

   ```dotenv
   DATABASE_URL="PASTE_POOLED_RENDER_TEST_URL_PRIVATELY_HERE"
   DIRECT_URL="PASTE_DIRECT_RENDER_TEST_URL_PRIVATELY_HERE"
   ```

   With **Connection pooling on**, copy only the connection URL into DATABASE_URL. With **Connection pooling off**, copy only the URL into DIRECT_URL. If Neon requires revealing the existing test password for copying, do it privately on your computer. Do not copy a `psql` command, shell wrapper or production URL. Retain URL-encoded password characters exactly as Neon provides them.

   Verify these non-secret details before saving:

   | Variable | Exact permitted hostname |
   | --- | --- |
   | DATABASE_URL | ep-old-truth-aror3gey-pooler.c-4.us-west-2.aws.neon.tech |
   | DIRECT_URL | ep-old-truth-aror3gey.c-4.us-west-2.aws.neon.tech |

   Both must use PostgreSQL, database `/leadconnect`, default/explicit `public` schema and required TLS (`sslmode=require`, `verify-ca` or `verify-full`; prefer `verify-full` for explicit certificate/hostname verification). Keep Neon's `channel_binding=require` if present. Do not add connection override parameters. If the console endpoints differ, stop for independent review; do not edit the guard to make them pass.

4. Save as the exact filename **.env**, not **.env.txt**, in **apps/api**. Keep it on your own computer outside cloud-synced project folders. Close Notepad. Never run `Get-Content .env`, `type .env`, or paste it into chat. Database migration needs only DATABASE_URL and DIRECT_URL; do not copy bootstrap settings, JWT keys or production secrets from another app.

5. Run:

   ```powershell
   node scripts/migrate-render-test.mjs --check
   ```

   Continue only if it confirms render-test/leadconnect and no application rows. The guard also verifies the actual connected database, schema and negotiated TLS before inspecting rows or applying migrations. If it fails, stop; share only its fixed safe error message if help is needed.

6. After preflight passes, run:

   ```powershell
   node scripts/migrate-render-test.mjs
   ```

   The guarded runner performs Prisma validation, deploy, status, drift and named catalog checks. Expected result: **14 models / 11 enums / 41 indexes / 34 foreign keys**. Share only success/counts or the fixed safe error, never raw connection diagnostics or credentials. Do not use console SQL to bypass this process.

## Current access limitation

The connected browser can access the authorized Neon test console and verify branch/database/endpoint/TLS metadata while passwords stay masked. This execution workspace has neither private variable, no local .env, and no supported secure secret-transfer mechanism from that browser session. No secret was revealed or transferred. Running this procedure on your computer resolves the missing-credentials step without sending secrets through chat. It does not put credentials into this separate workspace; further cloud work here requires an approved private secret facility or continued testing on your computer.

## After migration

Do not redeploy Render yet. Verify that lead-connect-api is test-only despite its Production environment label, inspect its database target privately, verify actual traffic and compatibility, and keep auto-deploy Off. Full cloud disposable-account workflow tests and frontend browser/cookie/CORS checks remain outstanding.

#!/usr/bin/env bash
# Creates and destroys its own LOCAL cluster. Never reads a cloud DATABASE_URL.
set -euo pipefail
: "${PG_BIN:?Set the directory containing local PostgreSQL initdb/postgres/psql/pg_dump}"
root="$(cd "$(dirname "$0")/.." && pwd)"
task_dir="$(mktemp -d /tmp/lead-connect-release-XXXXXX)"
task_fixture_file="$task_dir/fixture.json"
task_pg_pid=''
task_api_pid=''
task_restore_api_pid=''
cleanup() {
  if [[ -n "$task_restore_api_pid" ]]; then kill -TERM "$task_restore_api_pid" 2>/dev/null || true; wait "$task_restore_api_pid" 2>/dev/null || true; fi
  if [[ -n "$task_api_pid" ]]; then kill -TERM "$task_api_pid" 2>/dev/null || true; wait "$task_api_pid" 2>/dev/null || true; fi
  if [[ -n "$task_pg_pid" ]]; then kill -TERM "$task_pg_pid" 2>/dev/null || true; wait "$task_pg_pid" 2>/dev/null || true; fi
  rm -rf "$task_dir"
}
trap cleanup EXIT
"$PG_BIN/initdb" -D "$task_dir/data" -A trust -U localtest --encoding=UTF8 --no-locale > "$task_dir/init.log"
"$PG_BIN/postgres" -D "$task_dir/data" -h 127.0.0.1 -p 55432 -c "unix_socket_directories=" > "$task_dir/postgres.log" 2>&1 &
task_pg_pid=$!
for n in {1..40}; do if "$PG_BIN/pg_isready" -h 127.0.0.1 -p 55432 -U localtest >/dev/null; then break; fi; sleep 0.25; done
"$PG_BIN/createdb" -h 127.0.0.1 -p 55432 -U localtest leadconnect_test
export DATABASE_URL='postgresql://localtest:local-only@127.0.0.1:55432/leadconnect_test'
export NODE_ENV=development APP_ENV=local CORS_ORIGIN='http://127.0.0.1:38507' PORT=38507
export JWT_ACCESS_SECRET="$(node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("hex"))')"
unset DIRECT_URL
cd "$root/apps/api"
node --input-type=module -e 'import {assertTestDatabase} from "./scripts/test-database.mjs";assertTestDatabase(process.env.DATABASE_URL)'
npx prisma migrate deploy
npm run build
npm test
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
cd "$root/apps/web"
npm test
VITE_APP_ENV=production VITE_API_BASE= npm run build
cd "$root/apps/api"
export LOCAL_UI_FIXTURE_FILE="$task_fixture_file"
node scripts/local-web-fixture.mjs
WEB_DIST_PATH='../web/dist' node dist/server.js > "$task_dir/api.log" 2>&1 &
task_api_pid=$!
for n in {1..60}; do if curl -fsS 'http://127.0.0.1:38507/api/ready' > /dev/null 2>&1; then break; fi; sleep 0.25; done
curl -fsS 'http://127.0.0.1:38507/api/ready'
cd "$root/apps/web"
browser_status=0
npx playwright test || browser_status=$?
cd "$root/apps/api"
# A real logical backup/restore drill of local synthetic application records.
"$PG_BIN/pg_dump" -h 127.0.0.1 -p 55432 -U localtest -d leadconnect_test -Fc --no-owner --no-acl -f "$task_dir/restore.dump"
: "${AGE_BIN:?Set age binary for the encrypted restore drill}"
: "${AGE_KEYGEN_BIN:?Set age-keygen binary for the disposable encryption key}"
"$AGE_KEYGEN_BIN" -o "$task_dir/backup.key" 2> "$task_dir/age.log"
recipient="$("$AGE_KEYGEN_BIN" -y "$task_dir/backup.key")"
"$AGE_BIN" -r "$recipient" -o "$task_dir/encrypted.dump.age" "$task_dir/restore.dump"
"$AGE_BIN" -d -i "$task_dir/backup.key" -o "$task_dir/decrypted.dump" "$task_dir/encrypted.dump.age"
cmp "$task_dir/restore.dump" "$task_dir/decrypted.dump"
echo 'Backup encryption and decryption round trip verified.'
"$PG_BIN/createdb" -h 127.0.0.1 -p 55432 -U localtest leadconnect_restore_test
"$PG_BIN/pg_restore" -h 127.0.0.1 -p 55432 -U localtest -d leadconnect_restore_test --no-owner --no-acl --exit-on-error "$task_dir/decrypted.dump"
sql='SELECT (SELECT count(*) FROM rooms),(SELECT count(*) FROM users),(SELECT count(*) FROM cleaning_tasks),(SELECT count(*) FROM audit_logs),(SELECT count(*) FROM _prisma_migrations);'
source_counts="$("$PG_BIN/psql" -h 127.0.0.1 -p 55432 -U localtest -d leadconnect_test -At -c "$sql")"
restore_counts="$("$PG_BIN/psql" -h 127.0.0.1 -p 55432 -U localtest -d leadconnect_restore_test -At -c "$sql")"
[[ "$source_counts" == "$restore_counts" ]] || { echo 'Restore verification failed'; exit 1; }
echo 'Local backup/restore row counts and migration records match.'
DATABASE_URL='postgresql://localtest:local-only@127.0.0.1:55432/leadconnect_restore_test' CORS_ORIGIN='http://127.0.0.1:36559' PORT=36559 WEB_DIST_PATH='../web/dist' node dist/server.js > "$task_dir/recovery-api.log" 2>&1 &
task_restore_api_pid=$!
for n in {1..40}; do if curl -fsS http://127.0.0.1:36559/api/ready > /dev/null 2>&1; then break; fi; sleep 0.25; done
node --input-type=module <<'NODE'
import {readFileSync} from 'node:fs';
const f=JSON.parse(readFileSync(process.env.LOCAL_UI_FIXTURE_FILE,'utf8'));
const login=await fetch('http://127.0.0.1:36559/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:f.frontDeskEmail,password:f.frontDeskPassword,propertyCode:f.code})});
if(login.status!==200)throw new Error('Restored application login failed');
const token=(await login.json()).accessToken;
const me=await fetch('http://127.0.0.1:36559/api/auth/me',{headers:{authorization:'Bearer '+token}});
const identity=await me.json();
if(me.status!==200||identity.propertyId!==f.propertyId||!identity.roles.includes('FRONT_DESK'))throw new Error('Restored account authorization failed');
console.log('Application login and property authorization verified on restored local database.');
NODE
kill -TERM "$task_restore_api_pid"; wait "$task_restore_api_pid" || true; task_restore_api_pid=''

# Verify production grant constraints on a separate LOCAL synthetic database.
"$PG_BIN/createdb" -h 127.0.0.1 -p 55432 -U localtest leadconnect_production
"$PG_BIN/pg_restore" -h 127.0.0.1 -p 55432 -U localtest -d leadconnect_production --no-owner --no-acl --exit-on-error "$task_dir/decrypted.dump"
"$PG_BIN/psql" -h 127.0.0.1 -p 55432 -U localtest -d leadconnect_production -v ON_ERROR_STOP=1 -c 'CREATE ROLE leadconnect_app NOLOGIN; CREATE ROLE leadconnect_backup NOLOGIN;' > /dev/null
"$PG_BIN/psql" -h 127.0.0.1 -p 55432 -U localtest -d leadconnect_production -v ON_ERROR_STOP=1 -f "$root/deploy/production/database-role-grants.sql" > /dev/null
permissions="$("$PG_BIN/psql" -h 127.0.0.1 -p 55432 -U localtest -d leadconnect_production -At -c "SELECT has_schema_privilege('leadconnect_app','public','CREATE'),has_table_privilege('leadconnect_app','audit_logs','DELETE'),has_table_privilege('leadconnect_app','audit_logs','UPDATE'),has_table_privilege('leadconnect_app','rooms','INSERT'),has_table_privilege('leadconnect_backup','rooms','SELECT');")"
[[ "$permissions" == 'f|f|f|t|t' ]] || { echo 'Production privilege verification failed'; exit 1; }
echo 'Local production-role privileges verified: no DDL or audit modification.'

node scripts/local-web-fixture.mjs --cleanup
if [[ "$browser_status" != 0 ]]; then echo 'Browser acceptance gate failed; other verification completed.'; exit "$browser_status"; fi
echo 'Release checks passed; disposable credentials and databases removed.' 

#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${PGSERVICEFILE:?Use a protected pg_service.conf file}"
: "${PGPASSFILE:?Use a protected pgpass file}"
: "${BACKUP_RECIPIENT:?Set an age public recipient}"
: "${BACKUP_DIR:?Set the approved encrypted backup destination}"
: "${EXPECTED_PRODUCTION_DIRECT_HOST:?Set the independently verified NEW production direct host}"
[[ "$EXPECTED_PRODUCTION_DIRECT_HOST" == *.neon.tech && "$EXPECTED_PRODUCTION_DIRECT_HOST" != *-pooler.* && "$EXPECTED_PRODUCTION_DIRECT_HOST" != *ep-old-truth-aror3gey* ]] || { echo 'Unexpected backup endpoint'; exit 1; }
connection="service=leadconnect-production-backup host=$EXPECTED_PRODUCTION_DIRECT_HOST dbname=leadconnect_production sslmode=verify-full channel_binding=require"
export PGSERVICE=leadconnect-production-backup
command -v age >/dev/null
command -v pg_dump >/dev/null
pg_dump --version | grep -Eq 'PostgreSQL\) (18|19|2[0-9])\.' || { echo 'Use PostgreSQL 18+ backup tools'; exit 1; }
[[ "$(psql --dbname="$connection" -X -At -c "SELECT current_database() || '|' || current_user")" == 'leadconnect_production|leadconnect_backup' ]] || { echo 'Unexpected backup database'; exit 1; }
mkdir -p "$BACKUP_DIR"
target="$BACKUP_DIR/leadconnect-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
temporary="${target}.partial"
trap 'rm -f "$temporary"' EXIT
pg_dump --dbname="$connection" --format=custom --no-owner --no-acl | age --recipient "$BACKUP_RECIPIENT" > "$temporary"
test -s "$temporary"
mv "$temporary" "$target"
sha256sum "$target" > "${target}.sha256"
echo 'Encrypted backup completed; verify upload and retention separately.'

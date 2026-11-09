[CmdletBinding()]
param([switch]$Activate,[string]$ApprovalReference,[string]$Archive,[string]$TargetHost,[string]$TargetDatabase,[string]$TargetUser,[string]$ConnectionSecretFile,[string]$PgRestore='C:\Program Files\PostgreSQL\18\bin\pg_restore.exe',[string]$Psql='C:\Program Files\PostgreSQL\18\bin\psql.exe')
$ErrorActionPreference='Stop'
if(-not $Activate -or $ApprovalReference -notmatch '^JD-APPROVED-[A-Z0-9-]{6,}$'){throw 'Restore inactive: explicit approval required.'}
if($TargetDatabase -notmatch '^leadconnect_restore_[a-z0-9_]+$' -or $TargetDatabase -in @('leadconnect_production','leadconnect','leadconnect_test')){throw 'Destination database name is prohibited.'}
if($TargetHost -notmatch '^ep-[a-z0-9-]+\.c-[0-9]+\.[a-z0-9-]+\.aws\.neon\.tech$' -or $TargetHost -match 'old-truth|pooler|staging|production' -or $TargetUser -notmatch '^restore_[a-z0-9_]+$'){throw 'Destination host/user is not an explicitly isolated restore target.'}
if(-not(Test-Path $Archive) -or -not(Test-Path $ConnectionSecretFile) -or -not(Test-Path $PgRestore) -or -not(Test-Path $Psql)){throw 'Required archive, DPAPI credential, or PostgreSQL client tool missing.'}
# Independently query current_database/current_user before any restore. Restore never creates the database.
throw 'Live DB connections and restore are disabled in preparation; test this path on an approved fictional isolated PostgreSQL target before enabling.'

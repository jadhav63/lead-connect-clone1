[CmdletBinding(SupportsShouldProcess)]
param(
 [switch]$Activate,[string]$ApprovalReference,[Parameter(Mandatory)][string]$Archive,
 [Parameter(Mandatory)][string]$TargetDatabase,[string]$TargetHost='127.0.0.1',
 [string]$TargetPort='5432',[string]$TargetUser='restore_test',
 [Parameter(Mandatory)][string]$EncryptedKeyFile,[Parameter(Mandatory)][string]$DpapiPasswordFile,
 [Parameter(Mandatory)][string]$PgRestore,[Parameter(Mandatory)][string]$Psql,
 [string]$Node=(Get-Command node.exe -ErrorAction SilentlyContinue).Source
)
Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';$workDir=Join-Path $env:TEMP ('lc-restore-'+[guid]::NewGuid().ToString('N'));$tmp=Join-Path $workDir 'authenticated-restore.dump';$keyTmp=Join-Path $workDir 'recovery.key';$passTmp=Join-Path $workDir 'restore.pgpass'
function Fail($message){throw $message}
try {
 if(-not $Activate -or $ApprovalReference -notmatch '^JD-APPROVED-[A-Z0-9-]{6,}$'){Fail 'Restore disabled; explicit approval reference required.'}
 if($TargetHost -notin @('127.0.0.1','localhost','::1')){Fail 'Restore target must be loopback-only.'}
 if($TargetDatabase -notmatch '^leadconnect_restore_test_[a-z0-9_]{6,40}$' -or $TargetDatabase -match 'prod|stag|render|leadconnect$'){Fail 'Destination name must be a unique isolated fictional restore database.'}
 if($TargetUser -ne 'restore_test' -or $TargetPort -ne '5432'){Fail 'Only the dedicated local restore_test role and port 5432 are permitted.'}
 if([IO.Path]::GetFullPath($EncryptedKeyFile) -eq [IO.Path]::GetFullPath($DpapiPasswordFile)){Fail 'Recovery key and database password must use separate protected files.'}
 foreach($x in @($Archive,$EncryptedKeyFile,$DpapiPasswordFile,$PgRestore,$Psql,$Node)){if(-not $x -or -not(Test-Path $x)){Fail 'Required archive or approved local tool/key file is missing.'}}
 if(-not $PSCmdlet.ShouldProcess("$TargetHost/$TargetDatabase",'Decrypt to protected temporary file and restore into verified empty isolated local database')){return}
 # Create a user-only work directory before writing any key, password, or plaintext archive.
 New-Item -ItemType Directory -Path $workDir -ErrorAction Stop|Out-Null
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $acl=New-Object Security.AccessControl.DirectorySecurity;$acl.SetAccessRuleProtection($true,$false)
 foreach($principal in @($sid,'S-1-5-18','S-1-5-32-544')){$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule([Security.Principal.SecurityIdentifier]$principal,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))}
 Set-Acl -LiteralPath $workDir -AclObject $acl
 $keySecure=ConvertTo-SecureString (Get-Content -Raw $EncryptedKeyFile) -ErrorAction Stop
 $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($keySecure);try{$keyText=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b);$key=[Convert]::FromBase64String($keyText)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b);$keyText=$null}
 if($key.Length -ne 32){Fail 'Invalid recovery key.'};[IO.File]::WriteAllBytes($keyTmp,$key);[Array]::Clear($key,0,$key.Length)
 # The separately DPAPI-protected database password remains distinct from the recovery key.
 $passSecure=ConvertTo-SecureString (Get-Content -Raw $DpapiPasswordFile) -ErrorAction Stop;$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($passSecure);try{$pw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}
 $escapedPw=$pw.Replace('\','\\').Replace(':','\:');[IO.File]::WriteAllText($passTmp,"$TargetHost`:$TargetPort`:$TargetDatabase`:$TargetUser`:$escapedPw",[Text.Encoding]::ASCII);$pw=$null;$escapedPw=$null;$env:PGPASSFILE=$passTmp;$env:PGSSLMODE='disable'
 $identity=& $Psql -X -w -h $TargetHost -p $TargetPort -U $TargetUser -d $TargetDatabase -At -v ON_ERROR_STOP=1 -c "SELECT current_database()||'|'||current_user||'|'||(SELECT count(*) FROM pg_class WHERE relkind='r' AND relnamespace NOT IN (SELECT oid FROM pg_namespace WHERE nspname LIKE 'pg_%' OR nspname='information_schema'))" 2>$null
 if($LASTEXITCODE -ne 0 -or $identity -notmatch "^$([regex]::Escape($TargetDatabase))\|restore_test\|0$"){Fail 'Independent destination identity check failed or destination is not empty.'}
 & $Node (Join-Path $PSScriptRoot 'crypto-cli.mjs') decrypt $Archive $tmp $keyTmp *> $null;if($LASTEXITCODE -ne 0 -or -not(Test-Path $tmp)){Fail 'Archive authentication/decryption failed.'}
 & $PgRestore --exit-on-error --no-owner --no-acl --single-transaction --host=$TargetHost --port=$TargetPort --username=$TargetUser --dbname=$TargetDatabase $tmp *> $null;if($LASTEXITCODE -ne 0){Fail 'pg_restore failed; isolated test database may be partially restored.'}
 'Isolated fictional restore completed; record duration and validate application separately.'
} catch {throw 'Restore test stopped safely. Review non-secret local status; no live target is permitted.'}
finally {Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue;Remove-Item Env:PGPASSFILE,Env:PGSSLMODE -ErrorAction SilentlyContinue}

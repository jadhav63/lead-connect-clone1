[CmdletBinding(SupportsShouldProcess)]
param(
 [switch]$Activate,[string]$ApprovalReference,[Parameter(Mandatory)][string]$Archive,
 [Parameter(Mandatory)][string]$TargetDatabase,[string]$TargetHost='127.0.0.1',
 [string]$TargetPort='5432',[string]$TargetUser='restore_test',
 [Parameter(Mandatory)][string]$EncryptedKeyFile,[Parameter(Mandatory)][string]$DpapiPasswordFile,
 [Parameter(Mandatory)][string]$PgRestore,[Parameter(Mandatory)][string]$Psql,
 [string]$Node=(Get-Command node.exe -ErrorAction SilentlyContinue).Source
)
Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';$tmp=Join-Path $env:TEMP ('lc-restore-'+[guid]::NewGuid().ToString('N'));$keyTmp=Join-Path $env:TEMP ('lc-key-'+[guid]::NewGuid().ToString('N'));$passTmp=Join-Path $env:TEMP ('lc-pass-'+[guid]::NewGuid().ToString('N'))
function Fail($message){throw $message}
try {
 if(-not $Activate -or $ApprovalReference -notmatch '^JD-APPROVED-[A-Z0-9-]{6,}$'){Fail 'Restore disabled; explicit approval reference required.'}
 if($TargetHost -notin @('127.0.0.1','localhost','::1')){Fail 'Restore target must be loopback-only.'}
 if($TargetDatabase -notmatch '^leadconnect_restore_test_[a-z0-9_]{6,40}$' -or $TargetDatabase -match 'prod|stag|render|leadconnect$'){Fail 'Destination name must be a unique isolated fictional restore database.'}
 if($TargetUser -ne 'restore_test' -or $TargetPort -ne '5432'){Fail 'Only the dedicated local restore_test role and port 5432 are permitted.'}
 foreach($x in @($Archive,$EncryptedKeyFile,$DpapiPasswordFile,$PgRestore,$Psql,$Node)){if(-not $x -or -not(Test-Path $x)){Fail 'Required archive or approved local tool/key file is missing.'}}
 if(-not $PSCmdlet.ShouldProcess("$TargetHost/$TargetDatabase",'Decrypt to protected temporary file and restore into verified empty isolated local database')){return}
 $secure=ConvertTo-SecureString (Get-Content -Raw $DpapiPasswordFile);$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);try{$secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}
 $keySecure=ConvertTo-SecureString $secret;$secret=$null;$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($keySecure);try{$keyText=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b);$key=[Convert]::FromBase64String($keyText)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b);$keyText=$null}
 if($key.Length -ne 32){Fail 'Invalid recovery key.'};[IO.File]::WriteAllBytes($keyTmp,$key);[Array]::Clear($key,0,$key.Length)
 $acl=New-Object Security.AccessControl.FileSecurity;$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule([Security.Principal.WindowsIdentity]::GetCurrent().User,'FullControl','Allow')));Set-Acl $keyTmp $acl
 # Pgpass exists only in restricted TEMP; independently validate identity and require an empty existing DB.
 $passSecure=ConvertTo-SecureString (Get-Content -Raw $DpapiPasswordFile);$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($passSecure);try{$pw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}
 [IO.File]::WriteAllText($passTmp,"$TargetHost`:$TargetPort`:$TargetDatabase`:$TargetUser`:$pw",[Text.Encoding]::ASCII);$pw=$null;Set-Acl $passTmp $acl;$env:PGPASSFILE=$passTmp;$env:PGSSLMODE='disable'
 $identity=& $Psql -X -w -h $TargetHost -p $TargetPort -U $TargetUser -d $TargetDatabase -At -v ON_ERROR_STOP=1 -c "SELECT current_database()||'|'||current_user||'|'||(SELECT count(*) FROM pg_class WHERE relkind='r' AND relnamespace NOT IN (SELECT oid FROM pg_namespace WHERE nspname LIKE 'pg_%' OR nspname='information_schema'))" 2>$null
 if($LASTEXITCODE -ne 0 -or $identity -notmatch "^$([regex]::Escape($TargetDatabase))\|restore_test\|0$"){Fail 'Independent destination identity check failed or destination is not empty.'}
 & $Node (Join-Path $PSScriptRoot 'crypto-cli.mjs') decrypt $Archive $tmp $keyTmp *> $null;if($LASTEXITCODE -ne 0 -or -not(Test-Path $tmp)){Fail 'Archive authentication/decryption failed.'}
 & $PgRestore --exit-on-error --no-owner --no-acl --single-transaction --host=$TargetHost --port=$TargetPort --username=$TargetUser --dbname=$TargetDatabase $tmp *> $null;if($LASTEXITCODE -ne 0){Fail 'pg_restore failed; isolated test database may be partially restored.'}
 'Isolated fictional restore completed; record duration and validate application separately.'
} catch {throw 'Restore test stopped safely. Review non-secret local status; no live target is permitted.'}
finally {Remove-Item $tmp,$keyTmp,$passTmp -Force -ErrorAction SilentlyContinue;Remove-Item Env:PGPASSFILE,Env:PGSSLMODE -ErrorAction SilentlyContinue}

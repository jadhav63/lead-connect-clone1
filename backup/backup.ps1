[CmdletBinding()]
param([switch]$Activate,[string]$ApprovalReference)
Set-StrictMode -Version Latest; $ErrorActionPreference='Stop'
$root='C:\HotelBackups\LeadConnect'; $cfgPath=Join-Path $PSScriptRoot 'config.json'
$log=Join-Path $root 'logs'; $runId=[guid]::NewGuid().ToString('N'); $plain=$null; $pgpass=$null
function Log($event,$status){$line=[ordered]@{time=(Get-Date).ToUniversalTime().ToString('o');runId=$runId;event=$event;status=$status}|ConvertTo-Json -Compress;Add-Content -LiteralPath (Join-Path $log 'backup.jsonl') -Value $line}
try {
 if(-not $Activate -or $ApprovalReference -notmatch '^JD-APPROVED-[A-Z0-9-]{6,}$'){throw 'Inactive by default. Supply -Activate and an approved reference only after the checklist is signed.'}
 if(-not(Test-Path $cfgPath)){throw 'Private config.json is missing.'}; New-Item -ItemType Directory -Force $log|Out-Null
 $cfg=Get-Content -Raw $cfgPath|ConvertFrom-Json
 if($cfg.activationRequired -ne $false -or $cfg.propertyCode -ne '58835' -or $cfg.database.name -ne 'leadconnect_production' -or $cfg.database.user -ne 'leadconnect_backup' -or $cfg.database.schema -ne 'public' -or $cfg.database.sslmode -ne 'verify-full' -or $cfg.database.channel_binding -ne 'require' -or $cfg.database.host -notmatch '^ep-[a-z0-9-]+\.c-[0-9]+\.[a-z0-9-]+\.aws\.neon\.tech$' -or $cfg.database.host -match 'old-truth|pooler' -or $cfg.paths.driveRemote -notmatch ':Production_Database$'){throw 'Production identity/target validation failed.'}
 $pgdump=$cfg.paths.pgDump;$rclone=$cfg.paths.rclone;$aesKeyFile=$cfg.paths.encryptedAesKeyFile
 foreach($p in @($pgdump,$rclone,$cfg.paths.encryptedCredentialFile,$aesKeyFile)){if(-not(Test-Path $p)){throw 'Required approved tool/key file is missing.'}}
 $disk=Get-PSDrive -Name ([IO.Path]::GetPathRoot($root).TrimEnd(':\'));if($disk.Free -lt 5GB){throw 'Less than 5 GB free; refusing export.'}
 New-Item -ItemType Directory -Force $root,$log,(Join-Path $root 'work'),(Join-Path $root 'archives')|Out-Null
 $stamp=Get-Date -Format 'yyyyMMdd-HHmmss';$plain=Join-Path $root "work\$runId.dump";$pgpass=Join-Path $root "work\$runId.pgpass";$archive=Join-Path $root "archives\TGH-$stamp-$runId.dump.aesgcm"
 # Credential file is DPAPI-protected for the scheduled-task identity; decrypt only in memory, then ACL a short-lived pgpass file.
 $cred=ConvertTo-SecureString (Get-Content -Raw $cfg.paths.encryptedCredentialFile) -ErrorAction Stop
 $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred);try{$pw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}
 $entry="$($cfg.database.host):$($cfg.database.port):$($cfg.database.name):$($cfg.database.user):$pw";[IO.File]::WriteAllText($pgpass,$entry,[Text.Encoding]::UTF8);$pw=$null;$entry=$null
 $acl=New-Object Security.AccessControl.FileSecurity;$acl.SetAccessRuleProtection($true,$false);$rule=New-Object Security.AccessControl.FileSystemAccessRule([Security.Principal.WindowsIdentity]::GetCurrent().User,'FullControl','Allow');$acl.AddAccessRule($rule);Set-Acl -LiteralPath $pgpass -AclObject $acl
 $env:PGPASSFILE=$pgpass;$env:PGSSLMODE='verify-full';$env:PGCHANNELBINDING='require'
 # Check server identity with psql before export. Never print query output other than validated safe identity.
 $psql=[IO.Path]::Combine([IO.Path]::GetDirectoryName($pgdump),'psql.exe');if(-not(Test-Path $psql)){throw 'Matching PostgreSQL psql.exe is required for identity verification.'}
 $identity=& $psql -X -w -h $cfg.database.host -p $cfg.database.port -U $cfg.database.user -d $cfg.database.name -v ON_ERROR_STOP=1 -Atc "SELECT current_database()||'|'||current_user||'|'||inet_server_addr()" 2>$null;if($LASTEXITCODE -ne 0 -or $identity -notmatch '^leadconnect_production\|leadconnect_backup\|'){throw 'Production database identity verification failed.'}
 Log 'identity_verified' 'ok'
 & $pgdump --no-password --format=custom --no-owner --no-acl --verbose --host=$cfg.database.host --port=$cfg.database.port --username=$cfg.database.user --dbname=$cfg.database.name --file=$plain 2>$null
 if($LASTEXITCODE -ne 0 -or -not(Test-Path $plain) -or (Get-Item $plain).Length -lt 1024){throw 'pg_dump failed or produced an implausibly small archive.'}
 & $pgdump --list $plain *> $null;if($LASTEXITCODE -ne 0){throw 'pg_dump archive validation failed.'}
 $keySecure=ConvertTo-SecureString (Get-Content -Raw $aesKeyFile) -ErrorAction Stop
 $kb=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($keySecure);try{$keyText=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($kb);$key=[Convert]::FromBase64String($keyText)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($kb);$keyText=$null}
 if($key.Length -ne 32){throw 'AES key length invalid.'};$nonce=[byte[]]::new(12);[Security.Cryptography.RandomNumberGenerator]::Fill($nonce);$tag=[byte[]]::new(16);$input=[IO.File]::ReadAllBytes($plain);$cipher=[byte[]]::new($input.Length);$aes=[Security.Cryptography.AesGcm]::new($key,16)
 try{$aes.Encrypt($nonce,$input,$cipher,$tag,[Text.Encoding]::UTF8.GetBytes('LeadConnectBackup-v1'))}finally{$aes.Dispose();[Array]::Clear($input,0,$input.Length);[Array]::Clear($key,0,$key.Length)}
 $stream=[IO.File]::Open($archive,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$stream.Write([Text.Encoding]::ASCII.GetBytes('LCBAK1'));$stream.Write($nonce);$stream.Write($tag);$stream.Write($cipher);$stream.Flush($true)}finally{$stream.Dispose();[Array]::Clear($cipher,0,$cipher.Length)}
 $hash=(Get-FileHash -Algorithm SHA256 $archive).Hash
 & $rclone copyto $archive ("$($cfg.paths.driveRemote)/"+[IO.Path]::GetFileName($archive)) --immutable --log-level ERROR 2>$null;if($LASTEXITCODE -ne 0){throw 'Google Drive upload failed.'}
 & $rclone check $archive $cfg.paths.driveRemote --download --one-way --log-level ERROR 2>$null;if($LASTEXITCODE -ne 0){throw 'Remote byte-for-byte verification failed.'}
 Log "backup_uploaded_sha256_$hash" 'ok'
} catch { if(Test-Path $log){Log 'backup_failed' 'error'};throw 'Backup failed. Check the private event log using the run ID; sensitive details were suppressed.' }
finally {if($plain -and(Test-Path $plain)){Remove-Item -Force $plain};if($pgpass -and(Test-Path $pgpass)){Remove-Item -Force $pgpass};Remove-Item Env:PGPASSFILE,Env:PGSSLMODE,Env:PGCHANNELBINDING -ErrorAction SilentlyContinue}

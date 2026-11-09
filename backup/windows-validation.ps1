[CmdletBinding()]
param([string]$ResultPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$results = [Collections.Generic.List[object]]::new()
function Add-Result([string]$Name, [ValidateSet('PASS','FAIL','WARNING','BLOCKED')][string]$Status, [string]$Explanation, [string]$Action) {
    $results.Add([pscustomobject]@{ check=$Name; status=$Status; explanation=$Explanation; recommendedAction=$Action })
}
function Get-CommandPath([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    return $null
}

$isWindows = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
$osVersion = [Environment]::OSVersion.Version.ToString()
$architecture = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
if ($isWindows -and [Environment]::OSVersion.Version.Major -ge 10 -and $architecture -eq 'X64') { Add-Result 'Windows version and architecture' 'PASS' "Windows $osVersion; $architecture" 'No action required.' }
elseif ($isWindows -and [Environment]::OSVersion.Version.Major -lt 10) { Add-Result 'Windows version and architecture' 'FAIL' "Windows $osVersion is below the Windows 10 / current supported Server baseline; $architecture." 'Use a currently supported 64-bit Windows host.' }
elseif ($isWindows) { Add-Result 'Windows version and architecture' 'FAIL' "Windows $osVersion; unsupported architecture $architecture (64-bit required)." 'Use a supported 64-bit Windows host.' }
else { Add-Result 'Windows version and architecture' 'BLOCKED' "This host is not Windows ($osVersion; $architecture)." 'Run this validation on the intended Windows computer.' }

$psVersion = $PSVersionTable.PSVersion.ToString()
if ($PSVersionTable.PSVersion -ge [version]'7.4') { Add-Result 'PowerShell version' 'PASS' "PowerShell $psVersion" 'No action required.' }
elseif ($isWindows) { Add-Result 'PowerShell version' 'FAIL' "PowerShell $psVersion; 7.4 or later is required." 'Use an already installed supported PowerShell 7.4+ session; do not install it without separate approval.' }
else { Add-Result 'PowerShell version' 'BLOCKED' "PowerShell $psVersion was inspected, but Windows compatibility is not available here." 'Repeat on Windows PowerShell 7.4 or later.' }

$node = Get-CommandPath 'node.exe'
if (-not $node) { $node = Get-CommandPath 'node' }
if ($node) {
    $nodeVersion = (& $node --version 2>$null | Select-Object -First 1)
    if ($nodeVersion -match '^v(22|24)\.') { Add-Result 'Node.js version' 'PASS' $nodeVersion 'No action required.' }
    else { Add-Result 'Node.js version' 'FAIL' "Found $nodeVersion; supported versions are Node.js 22 or 24." 'Use an already installed Node.js 22 or 24 runtime; do not install without separate approval.' }
} else { Add-Result 'Node.js version' 'FAIL' 'Node.js was not found on PATH.' 'Use an already installed Node.js 22 or 24 runtime; do not install without separate approval.' }

$pgCommands = @('pg_dump.exe','pg_restore.exe','psql.exe')
$pgPaths = @{}; $pgVersions = @(); $pgMissing = @()
foreach ($name in $pgCommands) {
    $path = Get-CommandPath $name
    if (-not $path) { $pgMissing += $name; continue }
    $pgPaths[$name] = $path
    $version = (& $path --version 2>$null | Select-Object -First 1)
    $pgVersions += "$name`: $version"
}
if ($pgMissing.Count) { Add-Result 'PostgreSQL client version' 'FAIL' "Missing client utility: $($pgMissing -join ', ')." 'Use a matching, already installed PostgreSQL 18 client bundle containing pg_dump, pg_restore, and psql.' }
elseif (($pgVersions | Where-Object { $_ -notmatch ' 18\.' }).Count) { Add-Result 'PostgreSQL client version' 'FAIL' ($pgVersions -join '; ') 'Use matching PostgreSQL 18 client utilities; do not install without separate approval.' }
elseif (@($pgVersions | ForEach-Object { ($_ -split ': ',2)[1] } | Select-Object -Unique).Count -gt 1) { Add-Result 'PostgreSQL client version' 'WARNING' ($pgVersions -join '; ') 'Use utilities from the same PostgreSQL 18 installation.' }
else { Add-Result 'PostgreSQL client version' 'PASS' ($pgVersions -join '; ') 'No action required.' }

if ($isWindows) {
    try {
        $driveName = $env:SystemDrive.TrimEnd(':')
        $drive = Get-PSDrive -Name $driveName -ErrorAction Stop
        $free = [math]::Round($drive.Free / 1GB, 2)
        if ($drive.Free -ge 5GB) { Add-Result 'Available disk space' 'PASS' "$free GB free on $env:SystemDrive; minimum 5 GB." 'No action required.' }
        else { Add-Result 'Available disk space' 'FAIL' "$free GB free on $env:SystemDrive; minimum 5 GB." 'Free disk space before running validation or any future backup.' }
    } catch { Add-Result 'Available disk space' 'FAIL' 'Could not read free space on the Windows system drive.' 'Check the system drive using the read-only command in WINDOWS_VALIDATION_GUIDE.md.' }
} else { Add-Result 'Available disk space' 'BLOCKED' 'Windows system-drive space was not checked on this non-Windows host.' 'Run on Windows; review free space with Get-PSDrive.' }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ('lc-validation-' + [guid]::NewGuid().ToString('N'))
try {
    if (-not $isWindows) {
        Add-Result 'NTFS permissions' 'BLOCKED' 'NTFS ACL behavior cannot be assessed on this host.' 'Run under the intended Windows service identity and inspect its TEMP directory ACL.'
        Add-Result 'DPAPI compatibility' 'BLOCKED' 'Windows DPAPI is unavailable on this host.' 'Validate CurrentUser DPAPI under the intended Windows service identity; a different account cannot decrypt its protected values.'
        Add-Result 'Task Scheduler XML and Arizona zone' 'BLOCKED' 'Windows Task Scheduler and the Windows Arizona time-zone database are unavailable.' 'Run the launcher on Windows and confirm the host uses US Mountain Standard Time.'
        Add-Result 'Synthetic AES-256-GCM, tamper, wrong-key, and cleanup' 'BLOCKED' 'Windows-side crypto CLI execution was not attempted on this host.' 'Run on Windows with the supported Node.js runtime; only fictional bytes are used.'
    } else {
        New-Item -ItemType Directory -Path $tmp -ErrorAction Stop | Out-Null
        $acl = Get-Acl -LiteralPath $tmp -ErrorAction Stop
        $driveFormat = (Get-Volume -DriveLetter $env:SystemDrive.TrimEnd(':') -ErrorAction Stop).FileSystem
        if ($driveFormat -eq 'NTFS' -and $acl) { Add-Result 'NTFS permissions' 'PASS' "TEMP is NTFS; current identity=$($acl.Owner). ACL read only; no changes made." 'Review the displayed identity and inherited ACL outside this script if they are unexpected.' }
        else { Add-Result 'NTFS permissions' 'FAIL' "TEMP file system is $driveFormat; NTFS is required." 'Use an NTFS-backed local TEMP folder; do not change permissions automatically.' }

        try {
            $sample = 'fictional-dpapi-validation'
            $protected = ConvertFrom-SecureString (ConvertTo-SecureString $sample -AsPlainText -Force)
            $unprotected = [Net.NetworkCredential]::new('', (ConvertTo-SecureString $protected)).Password
            if ($unprotected -ceq $sample) { Add-Result 'DPAPI compatibility' 'PASS' 'CurrentUser protect/unprotect round-trip passed for a synthetic value.' 'Run as the intended service identity before relying on its DPAPI files; this test does not validate another account.' }
            else { Add-Result 'DPAPI compatibility' 'FAIL' 'Synthetic CurrentUser DPAPI round-trip did not match.' 'Confirm a supported Windows PowerShell/.NET environment and rerun as the intended identity.' }
        } catch { Add-Result 'DPAPI compatibility' 'FAIL' 'Synthetic CurrentUser DPAPI round-trip failed.' 'Confirm Windows DPAPI is available and rerun as the intended identity.' }

        try {
            $zoneId = 'US Mountain Standard Time'
            $zone = [TimeZoneInfo]::FindSystemTimeZoneById($zoneId)
            $localZone = [TimeZoneInfo]::Local.Id
            if ($localZone -eq $zoneId) { Add-Result 'Arizona time-zone configuration' 'PASS' "Windows time zone is $localZone." 'No action required.' }
            else { Add-Result 'Arizona time-zone configuration' 'WARNING' "Windows recognizes $zoneId, but this computer is configured as $localZone." 'Before any future task activation, separately configure and verify the host time zone as US Mountain Standard Time.' }
        } catch { Add-Result 'Arizona time-zone configuration' 'FAIL' 'Windows did not recognize US Mountain Standard Time.' 'Use a supported Windows installation with the Arizona time-zone entry available.' }

        $xmlPath = Join-Path $tmp 'task-preview.xml'
        try {
            & (Join-Path $PSScriptRoot 'task-scheduler-setup.ps1') -OutputPath $xmlPath *> $null
            [xml]$task = Get-Content -LiteralPath $xmlPath -Raw
            $times = @($task.Task.Triggers.CalendarTrigger | ForEach-Object { ([datetime]$_.StartBoundary).ToString('HH:mm') })
            if ($task.Task.Settings.MultipleInstancesPolicy -eq 'IgnoreNew' -and $task.Task.Settings.StartWhenAvailable -eq 'true' -and (($times -join ',') -eq '00:00,06:00,12:00,18:00')) {
                Add-Result 'Task Scheduler XML' 'PASS' 'Preview XML parses and includes the expected four daily trigger times; no task was registered.' 'No action required.'
            } else { Add-Result 'Task Scheduler XML' 'FAIL' 'Preview XML is valid but its expected settings or Arizona wall-clock trigger times differ.' 'Review task-scheduler-setup.ps1 and keep the host time zone set to Arizona before any separate activation approval.' }
        } catch { Add-Result 'Task Scheduler XML' 'FAIL' 'Could not generate or parse the local preview XML.' 'Use Windows PowerShell 7.4+ and inspect the non-secret parser error.' }

        if (-not $node) { Add-Result 'Synthetic AES-256-GCM, tamper, wrong-key, and cleanup' 'BLOCKED' 'Node.js is unavailable, so crypto CLI checks were skipped.' 'Use an already installed Node.js 22 or 24 runtime and rerun.' }
        else {
            $input = Join-Path $tmp 'fictional.bin'; $archive = Join-Path $tmp 'fictional.aesgcm'; $output = Join-Path $tmp 'restored.bin'; $badArchive = Join-Path $tmp 'tampered.aesgcm'; $wrongOutput = Join-Path $tmp 'wrong-key.bin'; $keyPath = Join-Path $tmp 'fictional.key'; $wrongKeyPath = Join-Path $tmp 'wrong.key'
            $bytes = [Text.Encoding]::UTF8.GetBytes('Fictional validation data only.')
            $keyBytes = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32); $wrongKey = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
            [IO.File]::WriteAllBytes($input, $bytes); [IO.File]::WriteAllBytes($keyPath, $keyBytes); [IO.File]::WriteAllBytes($wrongKeyPath, $wrongKey)
            try {
                & $node (Join-Path $PSScriptRoot 'crypto-cli.mjs') encrypt $input $archive $keyPath *> $null
                $encCode = $LASTEXITCODE
                & $node (Join-Path $PSScriptRoot 'crypto-cli.mjs') decrypt $archive $output $keyPath *> $null
                $decCode = $LASTEXITCODE
                $roundTrip = $encCode -eq 0 -and $decCode -eq 0 -and [Linq.Enumerable]::SequenceEqual([byte[]]$bytes, [byte[]][IO.File]::ReadAllBytes($output))
                if ($roundTrip) { Add-Result 'AES-256-GCM synthetic round-trip' 'PASS' 'Fictional bytes encrypted and decrypted successfully.' 'No action required.' }
                else { Add-Result 'AES-256-GCM synthetic round-trip' 'FAIL' 'Fictional encryption/decryption did not produce identical bytes.' 'Check the already installed Node.js runtime and crypto module; do not install dependencies automatically.' }

                Copy-Item -LiteralPath $archive -Destination $badArchive
                $damaged = [IO.File]::ReadAllBytes($badArchive); $damaged[$damaged.Length - 1] = $damaged[$damaged.Length - 1] -bxor 1; [IO.File]::WriteAllBytes($badArchive, $damaged)
                & $node (Join-Path $PSScriptRoot 'crypto-cli.mjs') decrypt $badArchive (Join-Path $tmp 'tampered-out') $keyPath *> $null
                $tamperRejected = $LASTEXITCODE -ne 0 -and -not (Test-Path (Join-Path $tmp 'tampered-out'))
                & $node (Join-Path $PSScriptRoot 'crypto-cli.mjs') decrypt $archive $wrongOutput $wrongKeyPath *> $null
                $wrongKeyRejected = $LASTEXITCODE -ne 0 -and -not (Test-Path $wrongOutput)
                if ($tamperRejected -and $wrongKeyRejected) { Add-Result 'Corrupted archive and wrong-key rejection' 'PASS' 'Tampering and wrong key were rejected; no plaintext destination was left.' 'No action required.' }
                else { Add-Result 'Corrupted archive and wrong-key rejection' 'FAIL' 'A tampered archive or wrong key was not safely rejected.' 'Stop validation and review crypto.mjs before using any backup.' }
            } catch { Add-Result 'Synthetic AES-256-GCM checks' 'FAIL' 'A local crypto CLI step failed.' 'Review the local non-secret Node.js error and rerun.' }
            finally { [Array]::Clear($keyBytes,0,$keyBytes.Length); [Array]::Clear($wrongKey,0,$wrongKey.Length) }
            $remaining = @(Get-ChildItem -LiteralPath $tmp -Filter '*.tmp' -ErrorAction SilentlyContinue)
            if ($remaining.Count -eq 0) { Add-Result 'Temporary-file cleanup' 'PASS' 'No crypto temporary files remain; launcher cleanup removes the synthetic work directory.' 'No action required.' }
            else { Add-Result 'Temporary-file cleanup' 'FAIL' 'A synthetic crypto temporary file remained.' 'Remove only the listed synthetic test files after review; do not delete any backup archives.' }
        }
    }
} catch {
    Add-Result 'Windows validation execution' 'FAIL' 'A local validation check failed unexpectedly; detailed exception text was suppressed.' 'Inspect the script and rerun; do not share logs containing unrelated local data.'
} finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $tmp) { Add-Result 'Validation temporary-file cleanup' 'FAIL' 'The synthetic validation work directory could not be removed.' 'Remove only this validation-generated directory after reviewing its contents.' }
    else { Add-Result 'Validation temporary-file cleanup' 'PASS' 'Synthetic work directory and its test files were removed.' 'No action required.' }
}

if ($ResultPath) {
    $parent = Split-Path -Parent $ResultPath
    if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ResultPath -Encoding UTF8
}
$results

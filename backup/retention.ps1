[CmdletBinding()]
param([Parameter(Mandatory)][string]$Manifest,[switch]$Apply,[switch]$DryRun=$true,[string]$ApprovalReference)
$ErrorActionPreference='Stop';if($Apply -and ($DryRun -or $ApprovalReference -notmatch '^JD-APPROVED-[A-Z0-9-]{6,}$')){throw 'Deletion disabled without explicit signed approval; default is dry-run.'}
$m=Get-Content -Raw $Manifest|ConvertFrom-Json;$valid=@($m.backups|Where-Object{$_.verified -eq $true -and $_.status -eq 'success'}|Sort-Object timestamp -Descending);if(-not $valid.Count){throw 'No verified backup exists; refusing retention.'}
$keep=[Collections.Generic.HashSet[string]]::new();foreach($b in ($valid|Select-Object -First 14)){$null=$keep.Add($b.id)};$weekly=@{};$monthly=@{}
foreach($b in $valid){$d=[datetime]$b.timestamp;$wk=[Globalization.ISOWeek]::GetWeekOfYear($d);$wy=[Globalization.ISOWeek]::GetYear($d);$w="$wy-$wk";$mo=$d.ToString('yyyy-MM');if(-not $weekly.ContainsKey($w) -and $weekly.Count -lt 8){$weekly[$w]=$b.id;$null=$keep.Add($b.id)};if(-not $monthly.ContainsKey($mo) -and $monthly.Count -lt 3){$monthly[$mo]=$b.id;$null=$keep.Add($b.id)}}
$null=$keep.Add($valid[0].id);$plan=@($m.backups|Where-Object{$_.verified -eq $true -and $_.status -eq 'success' -and -not $keep.Contains($_.id)}|ForEach-Object{[pscustomobject]@{id=$_.id;action='would-delete'}});$plan|ConvertTo-Json
if($Apply){throw 'Remote deletion is not implemented; no files deleted.'}

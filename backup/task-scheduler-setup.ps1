[CmdletBinding()]
param([switch]$Activate,[string]$ApprovalReference,[switch]$Register,[string]$OutputPath=(Join-Path $PSScriptRoot 'task-preview.xml'))
$ErrorActionPreference='Stop'
$times=@('00:00','06:00','12:00','18:00');$tz=[TimeZoneInfo]::FindSystemTimeZoneById('US Mountain Standard Time')
$triggers=foreach($t in $times){$h,$m=$t.Split(':');"<CalendarTrigger><StartBoundary>2026-01-01T${t}:00</StartBoundary><Enabled>true</Enabled><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>"}
$xml="<?xml version=`"1.0`"?><Task version=`"1.4`"><RegistrationInfo><Description>Lead Connect encrypted backup preview only; Arizona time; no task registered.</Description></RegistrationInfo><Triggers>$($triggers -join '')</Triggers><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><StartWhenAvailable>true</StartWhenAvailable><ExecutionTimeLimit>PT2H</ExecutionTimeLimit><RestartOnFailure><Interval>PT15M</Interval><Count>3</Count></RestartOnFailure></Settings><Principals><Principal id=`"BackupService`"><LogonType>Password</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Actions Context=`"BackupService`"><Exec><Command>pwsh.exe</Command><Arguments>-NoProfile -File backup.ps1</Arguments></Exec></Actions></Task>"
if($Register){throw 'Task registration is prohibited in this preparation package.'}
if($Activate -and $ApprovalReference -notmatch '^JD-APPROVED-[A-Z0-9-]{6,}$'){throw 'Approval reference invalid.'}
if($OutputPath -ne '-') { [IO.File]::WriteAllText($OutputPath,$xml,[Text.Encoding]::UTF8);Write-Output "Preview generated; no task registered. Windows time zone: $($tz.Id). Triggers: $($times -join ', ')." } else {Write-Output $xml}

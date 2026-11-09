[CmdletBinding()]
param([switch]$Activate,[string]$ApprovalReference,[switch]$Install)
$ErrorActionPreference='Stop'
if(-not $Activate -or -not $Install -or $ApprovalReference -notmatch '^JD-APPROVED-[A-Z0-9-]{6,}$'){throw 'No task created. Require explicit approval after checklist signoff.'}
throw 'Task registration remains disabled in preparation. The approved operator must configure Windows Task Scheduler after code review.'

[CmdletBinding()]
param([string]$ReportDirectory = (Join-Path $PSScriptRoot 'validation-reports'))

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Path $ReportDirectory -Force | Out-Null
$jsonPath = Join-Path $ReportDirectory "windows-validation-$timestamp.json"
$markdownPath = Join-Path $ReportDirectory "windows-validation-$timestamp.md"
$all = [Collections.Generic.List[object]]::new()
$notes = [Collections.Generic.List[string]]::new()

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) { $nodeCommand = Get-Command node -ErrorAction SilentlyContinue }
if ($nodeCommand) {
    $testFiles = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.test.mjs' -File | ForEach-Object FullName)
    if ($testFiles.Count -eq 0) {
        $all.Add([pscustomobject]@{check='Offline Node.js tests';status='FAIL';explanation='No backup/*.test.mjs files were found.';recommendedAction='Restore or review the expected offline test suite before proceeding.'})
    } else {
        $testOutput = @(& $nodeCommand.Source --test @testFiles 2>&1)
        $testExit = $LASTEXITCODE
        if ($testExit -eq 0) {
            $all.Add([pscustomobject]@{check='Offline Node.js tests';status='PASS';explanation="All $($testFiles.Count) backup test files passed using the installed runtime.";recommendedAction='No action required.'})
        } else {
            $all.Add([pscustomobject]@{check='Offline Node.js tests';status='FAIL';explanation='One or more offline node:test cases failed. See the report test output.';recommendedAction='Review the failing local test and fix it before any approval stage.'})
        }
        $notes.Add('### Offline Node.js test output')
        $notes.Add('```text')
        $notes.Add(($testOutput | ForEach-Object { [string]$_ }) -join "`n")
        $notes.Add('```')
    }
} else {
    $all.Add([pscustomobject]@{check='Offline Node.js tests';status='FAIL';explanation='Node.js was not found; offline tests could not run.';recommendedAction='Use an already installed Node.js 22 or 24 runtime; installation requires separate approval.'})
}

try {
    $validationResults = @(& (Join-Path $PSScriptRoot 'windows-validation.ps1'))
    foreach ($result in $validationResults) { $all.Add($result) }
} catch {
    $all.Add([pscustomobject]@{check='Windows validation script';status='FAIL';explanation='The prerequisite/synthetic validation script terminated unexpectedly; details suppressed.';recommendedAction='Review the local script and rerun; no installation or network access is part of the launcher.'})
}

$summary = [pscustomobject]@{
    generatedAt = (Get-Date).ToString('o')
    mode = 'offline and non-destructive'
    networkConnectionsAttempted = $false
    scheduledTasksCreated = $false
    dependenciesInstalled = $false
    checks = @($all)
    totals = [pscustomobject]@{
        PASS = @($all | Where-Object status -eq 'PASS').Count
        FAIL = @($all | Where-Object status -eq 'FAIL').Count
        WARNING = @($all | Where-Object status -eq 'WARNING').Count
        BLOCKED = @($all | Where-Object status -eq 'BLOCKED').Count
    }
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$md = [Collections.Generic.List[string]]::new()
$md.Add('# Windows backup validation report')
$md.Add('')
$md.Add("Generated: $($summary.generatedAt)")
$md.Add('Mode: **offline and non-destructive**. No database, cloud service, or Google Drive was contacted. No task was registered and no dependencies were installed.')
$md.Add('')
$md.Add("Totals: PASS $($summary.totals.PASS); FAIL $($summary.totals.FAIL); WARNING $($summary.totals.WARNING); BLOCKED $($summary.totals.BLOCKED)")
$md.Add('')
$md.Add('| Check | Status | Explanation | Recommended action |')
$md.Add('|---|---|---|---|')
foreach ($item in $all) {
    $explanation = ([string]$item.explanation).Replace('|','\|').Replace("`r",' ').Replace("`n",' ')
    $action = ([string]$item.recommendedAction).Replace('|','\|').Replace("`r",' ').Replace("`n",' ')
    $md.Add("| $($item.check) | **$($item.status)** | $explanation | $action |")
}
if ($notes.Count) { $md.Add(''); foreach ($line in $notes) { $md.Add($line) } }
$md.Add('')
$md.Add("Machine-readable results: ``$jsonPath``")
$md | Set-Content -LiteralPath $markdownPath -Encoding UTF8

Write-Output "Human-readable report: $markdownPath"
Write-Output "Machine-readable JSON: $jsonPath"
Write-Output "PASS=$($summary.totals.PASS) FAIL=$($summary.totals.FAIL) WARNING=$($summary.totals.WARNING) BLOCKED=$($summary.totals.BLOCKED)"
if ($summary.totals.FAIL -gt 0) { exit 1 }
if ($summary.totals.BLOCKED -gt 0) { exit 2 }

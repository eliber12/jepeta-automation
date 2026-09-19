param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Main = 'https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts'
$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$Log = Join-Path $StateDir 'guarded-worker.log'

Write-Host '=== Jepeta Risk Guard - runtime repair ==='

Write-Host '1/3 Capturing previous runtime diagnostics...'
if (Test-Path $Log) {
  Write-Host '--- previous guarded-worker.log (last 80 lines) ---'
  Get-Content $Log -Tail 80 | ForEach-Object { Write-Host $_ }
  Write-Host '--- end previous log ---'
} else {
  Write-Host 'No previous guarded-worker.log found.'
}

Write-Host ''
Write-Host '2/3 Deploying self-healing guarded worker...'
Set-Location $env:TEMP
$installer = (Invoke-WebRequest "$Main/install-acp-worker.ps1" -UseBasicParsing).Content
Invoke-Expression $installer

Write-Host ''
Write-Host '3/3 Resuming agent-ready commerce...'
$resume = (Invoke-WebRequest "$Main/resume-agent-ready.ps1" -UseBasicParsing).Content
Invoke-Expression $resume

Write-Host ''
Write-Host 'RUNTIME REPAIR COMPLETE'

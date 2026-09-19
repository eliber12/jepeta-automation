param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Main = 'https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts'
$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$ActiveAppFile = Join-Path $StateDir 'active-app.txt'
$OfferingId = '01a0b464-2334-7c1b-a88e-467c77d83327'

Write-Host '=== Jepeta Risk Guard - resume agent-ready commerce ==='

if (-not (Test-Path $ActiveAppFile)) {
  throw 'Active guarded deployment pointer missing. Run upgrade-agent-ready.ps1 first.'
}
$AppDir = (Get-Content $ActiveAppFile -Raw).Trim()
if (-not (Test-Path (Join-Path $AppDir 'worker\run.mjs'))) {
  throw "Active guarded deployment is missing: $AppDir"
}

Write-Host '1/4 Verifying fresh worker heartbeat...'
$Heartbeat = Join-Path $StateDir 'heartbeat.json'
if (-not (Test-Path $Heartbeat)) { throw 'Worker heartbeat file is missing.' }
$hb = Get-Content $Heartbeat -Raw | ConvertFrom-Json
$age = ((Get-Date).ToUniversalTime() - ([datetime]$hb.at).ToUniversalTime()).TotalSeconds
if ($hb.live -ne $true -or $age -gt 90) {
  throw ('Worker heartbeat is not live/fresh. Age seconds: ' + [math]::Round($age,1))
}
Write-Host ('Worker heartbeat OK; age ' + [math]::Round($age,1) + 's.')

Write-Host ''
Write-Host '2/4 Applying ACP commerce metadata without reinstalling the worker...'
$configure = (Invoke-WebRequest "$Main/configure-acp-commerce.ps1" -UseBasicParsing).Content
Invoke-Expression $configure

Write-Host ''
Write-Host '3/4 Restoring guarded marketplace availability...'
$offers = @((& acp offering list --json | Out-String | ConvertFrom-Json))
if ($LASTEXITCODE -ne 0) { throw 'Could not list ACP offerings.' }
$offer = $offers | Where-Object { $_.id -eq $OfferingId } | Select-Object -First 1
if (-not $offer) { throw 'Token Risk Scan offering not found.' }

if ($offer.isHidden -eq $true) {
  $metricsFile = Join-Path $StateDir 'business-metrics.json'
  $active = 0
  if (Test-Path $metricsFile) {
    try {
      $metrics = Get-Content $metricsFile -Raw | ConvertFrom-Json
      $active = [int]$metrics.jobs.active
    } catch {}
  }

  if ($active -gt 0) {
    Write-Host 'Offering remains intentionally hidden because an ACP job is active.'
  } else {
    & node (Join-Path $AppDir 'worker\run.mjs') pilot-public
    if ($LASTEXITCODE -ne 0) { throw 'Guarded public pilot gate refused to reopen the offering.' }
  }
}

$deadline = (Get-Date).AddSeconds(45)
do {
  Start-Sleep -Seconds 3
  $offers = @((& acp offering list --json | Out-String | ConvertFrom-Json))
  $offer = $offers | Where-Object { $_.id -eq $OfferingId } | Select-Object -First 1
  if ($offer -and $offer.isHidden -eq $false) { break }

  $metricsFile = Join-Path $StateDir 'business-metrics.json'
  if (Test-Path $metricsFile) {
    try {
      $metrics = Get-Content $metricsFile -Raw | ConvertFrom-Json
      if ([int]$metrics.jobs.active -gt 0) { break }
    } catch {}
  }
} while ((Get-Date) -lt $deadline)

Write-Host ''
Write-Host '4/4 Business dashboard...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $AppDir 'scripts\show-acp-dashboard.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Business dashboard could not be read.' }

$offers = @((& acp offering list --json | Out-String | ConvertFrom-Json))
$offer = $offers | Where-Object { $_.id -eq $OfferingId } | Select-Object -First 1

Write-Host ''
Write-Host '=============================================='
Write-Host ' JEPETA COMMERCE RESUME COMPLETE'
Write-Host '=============================================='
Write-Host ("Offering public: " + ($offer.isHidden -eq $false))
Write-Host 'Resource failure, if any, is non-blocking.'
Write-Host 'Machine manifest: https://jepeta-automation.netlify.app/agent.json'
Write-Host '=============================================='

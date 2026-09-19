param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Main = 'https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts'
$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$ActiveAppFile = Join-Path $StateDir 'active-app.txt'
$OfferingId = '01a0b464-2334-7c1b-a88e-467c77d83327'
$ManifestUrl = 'https://jepeta-automation.netlify.app/agent.json'

Write-Host '=== Jepeta Risk Guard - agent-ready commerce upgrade ==='

Write-Host '1/5 Safe worker upgrade...'
Set-Location $env:TEMP
$installer = (Invoke-WebRequest "$Main/install-acp-worker.ps1" -UseBasicParsing).Content
Invoke-Expression $installer

if (-not (Test-Path $ActiveAppFile)) { throw 'Active deployment pointer missing after install.' }
$AppDir = (Get-Content $ActiveAppFile -Raw).Trim()
if (-not (Test-Path (Join-Path $AppDir 'worker\run.mjs'))) { throw "Active deployment missing: $AppDir" }

Write-Host ''
Write-Host '2/5 Configuring ACP listing, resource and discovery...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $AppDir 'scripts\configure-acp-commerce.ps1')
if ($LASTEXITCODE -ne 0) { throw 'ACP commerce configuration failed.' }

Write-Host ''
Write-Host '3/5 Verifying public machine-readable trust contract...'
$manifestReady = $false
for ($i = 1; $i -le 12 -and -not $manifestReady; $i++) {
  try {
    $response = Invoke-WebRequest $ManifestUrl -UseBasicParsing -TimeoutSec 10
    $manifest = $response.Content | ConvertFrom-Json
    if ($response.StatusCode -eq 200 -and $manifest.agentId -eq '01a0b446-374c-7eb8-8fe8-cd1a9945ea70' -and
        $manifest.commerce.offeringId -eq $OfferingId) {
      $manifestReady = $true
      break
    }
  } catch {}
  Start-Sleep -Seconds 5
}
if (-not $manifestReady) { throw 'Public agent manifest is not deployed/valid yet. Do not advertise the machine-readable resource.' }

Write-Host ''
Write-Host '4/5 Restoring guarded public availability...'
$offers = @((& acp offering list --json | Out-String | ConvertFrom-Json))
$offer = $offers | Where-Object { $_.id -eq $OfferingId } | Select-Object -First 1
if (-not $offer) { throw 'Token Risk Scan offering not found.' }

$GateFile = Join-Path $StateDir 'marketplace.json'
$gate = $null
if (Test-Path $GateFile) { try { $gate = Get-Content $GateFile -Raw | ConvertFrom-Json } catch {} }

if ($offer.isHidden -eq $true -and -not $gate) {
  & node (Join-Path $AppDir 'worker\run.mjs') pilot-public
  if ($LASTEXITCODE -ne 0) { throw 'Public pilot gate did not open.' }
}

$deadline = (Get-Date).AddSeconds(60)
do {
  Start-Sleep -Seconds 5
  $offers = @((& acp offering list --json | Out-String | ConvertFrom-Json))
  $offer = $offers | Where-Object { $_.id -eq $OfferingId } | Select-Object -First 1
  if ($offer -and $offer.isHidden -eq $false) { break }

  # A public pilot intentionally stays hidden while one actionable job is active.
  if (Test-Path (Join-Path $StateDir 'business-metrics.json')) {
    $m = Get-Content (Join-Path $StateDir 'business-metrics.json') -Raw | ConvertFrom-Json
    if ([int]$m.jobs.active -gt 0) {
      Write-Host 'Marketplace is intentionally paused because an ACP job is active.'
      break
    }
  }
} while ((Get-Date) -lt $deadline)

Write-Host ''
Write-Host '5/5 Business readiness dashboard...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $AppDir 'scripts\show-acp-dashboard.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Business dashboard could not be read.' }

Write-Host ''
Write-Host '=============================================='
Write-Host ' JEPETA AGENT-READY COMMERCE UPGRADE COMPLETE'
Write-Host '=============================================='
Write-Host "Manifest : $ManifestUrl"
Write-Host 'OpenAPI  : https://jepeta-automation.netlify.app/openapi.json'
Write-Host 'LLM guide: https://jepeta-automation.netlify.app/llms.txt'
Write-Host 'Paid ACP : Token Risk Scan / 0.03 USDC / Base / 5 min SLA'
Write-Host 'Free web : limited preview only'
Write-Host '=============================================='

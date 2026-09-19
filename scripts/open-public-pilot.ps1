param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Main = 'https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts'
$AppDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuardApp'
$OfferingId = '01a0b464-2334-7c1b-a88e-467c77d83327'

Write-Host '=== Jepeta Risk Guard public one-job pilot ==='
Write-Host '1/3 Refreshing guarded worker...'
$installer = Invoke-WebRequest "$Main/install-acp-worker.ps1" -UseBasicParsing
Invoke-Expression $installer.Content

Write-Host ''
Write-Host '2/3 Opening exactly one public paid pilot slot...'
& node (Join-Path $AppDir 'worker\run.mjs') pilot-public
if ($LASTEXITCODE -ne 0) { throw 'Public pilot gate refused to open the offering.' }

Write-Host ''
Write-Host '3/3 Verifying seller-side visibility flag...'
$raw = & acp offering list --json
if ($LASTEXITCODE -ne 0) { throw 'Could not verify offering state.' }
$offers = $raw | Out-String | ConvertFrom-Json
$offer = @($offers) | Where-Object { $_.id -eq $OfferingId } | Select-Object -First 1
if (-not $offer) { throw 'Token Risk Scan offering not found.' }
if ($offer.isHidden -ne $false) { throw 'Offering is still hidden.' }

Write-Host ''
Write-Host 'PUBLIC PILOT LIVE'
Write-Host 'Price: 0.03 USDC'
Write-Host 'Capacity before first verified settlement: 1 job'
Write-Host 'No owner deposit was made.'
Write-Host 'When the first independent buyer creates a job, the worker will pause new sales, process that job, verify the Base USDC settlement, then reopen automatically after success.'

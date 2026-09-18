param([decimal]$SuggestedFunding = 0.10, [int]$FundingWaitMinutes = 20)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Main = 'https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts'
$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$AppDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuardApp'
$BuyerDir = Join-Path $StateDir 'buyer-profile'

Write-Host '=== Jepeta Risk Guard full launch ==='
Write-Host '1/4 Installing guarded provider worker...'
$installer = Invoke-WebRequest "$Main/install-acp-worker.ps1" -UseBasicParsing
Invoke-Expression $installer.Content

Write-Host ''
Write-Host '2/4 Preparing isolated buyer/evaluator...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $AppDir 'scripts\setup-test-buyer.ps1') -SuggestedFunding $SuggestedFunding
if ($LASTEXITCODE -ne 0) { throw 'Buyer setup failed.' }

Write-Host ''
Write-Host '3/4 Waiting for buyer USDC funding on Base...'
$env:ACP_CONFIG_DIR = $BuyerDir
$deadline = (Get-Date).AddMinutes($FundingWaitMinutes)
$funded = $false
do {
  $raw = & acp wallet balance --chain-id 8453 --token USDC --json
  if ($LASTEXITCODE -eq 0) {
    try {
      $balance = $raw | Out-String | ConvertFrom-Json
      $total = [decimal]0
      if ($null -ne $balance.total) { [void][decimal]::TryParse([string]$balance.total, [ref]$total) }
      Write-Host ('Buyer USDC: ' + $total)
      if ($total -ge [decimal]0.03) { $funded = $true; break }
    } catch {}
  }
  Start-Sleep -Seconds 10
} while ((Get-Date) -lt $deadline)

if (-not $funded) {
  throw 'Funding was not detected before timeout. Nothing was purchased; rerun this script after the buyer wallet has at least 0.03 USDC on Base.'
}

Remove-Item Env:ACP_CONFIG_DIR -ErrorAction SilentlyContinue
Write-Host ''
Write-Host '4/4 Running paid E2E, settlement proof and marketplace publication...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $AppDir 'scripts\run-paid-e2e.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Paid E2E launch gate did not complete. Offering remains hidden or was re-hidden.' }

Write-Host ''
Write-Host 'JEPETA RISK GUARD LAUNCH COMPLETE'
Write-Host 'The paid E2E proof is stored under %LOCALAPPDATA%\JepetaRiskGuard\paid-e2e-proof.json'

param([string]$TokenAddress = '0x4200000000000000000000000000000000000006')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Provider = '0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df'
$Offering = 'Token Risk Scan'
$ChainId = 8453
$Price = [decimal]0.03
$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$ActiveAppFile = Join-Path $StateDir 'active-app.txt'
$BuyerDir = Join-Path $StateDir 'buyer-profile'
$Heartbeat = Join-Path $StateDir 'heartbeat.json'
$Journal = Join-Path $StateDir 'state.json'
if (-not (Test-Path $ActiveAppFile)) { throw 'Active guarded deployment pointer missing.' }
$AppDir = (Get-Content $ActiveAppFile -Raw).Trim()
if (-not (Test-Path (Join-Path $AppDir 'worker\run.mjs'))) { throw 'Active guarded deployment is missing.' }

function Invoke-AcpJson([string[]]$Args) {
  $raw = & acp @Args --json
  if ($LASTEXITCODE -ne 0) { throw ('ACP failed: ' + ($Args -join ' ')) }
  return ($raw | Out-String | ConvertFrom-Json)
}

function Get-History([string]$JobId) {
  return Invoke-AcpJson @('job','history','--job-id',$JobId,'--chain-id',[string]$ChainId)
}

function Find-SystemEvent($History, [string]$Type) {
  $events = @($History.entries | Where-Object { $_.kind -eq 'system' -and $_.event.type -eq $Type })
  if ($events.Count -eq 0) { return $null }
  return $events[$events.Count - 1]
}

if ($TokenAddress -notmatch '^0x[a-fA-F0-9]{40}$') { throw 'Invalid Base token address.' }
if (-not (Test-Path $BuyerDir)) { throw 'Buyer profile missing. Run scripts/setup-test-buyer.ps1 first.' }
if (-not (Test-Path $Heartbeat)) { throw 'Guarded provider heartbeat missing. Reinstall/start guarded worker first.' }
$hb = Get-Content $Heartbeat -Raw | ConvertFrom-Json
$hbAge = ((Get-Date).ToUniversalTime() - ([datetime]$hb.at).ToUniversalTime()).TotalSeconds
if ($hb.live -ne $true -or $hbAge -gt 90) { throw 'Guarded provider is not live. Keep the offering hidden.' }

$oldConfig = $env:ACP_CONFIG_DIR
$env:ACP_CONFIG_DIR = $BuyerDir
$buyer = Invoke-AcpJson @('agent','whoami')
if (-not $buyer.walletAddress -or $buyer.walletAddress.ToLower() -eq $Provider) { throw 'Independent buyer agent is not active.' }

$balance = Invoke-AcpJson @('wallet','balance','--chain-id',[string]$ChainId,'--token','USDC')
$total = [decimal]0
if ($null -ne $balance.total -and [decimal]::TryParse([string]$balance.total, [ref]$total)) { }
if ($total -lt $Price) {
  throw ('Buyer has ' + $total + ' USDC. Fund at least 0.03 USDC on Base before running the paid test.')
}

$requirements = '{"tokenAddress":"' + $TokenAddress.ToLower() + '"}'
$created = Invoke-AcpJson @('client','create-job','--provider',$Provider,'--offering-name',$Offering,'--requirements',$requirements,'--chain-id',[string]$ChainId)
$jobId = [string]$created.jobId
if (-not $jobId) { throw 'Paid test job was not created.' }
Write-Host ('Job created: ' + $jobId)

$deadline = (Get-Date).AddSeconds(90)
$budgetEvent = $null
do {
  Start-Sleep -Seconds 3
  $history = Get-History $jobId
  $budgetEvent = Find-SystemEvent $history 'budget.set'
} while (-not $budgetEvent -and (Get-Date) -lt $deadline)
if (-not $budgetEvent) { throw 'Provider did not quote within 90 seconds. Do not fund.' }
if ([decimal]$budgetEvent.event.amount -ne $Price) { throw 'Provider quoted an unexpected amount. Do not fund.' }
Write-Host 'Exact 0.03-USDC quote verified.'

$funded = Invoke-AcpJson @('client','fund','--job-id',$jobId,'--amount','0.03','--chain-id',[string]$ChainId)
if ($funded.success -ne $true) { throw 'Funding was not confirmed.' }
Write-Host '0.03 USDC escrow funded.'

$deadline = (Get-Date).AddSeconds(120)
$submittedEvent = $null
do {
  Start-Sleep -Seconds 3
  $history = Get-History $jobId
  $submittedEvent = Find-SystemEvent $history 'job.submitted'
} while (-not $submittedEvent -and (Get-Date) -lt $deadline)
if (-not $submittedEvent) { throw 'No deliverable received within 120 seconds. Do not complete the job.' }

$deliverable = [string]$submittedEvent.event.deliverable
try { $report = $deliverable | ConvertFrom-Json } catch { throw 'Provider deliverable is not valid JSON.' }
$requiredFields = @('riskScore','riskLevel','honeypot','dangerousPermissions','liquidityRisk','holderConcentration','tradingActivity','warnings','summary')
foreach ($field in $requiredFields) { if (-not ($report.PSObject.Properties.Name -contains $field)) { throw ('Deliverable missing ' + $field) } }
if ([double]$report.riskScore -lt 0 -or [double]$report.riskScore -gt 100) { throw 'Invalid risk score.' }
if (@('LOW','MEDIUM','HIGH','CRITICAL') -notcontains [string]$report.riskLevel) { throw 'Invalid risk level.' }
Write-Host ('Deliverable verified: ' + $report.riskLevel + ' ' + $report.riskScore + '/100')

$completed = Invoke-AcpJson @('client','complete','--job-id',$jobId,'--chain-id',[string]$ChainId,'--reason','Paid E2E report schema verified')
if ($completed.success -ne $true) { throw 'Job completion was not confirmed.' }
Write-Host 'Evaluator completed job; waiting for seller-side settlement proof.'

if ($null -eq $oldConfig -or $oldConfig -eq '') { Remove-Item Env:ACP_CONFIG_DIR -ErrorAction SilentlyContinue } else { $env:ACP_CONFIG_DIR = $oldConfig }
$deadline = (Get-Date).AddSeconds(180)
$settlement = $null
do {
  Start-Sleep -Seconds 4
  if (Test-Path $Journal) {
    try {
      $state = Get-Content $Journal -Raw | ConvertFrom-Json
      $prop = $state.jobs.PSObject.Properties[$jobId]
      if ($prop -and $prop.Value.settlement -and $prop.Value.settlement.creditedUSDCraw) { $settlement = $prop.Value.settlement }
    } catch {}
  }
} while (-not $settlement -and (Get-Date) -lt $deadline)
if (-not $settlement) { throw 'On-chain USDC settlement has not been independently verified yet. Offering remains hidden.' }
Write-Host ('Settlement verified: ' + $settlement.transactionHash)

$env:JEPETA_BUYER_CONFIG_DIR = $BuyerDir
& node (Join-Path $AppDir 'worker\run.mjs') publish
if ($LASTEXITCODE -ne 0) { throw 'Publication gate failed; offering was re-hidden.' }

$env:ACP_CONFIG_DIR = $BuyerDir
$browse = Invoke-AcpJson @('browse','Jepeta Risk Guard','--top-k','50','--chain-ids','8453')
$browseText = $browse | ConvertTo-Json -Depth 20
if ($browseText -notmatch [regex]::Escape($Provider) -or $browseText -notmatch [regex]::Escape($Offering)) {
  throw 'Independent buyer browse did not confirm the public offering.'
}

if ($null -eq $oldConfig -or $oldConfig -eq '') { Remove-Item Env:ACP_CONFIG_DIR -ErrorAction SilentlyContinue } else { $env:ACP_CONFIG_DIR = $oldConfig }
$providerBalance = Invoke-AcpJson @('wallet','balance','--chain-id',[string]$ChainId,'--token','USDC')

$proof = @{
  jobId = $jobId
  buyer = $buyer.walletAddress
  provider = $Provider
  tokenAddress = $TokenAddress.ToLower()
  priceUSDC = 0.03
  riskLevel = $report.riskLevel
  riskScore = $report.riskScore
  settlementTx = $settlement.transactionHash
  creditedUSDCraw = $settlement.creditedUSDCraw
  marketplaceVisible = $true
  providerUSDC = $providerBalance.total
  verifiedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $StateDir 'paid-e2e-proof.json') -Encoding UTF8

Write-Host ''
Write-Host 'PAID E2E + MARKETPLACE VERIFIED'
$proof | Format-List

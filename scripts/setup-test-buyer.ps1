param([decimal]$SuggestedFunding = 0.10)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$BuyerDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard\buyer-profile'
$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$BuyerMeta = Join-Path $StateDir 'buyer.json'
$BuyerName = 'Jepeta Buyer Test'
$Provider = '0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df'

function Get-AgentsResult {
  $raw = & acp agent list --json
  if ($LASTEXITCODE -ne 0) { return $null }
  try { return ($raw | Out-String | ConvertFrom-Json) } catch { return $null }
}

function Find-Buyer($result) {
  if (-not $result -or -not $result.data) { return $null }
  return @($result.data) | Where-Object { $_.name -eq $BuyerName } | Select-Object -First 1
}

if (-not (Get-Command acp -ErrorAction SilentlyContinue)) { throw 'ACP CLI is not installed.' }
New-Item -ItemType Directory -Force -Path $BuyerDir | Out-Null
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

$env:ACP_CONFIG_DIR = $BuyerDir

# Reuse the isolated buyer login if it already works. Only open OAuth when needed.
$agentsResult = Get-AgentsResult
if (-not $agentsResult) {
  Write-Host 'Authenticating the isolated buyer profile...'
  & acp configure
  if ($LASTEXITCODE -ne 0) { throw 'Buyer ACP authentication failed.' }
  $agentsResult = Get-AgentsResult
  if (-not $agentsResult) { throw 'Could not list agents after buyer authentication.' }
} else {
  Write-Host 'Buyer profile authentication already valid.'
}

$buyer = Find-Buyer $agentsResult

# Agent creation is a backend POST. HTTP 500 can be transient or ambiguous, so
# after every attempt we re-list before ever retrying. This prevents duplicate buyers.
if (-not $buyer) {
  for ($attempt = 1; $attempt -le 2 -and -not $buyer; $attempt++) {
    Write-Host "Creating separate buyer agent (attempt $attempt/2)..."
    & acp agent create --name $BuyerName --description 'Independent buyer/evaluator used only for Jepeta Risk Guard paid end-to-end verification.' --image ''
    $createExit = $LASTEXITCODE

    # The backend may have committed the agent even if the response failed.
    for ($poll = 1; $poll -le 4 -and -not $buyer; $poll++) {
      Start-Sleep -Seconds 5
      $agentsResult = Get-AgentsResult
      $buyer = Find-Buyer $agentsResult
    }

    if (-not $buyer -and $attempt -lt 2) {
      Write-Host 'Virtuals did not return/confirm the buyer yet. Retrying once after reconciliation...'
      Start-Sleep -Seconds 10
    }

    if (-not $buyer -and $createExit -eq 0) {
      Write-Host 'Create command reported success but buyer is not listed yet; waiting for backend consistency...'
    }
  }
}

if (-not $buyer) {
  throw 'Virtuals /agents creation is still returning an unconfirmed server error. Provider worker remains live, offering remains hidden, and no money was moved. Retry this script later or create an agent named "Jepeta Buyer Test" in the Virtuals web UI, then rerun.'
}

$buyerId = [string]$buyer.id
if (-not $buyerId) { throw 'Could not resolve buyer agent ID.' }

& acp agent use --agent-id $buyerId --json | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not activate buyer agent.' }

$whoRaw = & acp agent whoami --json
if ($LASTEXITCODE -ne 0) { throw 'Could not read buyer agent.' }
$who = $whoRaw | Out-String | ConvertFrom-Json
if (-not $who.walletAddress) { throw 'Buyer wallet address unavailable.' }
if ($who.walletAddress.ToLower() -eq $Provider) { throw 'Buyer must not be the provider wallet.' }

# Prove this Windows profile actually owns a local signing key. A dashboard-only
# signer is not enough for autonomous ACP job actions.
$signRaw = & acp wallet sign-message --chain-id 8453 --message 'Jepeta buyer signer preflight' --json 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Buyer needs a local restricted signer. Approve the browser request that opens now.'
  & acp agent add-signer --agent-id $buyerId --policy restricted
  if ($LASTEXITCODE -ne 0) { throw 'Buyer signer approval was not completed.' }

  $signRaw = & acp wallet sign-message --chain-id 8453 --message 'Jepeta buyer signer preflight' --json 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Buyer signer still cannot sign locally after approval.' }
}

@{
  agentId = $who.id
  name = $who.name
  wallet = $who.walletAddress
  configDir = $BuyerDir
  createdAt = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json | Set-Content -Path $BuyerMeta -Encoding UTF8

Write-Host ''
Write-Host 'BUYER READY'
Write-Host "Wallet: $($who.walletAddress)"
Write-Host "Profile: $BuyerDir"
Write-Host ''
Write-Host "Fund this buyer with about $SuggestedFunding USDC on Base (chain 8453)."
Write-Host 'Minimum service escrow is 0.03 USDC; a little extra avoids an exact-balance edge case.'
Write-Host 'Opening the ACP manual-transfer QR now:'
& acp wallet topup --method qr --chain-id 8453

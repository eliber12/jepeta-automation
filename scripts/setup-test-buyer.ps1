param([decimal]$SuggestedFunding = 0.10)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$BuyerDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard\buyer-profile'
$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$BuyerMeta = Join-Path $StateDir 'buyer.json'
$BuyerName = 'Jepeta Buyer Test'

if (-not (Get-Command acp -ErrorAction SilentlyContinue)) { throw 'ACP CLI is not installed.' }
New-Item -ItemType Directory -Force -Path $BuyerDir | Out-Null
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

$env:ACP_CONFIG_DIR = $BuyerDir
Write-Host 'Authenticating the isolated buyer profile...'
& acp configure
if ($LASTEXITCODE -ne 0) { throw 'Buyer ACP authentication failed.' }

$agentsRaw = & acp agent list --json
if ($LASTEXITCODE -ne 0) { throw 'Could not list buyer-profile agents.' }
$agents = $agentsRaw | Out-String | ConvertFrom-Json
$buyer = @($agents) | Where-Object { $_.name -eq $BuyerName } | Select-Object -First 1

if (-not $buyer) {
  Write-Host 'Creating a separate buyer agent and restricted signer...'
  $createdRaw = & acp agent create --name $BuyerName --description 'Independent buyer/evaluator used only for Jepeta Risk Guard paid end-to-end verification.' --signer --policy restricted --json
  if ($LASTEXITCODE -ne 0) { throw 'Buyer agent creation or signer approval failed.' }
  $buyer = $createdRaw | Out-String | ConvertFrom-Json
}

$buyerId = ""
if ($buyer -and $buyer.id) { $buyerId = [string]$buyer.id }
elseif ($buyer -and $buyer.data -and $buyer.data.id) { $buyerId = [string]$buyer.data.id }
if (-not $buyerId) {
  $agentsRaw = & acp agent list --json
  $agents = $agentsRaw | Out-String | ConvertFrom-Json
  $buyer = @($agents) | Where-Object { $_.name -eq $BuyerName } | Select-Object -First 1
  $buyerId = [string]$buyer.id
}
if (-not $buyerId) { throw 'Could not resolve buyer agent ID.' }

& acp agent use --agent-id $buyerId --json | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not activate buyer agent.' }
$whoRaw = & acp agent whoami --json
$who = $whoRaw | Out-String | ConvertFrom-Json
if (-not $who.walletAddress) { throw 'Buyer wallet address unavailable.' }
if ($who.walletAddress.ToLower() -eq '0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df') { throw 'Buyer must not be the provider wallet.' }

@{ agentId=$who.id; name=$who.name; wallet=$who.walletAddress; configDir=$BuyerDir; createdAt=(Get-Date).ToUniversalTime().ToString('o') } |
  ConvertTo-Json | Set-Content -Path $BuyerMeta -Encoding UTF8

Write-Host ''
Write-Host 'BUYER READY'
Write-Host "Wallet: $($who.walletAddress)"
Write-Host "Profile: $BuyerDir"
Write-Host ''
Write-Host "Fund this buyer with at least $SuggestedFunding USDC on Base (chain 8453)."
Write-Host 'Opening the ACP manual-transfer QR now:'
& acp wallet topup --method qr --chain-id 8453

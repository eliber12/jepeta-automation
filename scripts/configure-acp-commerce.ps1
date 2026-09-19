param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AgentId = '01a0b446-374c-7eb8-8fe8-cd1a9945ea70'
$OfferingId = '01a0b464-2334-7c1b-a88e-467c77d83327'
$Provider = '0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df'
$ResourceName = 'Base Token Risk Scan - Capabilities'
$ResourceUrl = 'https://jepeta-automation.netlify.app/agent.json'
$Description = 'Pre-trade ERC-20 risk screening for Base (8453), built for autonomous agents. Input one contract address; receive strict JSON with 0-100 risk score, LOW-CRITICAL level, honeypot status, dangerous permissions, liquidity risk, holder concentration, 24h trading activity, warnings and summary. Sources: GoPlus Security + matching Base pools from DEX Screener. Fails closed on missing required security data. No trading. 5-minute SLA.'
$ResourceDescription = 'Machine-readable capabilities, input/output schemas, pricing, sources, safety properties and failure semantics for the Jepeta Risk Guard Virtuals ACP offering.'

$RequirementsSchema = @{
  type = 'object'
  required = @('tokenAddress')
  properties = @{
    tokenAddress = @{
      type = 'string'
      pattern = '^0x[a-fA-F0-9]{40}
if (-not (Get-Command acp -ErrorAction SilentlyContinue)) { throw 'ACP CLI is not installed.' }

Write-Host '=== Jepeta ACP commerce configuration ==='
& acp agent use --agent-id $AgentId --json | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not select Jepeta Risk Guard.' }

$who = (& acp agent whoami --json | Out-String | ConvertFrom-Json)
if (-not $who.walletAddress -or $who.walletAddress.ToLower() -ne $Provider) {
  throw 'Active ACP wallet is not Jepeta Risk Guard.'
}

Write-Host '1/4 Upgrading offering copy for agent discovery...'
& acp offering update --offering-id $OfferingId --description $Description --requirements $RequirementsSchema --deliverable $DeliverableSchema --json | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Offering description update failed.' }

Write-Host '2/4 Ensuring a public machine-readable capability resource...'
$resources = @((& acp resource list --json | Out-String | ConvertFrom-Json))
if ($LASTEXITCODE -ne 0) { throw 'Could not list ACP resources.' }
$resource = $resources | Where-Object { $_.name -eq $ResourceName } | Select-Object -First 1
if (-not $resource) {
  & acp resource create --name $ResourceName --description $ResourceDescription --url $ResourceUrl --params '{}' --no-hidden --json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not create ACP capability resource.' }
  $resources = @((& acp resource list --json | Out-String | ConvertFrom-Json))
  $resource = $resources | Where-Object { $_.name -eq $ResourceName } | Select-Object -First 1
}
if (-not $resource) { throw 'Capability resource is not present after configuration.' }
if ($resource.url -ne $ResourceUrl -or $resource.isHidden -ne $false) {
  throw 'Existing capability resource differs from the approved public configuration. Review it before replacing.'
}

Write-Host '3/4 Verifying offering contract and signer policy...'
$offerings = @((& acp offering list --json | Out-String | ConvertFrom-Json))
$offer = $offerings | Where-Object { $_.id -eq $OfferingId } | Select-Object -First 1
if (-not $offer) { throw 'Token Risk Scan offering not found.' }
if ($offer.name -ne 'Token Risk Scan' -or [decimal]$offer.priceValue -ne [decimal]0.03 -or
    [int]$offer.slaMinutes -ne 5 -or $offer.requiredFunds -ne $false -or
    $offer.requirements.type -ne 'object' -or $offer.deliverable.type -ne 'object') {
  throw 'Offering contract differs from the approved machine-readable service.'
}
$policy = (& acp agent signer-policy --agent-id $AgentId --json | Out-String | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect signer policy.' }
$policyFields = @($policy.PSObject.Properties.Name)
if ($policyFields -contains 'matched' -and $policy.matched -eq $false) {
  throw 'Could not match the local CLI signer to a wallet policy. Keep the offering paused until the signer is verified.'
}
if (-not ($policyFields -contains 'signerId') -or -not $policy.signerId -or
    -not ($policyFields -contains 'policyIds') -or @($policy.policyIds).Count -eq 0) {
  throw 'Signer has no provable wallet policy. Keep the offering paused until a restricted ACP policy is attached.'
}

Write-Host '4/4 Testing marketplace discovery from multiple agent queries...'
$queries = @('Base token risk', 'honeypot Base', 'ERC-20 security')
$foundBy = @()
foreach ($query in $queries) {
  try {
    $browse = (& acp browse $query --chain-ids 8453 --top-k 50 --mode mixed --json | Out-String | ConvertFrom-Json)
    $match = @($browse.data) | Where-Object { $_.walletAddress -and $_.walletAddress.ToLower() -eq $Provider } | Select-Object -First 1
    if ($match) { $foundBy += $query }
  } catch {}
}

$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
@{
  checkedAt = (Get-Date).ToUniversalTime().ToString('o')
  provider = $Provider
  offeringId = $OfferingId
  offeringVisible = ($offer.isHidden -eq $false)
  resourceVisible = ($resource.isHidden -eq $false)
  discoveryQueries = $foundBy
} | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $StateDir 'discovery.json') -Encoding UTF8

Write-Host ''
Write-Host 'ACP COMMERCE CONFIGURED'
Write-Host "Offering: Token Risk Scan"
Write-Host "Price: 0.03 USDC"
Write-Host "SLA: 5 minutes"
Write-Host "Resource: $ResourceUrl"
Write-Host ("Marketplace visible: " + ($offer.isHidden -eq $false))
if ($foundBy.Count -gt 0) {
  Write-Host ("Discovery confirmed for: " + ($foundBy -join ', '))
} else {
  Write-Host 'Discovery indexing was not confirmed from the seller profile yet. The offering state is valid; recheck after marketplace indexing.'
}

      description = 'ERC-20 token contract address on Base chain 8453'
    }
  }
  additionalProperties = $false
} | ConvertTo-Json -Compress -Depth 10

$DeliverableSchema = @{
  type = 'object'
  required = @('riskScore','riskLevel','honeypot','dangerousPermissions','liquidityRisk','holderConcentration','tradingActivity','warnings','summary')
  properties = @{
    riskScore = @{ type='number'; minimum=0; maximum=100; description='Heuristic risk score from 0 to 100. Higher means more observed risk; this is not a probability.' }
    riskLevel = @{ type='string'; 'enum'=@('LOW','MEDIUM','HIGH','CRITICAL'); description='Risk band derived from the heuristic score.' }
    honeypot = @{ type='boolean'; description='GoPlus-reported honeypot status for this exact Base token.' }
    dangerousPermissions = @{ type='array'; items=@{type='string'}; description='Observed contract controls or behaviors that can increase risk.' }
    liquidityRisk = @{ type='string'; 'enum'=@('UNKNOWN','LOW','MEDIUM','HIGH','CRITICAL'); description='Risk band for the largest matching Base pool liquidity.' }
    holderConcentration = @{ type='string'; description='Concentration assessment from the reported non-burn, non-pool holder sample.' }
    tradingActivity = @{ type='string'; description='24-hour volume and buy/sell activity for the selected matching Base pool, or UNKNOWN.' }
    warnings = @{ type='array'; items=@{type='string'}; description='Explicit caveats, unknowns and source-quality warnings.' }
    summary = @{ type='string'; description='Compact machine-readable screening summary with chain, sources and engine version.' }
  }
  additionalProperties = $false
} | ConvertTo-Json -Compress -Depth 10


if (-not (Get-Command acp -ErrorAction SilentlyContinue)) { throw 'ACP CLI is not installed.' }

Write-Host '=== Jepeta ACP commerce configuration ==='
& acp agent use --agent-id $AgentId --json | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not select Jepeta Risk Guard.' }

$who = (& acp agent whoami --json | Out-String | ConvertFrom-Json)
if (-not $who.walletAddress -or $who.walletAddress.ToLower() -ne $Provider) {
  throw 'Active ACP wallet is not Jepeta Risk Guard.'
}

Write-Host '1/4 Upgrading offering copy for agent discovery...'
& acp offering update --offering-id $OfferingId --description $Description --json | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Offering description update failed.' }

Write-Host '2/4 Ensuring a public machine-readable capability resource...'
$resources = @((& acp resource list --json | Out-String | ConvertFrom-Json))
if ($LASTEXITCODE -ne 0) { throw 'Could not list ACP resources.' }
$resource = $resources | Where-Object { $_.name -eq $ResourceName } | Select-Object -First 1
if (-not $resource) {
  & acp resource create --name $ResourceName --description $ResourceDescription --url $ResourceUrl --params '{}' --no-hidden --json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not create ACP capability resource.' }
  $resources = @((& acp resource list --json | Out-String | ConvertFrom-Json))
  $resource = $resources | Where-Object { $_.name -eq $ResourceName } | Select-Object -First 1
}
if (-not $resource) { throw 'Capability resource is not present after configuration.' }
if ($resource.url -ne $ResourceUrl -or $resource.isHidden -ne $false) {
  throw 'Existing capability resource differs from the approved public configuration. Review it before replacing.'
}

Write-Host '3/4 Verifying offering contract and signer policy...'
$offerings = @((& acp offering list --json | Out-String | ConvertFrom-Json))
$offer = $offerings | Where-Object { $_.id -eq $OfferingId } | Select-Object -First 1
if (-not $offer) { throw 'Token Risk Scan offering not found.' }
if ($offer.name -ne 'Token Risk Scan' -or [decimal]$offer.priceValue -ne [decimal]0.03 -or
    [int]$offer.slaMinutes -ne 5 -or $offer.requiredFunds -ne $false -or
    $offer.requirements.type -ne 'object' -or $offer.deliverable.type -ne 'object') {
  throw 'Offering contract differs from the approved machine-readable service.'
}
$policy = (& acp agent signer-policy --agent-id $AgentId --json | Out-String | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect signer policy.' }
if ($policy.policyIds -and @($policy.policyIds).Count -eq 0) {
  throw 'Signer has no wallet policy. Keep the offering paused until a restricted ACP policy is attached.'
}

Write-Host '4/4 Testing marketplace discovery from multiple agent queries...'
$queries = @('Base token risk', 'honeypot Base', 'ERC-20 security')
$foundBy = @()
foreach ($query in $queries) {
  try {
    $browse = (& acp browse $query --chain-ids 8453 --top-k 50 --mode mixed --json | Out-String | ConvertFrom-Json)
    $match = @($browse.data) | Where-Object { $_.walletAddress -and $_.walletAddress.ToLower() -eq $Provider } | Select-Object -First 1
    if ($match) { $foundBy += $query }
  } catch {}
}

$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
@{
  checkedAt = (Get-Date).ToUniversalTime().ToString('o')
  provider = $Provider
  offeringId = $OfferingId
  offeringVisible = ($offer.isHidden -eq $false)
  resourceVisible = ($resource.isHidden -eq $false)
  discoveryQueries = $foundBy
} | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $StateDir 'discovery.json') -Encoding UTF8

Write-Host ''
Write-Host 'ACP COMMERCE CONFIGURED'
Write-Host "Offering: Token Risk Scan"
Write-Host "Price: 0.03 USDC"
Write-Host "SLA: 5 minutes"
Write-Host "Resource: $ResourceUrl"
Write-Host ("Marketplace visible: " + ($offer.isHidden -eq $false))
if ($foundBy.Count -gt 0) {
  Write-Host ("Discovery confirmed for: " + ($foundBy -join ', '))
} else {
  Write-Host 'Discovery indexing was not confirmed from the seller profile yet. The offering state is valid; recheck after marketplace indexing.'
}

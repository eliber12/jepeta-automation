param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AgentId = '01a0b446-374c-7eb8-8fe8-cd1a9945ea70'
$OfferingId = '01a0b464-2334-7c1b-a88e-467c77d83327'
$Provider = '0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df'
$Description = 'Pre-trade ERC-20 risk screening for Base (8453), built for autonomous agents. Input one contract address; receive strict JSON with 0-100 risk score, LOW-CRITICAL level, honeypot status, dangerous permissions, liquidity risk, holder concentration, 24h trading activity, warnings and summary. Sources: GoPlus Security + matching Base pools from DEX Screener. Fails closed on missing required security data. No trading. 5-minute SLA.'

$RequirementsSchema = ([ordered]@{
  type = 'object'
  required = @('tokenAddress')
  properties = [ordered]@{
    tokenAddress = [ordered]@{
      type = 'string'
      pattern = '^0x[a-fA-F0-9]{40}$'
      description = 'ERC-20 token contract address on Base chain 8453'
    }
  }
  additionalProperties = $false
} | ConvertTo-Json -Compress -Depth 10)

$DeliverableSchema = ([ordered]@{
  type = 'object'
  required = @(
    'riskScore','riskLevel','honeypot','dangerousPermissions','liquidityRisk',
    'holderConcentration','tradingActivity','warnings','summary'
  )
  properties = [ordered]@{
    riskScore = [ordered]@{ type='number'; minimum=0; maximum=100 }
    riskLevel = [ordered]@{ type='string'; enum=@('LOW','MEDIUM','HIGH','CRITICAL') }
    honeypot = [ordered]@{ type='boolean' }
    dangerousPermissions = [ordered]@{ type='array'; items=[ordered]@{ type='string' } }
    liquidityRisk = [ordered]@{ type='string'; enum=@('UNKNOWN','LOW','MEDIUM','HIGH','CRITICAL') }
    holderConcentration = [ordered]@{ type='string' }
    tradingActivity = [ordered]@{ type='string' }
    warnings = [ordered]@{ type='array'; items=[ordered]@{ type='string' } }
    summary = [ordered]@{ type='string' }
  }
  additionalProperties = $false
} | ConvertTo-Json -Compress -Depth 10)

function Get-Offer {
  $raw = & acp offering list --json
  if ($LASTEXITCODE -ne 0) { throw 'Could not read ACP offerings.' }
  $offers = @($raw | Out-String | ConvertFrom-Json)
  return $offers | Where-Object { $_.id -eq $OfferingId } | Select-Object -First 1
}

& acp agent use --agent-id $AgentId --json | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not select Jepeta Risk Guard.' }

$who = (& acp agent whoami --json | Out-String | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0 -or -not $who.walletAddress -or $who.walletAddress.ToLower() -ne $Provider) {
  throw 'Active ACP wallet is not Jepeta Risk Guard.'
}

$offer = Get-Offer
if (-not $offer) { throw 'Approved Token Risk Scan offering is missing.' }

$args = @(
  'offering','update',
  '--offering-id',$OfferingId,
  '--name','Token Risk Scan',
  '--description',$Description,
  '--price-type','fixed',
  '--price-value','0.03',
  '--sla-minutes','5',
  '--requirements',$RequirementsSchema,
  '--deliverable',$DeliverableSchema,
  '--no-required-funds',
  '--hidden',
  '--json'
)
& acp @args | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not synchronize the ACP offering contract.' }

$offer = Get-Offer
if (-not $offer) { throw 'Offering disappeared after synchronization.' }

$bad = @()
if ($offer.name -ne 'Token Risk Scan') { $bad += 'name' }
if ([decimal]$offer.priceValue -ne [decimal]0.03) { $bad += 'priceValue' }
if ([int]$offer.slaMinutes -ne 5) { $bad += 'slaMinutes' }
if ($offer.requiredFunds -ne $false) { $bad += 'requiredFunds' }
if ($offer.isHidden -ne $true) { $bad += 'hidden' }

if ($bad.Count -gt 0) {
  throw ('ACP offering commercial contract did not converge: ' + ($bad -join ', '))
}

$reqShape = if ($null -eq $offer.requirements) { 'null' } else { $offer.requirements.GetType().Name }
$delShape = if ($null -eq $offer.deliverable) { 'null' } else { $offer.deliverable.GetType().Name }

Write-Host 'ACP OFFERING CONTRACT SYNCED'
Write-Host 'Offering: Token Risk Scan'
Write-Host 'Price: 0.03 USDC'
Write-Host 'SLA: 5 minutes'
Write-Host 'Required funds: False'
Write-Host 'Hidden during bootstrap: True'
Write-Host ('Registry requirements shape: ' + $reqShape)
Write-Host ('Registry deliverable shape: ' + $delShape)

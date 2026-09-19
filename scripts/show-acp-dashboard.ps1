param([switch]$Json)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$MetricsFile = Join-Path $StateDir 'business-metrics.json'
$DiscoveryFile = Join-Path $StateDir 'discovery.json'

if (-not (Test-Path $MetricsFile)) {
  throw "Business metrics not found yet. Keep the guarded worker running for one loop, then retry: $MetricsFile"
}

$metrics = Get-Content $MetricsFile -Raw | ConvertFrom-Json
$discovery = $null
if (Test-Path $DiscoveryFile) {
  try { $discovery = Get-Content $DiscoveryFile -Raw | ConvertFrom-Json } catch {}
}

$age = ((Get-Date).ToUniversalTime() - ([datetime]$metrics.generatedAt).ToUniversalTime()).TotalSeconds
$workerOnline = $metrics.worker.live -eq $true -and $age -lt 90

if ($Json) {
  [pscustomobject]@{
    metrics = $metrics
    discovery = $discovery
    metricsAgeSeconds = [math]::Round($age, 1)
    workerOnlineNow = $workerOnline
    impressions = $null
    impressionsNote = 'Virtuals ACP does not expose marketplace impression/profile-view telemetry through the current CLI.'
  } | ConvertTo-Json -Depth 10
  exit 0
}

Write-Host ''
Write-Host '=============================================='
Write-Host ' JEPETA RISK GUARD - BUSINESS DASHBOARD'
Write-Host '=============================================='
Write-Host ("Worker             : " + $(if ($workerOnline) { 'ONLINE' } else { 'OFFLINE / STALE' }))
Write-Host ("Marketplace        : " + $metrics.marketplaceMode)
Write-Host ("Price              : " + $metrics.priceUSDC + ' USDC')
Write-Host ("SLA                : " + $metrics.slaMinutes + ' min')
Write-Host ''
Write-Host 'FUNNEL'
Write-Host ("Jobs observed      : " + $metrics.jobs.observed)
Write-Host ("Quoted             : " + $metrics.jobs.quoted)
Write-Host ("Funded             : " + $metrics.jobs.funded)
Write-Host ("Submitted          : " + $metrics.jobs.submitted)
Write-Host ("Completed          : " + $metrics.jobs.completed)
Write-Host ("Settled            : " + $metrics.jobs.settled)
Write-Host ("Unsupported        : " + $metrics.jobs.unsupported)
Write-Host ("Busy/capacity      : " + $metrics.jobs.busy)
Write-Host ("Terminal           : " + $metrics.jobs.terminal)
Write-Host ("Active             : " + $metrics.jobs.active)
Write-Host ''
Write-Host 'USAGE'
Write-Host ("Preflight scans    : " + $metrics.scans.preflightAttempts)
Write-Host ("Funded refreshes   : " + $metrics.scans.fundedRefreshAttempts)
Write-Host ("Cached deliveries  : " + $metrics.scans.cachedDeliveries)
Write-Host ("Unique buyers      : " + $metrics.buyers.uniqueObserved)
Write-Host ("Revenue credited   : " + $metrics.revenue.creditedUSDC + ' USDC')
Write-Host ("Last activity      : " + $(if ($metrics.lastActivityAt) { $metrics.lastActivityAt } else { '-' }))
Write-Host ''
if ($discovery) {
  Write-Host 'DISCOVERY'
  Write-Host ("Offering public    : " + $discovery.offeringVisible)
  Write-Host ("Resource public    : " + $discovery.resourceVisible)
  Write-Host ("Search matches     : " + $(if (@($discovery.discoveryQueries).Count) { @($discovery.discoveryQueries) -join ', ' } else { 'not confirmed yet' }))
}
Write-Host ''
Write-Host 'Marketplace impressions/profile views: NOT EXPOSED by the current ACP CLI.'
Write-Host ("Metrics generated  : " + $metrics.generatedAt + " (" + [math]::Round($age,1) + "s ago)")
Write-Host '=============================================='

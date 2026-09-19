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

Write-Host '1/4 Verifying fresh operational worker heartbeat...'
$Heartbeat = Join-Path $StateDir 'heartbeat.json'
$TaskName = 'Jepeta Risk Guard'

function Get-HeartbeatStatus {
  if (-not (Test-Path $Heartbeat)) { return $null }
  try {
    $value = Get-Content $Heartbeat -Raw | ConvertFrom-Json
    $ageSeconds = ((Get-Date).ToUniversalTime() - ([datetime]$value.at).ToUniversalTime()).TotalSeconds
    return [pscustomobject]@{
      value = $value
      age = $ageSeconds
      ok = ($value.live -eq $true -and $value.operational -ne $false -and $ageSeconds -lt 90)
    }
  } catch {
    return $null
  }
}

$status = Get-HeartbeatStatus
if (-not $status -or -not $status.ok) {
  Write-Host 'Heartbeat is missing/stale/degraded. Restarting the existing scheduled task once...'
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($task) {
    try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
    Start-Sleep -Seconds 2
    Start-ScheduledTask -TaskName $TaskName
  }

  $deadline = (Get-Date).AddSeconds(60)
  do {
    Start-Sleep -Seconds 3
    $status = Get-HeartbeatStatus
  } while ((-not $status -or -not $status.ok) -and (Get-Date) -lt $deadline)
}

if (-not $status -or -not $status.ok) {
  $log = Join-Path $StateDir 'guarded-worker.log'
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
  Write-Host ''
  Write-Host 'WORKER RECOVERY FAILED'
  if ($task) { Write-Host ('Task state: ' + $task.State) }
  if ($info) { Write-Host ('LastTaskResult: ' + $info.LastTaskResult) }
  if ($status -and $status.value) {
    Write-Host ('Heartbeat: ' + ($status.value | ConvertTo-Json -Compress))
  } else {
    Write-Host 'Heartbeat: missing'
  }
  if (Test-Path $log) {
    Write-Host '--- guarded-worker.log (last 100 lines) ---'
    Get-Content $log -Tail 100 | ForEach-Object { Write-Host $_ }
    Write-Host '--- end log ---'
  }
  throw 'Worker is not operational. Diagnostic details are printed above.'
}

Write-Host ('Worker heartbeat OK; age ' + [math]::Round($status.age,1) + 's.')

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

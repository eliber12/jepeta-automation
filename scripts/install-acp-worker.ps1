$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AgentId = '01a0b446-374c-7eb8-8fe8-cd1a9945ea70'
$TaskName = 'Jepeta Risk Guard'
$LegacyTask = 'JepetaRiskGuardACPWorker'
$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$ActiveAppFile = Join-Path $StateDir 'active-app.txt'
$Zip = Join-Path $env:TEMP ('jepeta-automation-main-' + [guid]::NewGuid().ToString('N') + '.zip')
$Extract = Join-Path $env:TEMP ('jepeta-automation-' + [guid]::NewGuid().ToString('N'))
$AppDir = Join-Path $env:LOCALAPPDATA ('JepetaRiskGuardApp-' + (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))

Write-Host 'Jepeta Risk Guard - guarded ACP worker installer'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is not installed or not in PATH.' }
if (-not (Get-Command acp -ErrorAction SilentlyContinue)) { throw 'ACP CLI is not installed or not in PATH.' }

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null


# Pause new marketplace intake before touching the live worker. Existing funded
# jobs remain in the durable StateDir journal and are reconciled after restart.
try {
  & acp agent use --agent-id $AgentId --json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'provider selection failed' }
  $offers = @((& acp offering list --json | Out-String | ConvertFrom-Json))
  $currentOffer = $offers | Where-Object { $_.id -eq '01a0b464-2334-7c1b-a88e-467c77d83327' } | Select-Object -First 1
  if ($currentOffer -and $currentOffer.isHidden -eq $false) {
    & acp offering update --offering-id '01a0b464-2334-7c1b-a88e-467c77d83327' --hidden --json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'offering pause failed' }
    Write-Host 'Marketplace intake paused for safe worker upgrade.'
  }
} catch {
  throw 'Could not safely pause marketplace intake before upgrade. Existing worker was left untouched.'
}

# Stop/remove previous Jepeta tasks. We deliberately DO NOT delete the previous
# code directory because Windows may still have that directory as a process CWD.
foreach ($name in @($LegacyTask, $TaskName)) {
  $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if ($task) {
    try { Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue } catch {}
    Start-Sleep -Milliseconds 500
    Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  }
}

# Stop only Jepeta worker processes; never touch unrelated Node/PowerShell sessions.
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'JepetaRiskGuardApp.*worker\\run\.mjs|acp-worker\.mjs') -or
    ($_.Name -eq 'powershell.exe' -and $_.CommandLine -match 'JepetaRiskGuardApp.*scripts\\run-live\.ps1')
  } |
  ForEach-Object { try { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null } catch {} }

# Remove heartbeat so only the NEW worker can prove readiness.
$Heartbeat = Join-Path $StateDir 'heartbeat.json'
Remove-Item $Heartbeat -Force -ErrorAction SilentlyContinue

# Download a clean snapshot of main into a UNIQUE deployment directory.
Invoke-WebRequest 'https://github.com/eliber12/jepeta-automation/archive/refs/heads/main.zip' -OutFile $Zip -UseBasicParsing
Expand-Archive -Path $Zip -DestinationPath $Extract -Force
$Source = Join-Path $Extract 'jepeta-automation-main'
if (-not (Test-Path (Join-Path $Source 'worker\run.mjs'))) { throw 'Downloaded package is incomplete.' }

Move-Item $Source $AppDir
if (-not (Test-Path (Join-Path $AppDir 'scripts\run-live.ps1'))) { throw 'Versioned deployment is incomplete.' }

Set-Location $AppDir
& node --test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed. Guarded worker was not installed.' }

# Keep the already authenticated provider agent active.
& acp agent use --agent-id $AgentId | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Could not select Jepeta Risk Guard in ACP.' }

$Runner = Join-Path $AppDir 'scripts\run-live.ps1'
$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $Runner + '"') -WorkingDirectory $AppDir
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description 'Guarded Jepeta Risk Guard ACP provider worker' -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

# Prove the NEW worker reached the live loop.
$deadline = (Get-Date).AddSeconds(90)
$ok = $false
do {
  Start-Sleep -Seconds 3
  if (Test-Path $Heartbeat) {
    try {
      $hb = Get-Content $Heartbeat -Raw | ConvertFrom-Json
      $age = ((Get-Date).ToUniversalTime() - ([datetime]$hb.at).ToUniversalTime()).TotalSeconds
      if ($hb.live -eq $true -and $age -lt 30) { $ok = $true }
    } catch {}
  }
} while (-not $ok -and (Get-Date) -lt $deadline)

if (-not $ok) {
  $log = Join-Path $StateDir 'guarded-worker.log'
  throw "Guarded worker did not publish a fresh live heartbeat. Check $log"
}

# Mark this immutable deployment as the active code only AFTER live proof.
Set-Content -Path $ActiveAppFile -Value $AppDir -Encoding ASCII

# Best-effort cleanup of temp download only. Old versioned app dirs are harmless
# and can be cleaned later when no process holds them.
Remove-Item $Zip -Force -ErrorAction SilentlyContinue
Remove-Item $Extract -Recurse -Force -ErrorAction SilentlyContinue

$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host ''
Write-Host 'GUARDED ACP WORKER READY'
Write-Host "Task: $TaskName"
Write-Host "State: $($task.State)"
Write-Host "LastTaskResult: $($info.LastTaskResult)"
Write-Host "Deployment: $AppDir"
Write-Host "Heartbeat: $Heartbeat"
Write-Host "Log: $(Join-Path $StateDir 'guarded-worker.log')"
Write-Host 'Offering remains hidden until the public pilot gate is opened.'

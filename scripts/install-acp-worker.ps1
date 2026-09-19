$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AgentId = '01a0b446-374c-7eb8-8fe8-cd1a9945ea70'
$TaskName = 'Jepeta Risk Guard'
$LegacyTask = 'JepetaRiskGuardACPWorker'
$StateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$AppDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuardApp'
$Zip = Join-Path $env:TEMP 'jepeta-automation-main.zip'
$Extract = Join-Path $env:TEMP ('jepeta-automation-' + [guid]::NewGuid().ToString('N'))

Write-Host 'Jepeta Risk Guard - guarded ACP worker installer'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is not installed or not in PATH.' }
if (-not (Get-Command acp -ErrorAction SilentlyContinue)) { throw 'ACP CLI is not installed or not in PATH.' }

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

# Stop/remove the earlier experimental worker if present.
foreach ($name in @($LegacyTask, $TaskName)) {
  $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if ($task) {
    try { Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue } catch {}
    Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  }
}

# Stop only Jepeta worker Node processes; do not touch unrelated Node processes.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'acp-worker\.mjs|JepetaRiskGuardApp.*worker\\run\.mjs' } |
  ForEach-Object { try { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null } catch {} }

# Download a clean snapshot of the public main branch.
Remove-Item $Zip -Force -ErrorAction SilentlyContinue
Remove-Item $Extract -Recurse -Force -ErrorAction SilentlyContinue
Invoke-WebRequest 'https://github.com/eliber12/jepeta-automation/archive/refs/heads/main.zip' -OutFile $Zip -UseBasicParsing
Expand-Archive -Path $Zip -DestinationPath $Extract -Force
$Source = Join-Path $Extract 'jepeta-automation-main'
if (-not (Test-Path (Join-Path $Source 'worker\run.mjs'))) { throw 'Downloaded package is incomplete.' }

# Replace app code only. Financial journal/state is in StateDir and is preserved.
# The installer may itself be launched while the shell's current directory is AppDir.
# Windows cannot remove/move over the current working directory, so leave it first.
Set-Location $env:TEMP

for ($attempt = 1; $attempt -le 5 -and (Test-Path $AppDir); $attempt++) {
  Remove-Item $AppDir -Recurse -Force -ErrorAction SilentlyContinue
  if (Test-Path $AppDir) { Start-Sleep -Seconds 2 }
}
if (Test-Path $AppDir) { throw "Could not replace $AppDir because it is still in use. Close any Explorer/terminal window rooted there and retry." }

Move-Item $Source $AppDir

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

# Prove that the guarded worker actually reached its live loop.
$Heartbeat = Join-Path $StateDir 'heartbeat.json'
$deadline = (Get-Date).AddSeconds(90)
$ok = $false
do {
  Start-Sleep -Seconds 3
  if (Test-Path $Heartbeat) {
    try {
      $hb = Get-Content $Heartbeat -Raw | ConvertFrom-Json
      $age = ((Get-Date).ToUniversalTime() - ([datetime]$hb.at).ToUniversalTime()).TotalSeconds
      if ($hb.live -eq $true -and $age -lt 90) { $ok = $true }
    } catch {}
  }
} while (-not $ok -and (Get-Date) -lt $deadline)

if (-not $ok) {
  $log = Join-Path $StateDir 'guarded-worker.log'
  throw "Guarded worker did not publish a live heartbeat. Check $log"
}

$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host ''
Write-Host 'GUARDED ACP WORKER READY'
Write-Host "Task: $TaskName"
Write-Host "State: $($task.State)"
Write-Host "LastTaskResult: $($info.LastTaskResult)"
Write-Host "Heartbeat: $Heartbeat"
Write-Host "Log: $(Join-Path $StateDir 'guarded-worker.log')"
Write-Host 'Offering remains hidden until a paid E2E settlement is verified.'

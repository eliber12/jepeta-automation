$ErrorActionPreference = "Stop"

$AgentId = "01a0b446-374c-7eb8-8fe8-cd1a9945ea70"
$Root = Join-Path $env:LOCALAPPDATA "JepetaRiskGuard"
$Worker = Join-Path $Root "acp-worker.mjs"
$Lib = Join-Path $Root "acp-worker-lib.mjs"
$TaskName = "JepetaRiskGuardACPWorker"

Write-Host "Jepeta Risk Guard - ACP Worker installer"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not installed or not in PATH." }
if (-not (Get-Command acp -ErrorAction SilentlyContinue)) { throw "ACP CLI is not installed or not in PATH." }

acp agent use --agent-id $AgentId | Out-Host
acp agent whoami --json | Out-Null

New-Item -ItemType Directory -Force -Path $Root | Out-Null
$Base = "https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts"
Invoke-WebRequest "$Base/acp-worker.mjs" -OutFile $Worker -UseBasicParsing
Invoke-WebRequest "$Base/acp-worker-lib.mjs" -OutFile $Lib -UseBasicParsing

$Node = (Get-Command node).Source
$Action = New-ScheduledTaskAction -Execute $Node -Argument ('"' + $Worker + '"')
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Jepeta Risk Guard ACP provider worker" -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Start-Sleep -Seconds 3
$Task = Get-ScheduledTask -TaskName $TaskName
$Info = Get-ScheduledTaskInfo -TaskName $TaskName

Write-Host ""
Write-Host "Installed: $TaskName"
Write-Host "State: $($Task.State)"
Write-Host "LastTaskResult: $($Info.LastTaskResult)"
Write-Host "Log: $(Join-Path $Root 'worker.log')"
Write-Host ""
Write-Host "IMPORTANT: this computer must remain powered on and logged in for ACP job processing."

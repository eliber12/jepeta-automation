$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$log = Join-Path $stateDir 'guarded-worker.log'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

("[{0}] run-live starting: {1}" -f (Get-Date).ToUniversalTime().ToString('o'), $root) | Add-Content -Path $log

$keepAwakeEnabled = $false
try {
  # Keep the provider host awake while a five-minute SLA is advertised.
  # This is best-effort only and MUST NEVER prevent the ACP worker from starting.
  try {
    if (-not ('JepetaPowerState' -as [type])) {
      Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class JepetaPowerState {
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern uint SetThreadExecutionState(uint esFlags);
}
'@
    }

    # Convert from hex text instead of casting a signed PowerShell hex literal.
    # This is compatible with Windows PowerShell 5.1 used by Scheduled Tasks.
    $ES_CONTINUOUS = [Convert]::ToUInt32('80000000', 16)
    $ES_SYSTEM_REQUIRED = [uint32]1
    $flags = [uint32]($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
    $previous = [JepetaPowerState]::SetThreadExecutionState($flags)

    if ($previous -eq 0) {
      ("[{0}] WARNING: Windows keep-awake request returned 0; worker will still start." -f (Get-Date).ToUniversalTime().ToString('o')) | Add-Content -Path $log
    } else {
      $keepAwakeEnabled = $true
      ("[{0}] Windows keep-awake enabled." -f (Get-Date).ToUniversalTime().ToString('o')) | Add-Content -Path $log
    }
  } catch {
    ("[{0}] WARNING: keep-awake setup failed but is non-fatal: {1}" -f (Get-Date).ToUniversalTime().ToString('o'), $_.Exception.Message) | Add-Content -Path $log
  }

  Set-Location $root
  & (Join-Path $PSScriptRoot 'start-jepeta.ps1') -Live *>> $log
  $code = $LASTEXITCODE
  ("[{0}] start-jepeta exited with code {1}" -f (Get-Date).ToUniversalTime().ToString('o'), $code) | Add-Content -Path $log
  exit $code
} catch {
  ("[{0}] FATAL run-live: {1}" -f (Get-Date).ToUniversalTime().ToString('o'), ($_ | Out-String)) | Add-Content -Path $log
  exit 1
} finally {
  if ($keepAwakeEnabled -and ('JepetaPowerState' -as [type])) {
    try {
      $ES_CONTINUOUS = [Convert]::ToUInt32('80000000', 16)
      [void][JepetaPowerState]::SetThreadExecutionState($ES_CONTINUOUS)
    } catch {}
  }
}

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$log = Join-Path $stateDir 'guarded-worker.log'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

# Keep the provider host awake while a five-minute SLA is advertised.
# This prevents automatic Windows sleep; it does not prevent shutdown,
# manual sleep, power loss, or internet loss.
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
$ES_CONTINUOUS = [uint32]0x80000000
$ES_SYSTEM_REQUIRED = [uint32]0x00000001
$powerState = [JepetaPowerState]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
if ($powerState -eq 0) {
  'WARNING: Windows keep-awake request failed; verify Sleep is disabled while the ACP worker is public.' | Add-Content -Path $log
}

Set-Location $root
try {
  & (Join-Path $PSScriptRoot 'start-jepeta.ps1') -Live *>> $log
  exit $LASTEXITCODE
} catch {
  ($_ | Out-String) | Add-Content -Path $log
  exit 1
} finally {
  [void][JepetaPowerState]::SetThreadExecutionState($ES_CONTINUOUS)
}

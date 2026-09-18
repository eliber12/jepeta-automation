$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $env:LOCALAPPDATA 'JepetaRiskGuard'
$log = Join-Path $stateDir 'guarded-worker.log'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
Set-Location $root
try {
  & (Join-Path $PSScriptRoot 'start-jepeta.ps1') -Live *>> $log
  exit $LASTEXITCODE
} catch {
  ($_ | Out-String) | Add-Content -Path $log
  exit 1
}

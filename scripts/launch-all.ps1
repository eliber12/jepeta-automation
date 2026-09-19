param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host 'Jepeta launch-all now uses the guarded public-commerce path.'
Write-Host 'No owner-funded buyer is required for launch.'
Set-Location $env:TEMP

$url = 'https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts/upgrade-agent-ready.ps1'
$script = (Invoke-WebRequest $url -UseBasicParsing).Content
Invoke-Expression $script

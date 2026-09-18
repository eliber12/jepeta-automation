param([switch]$Live, [switch]$InstallAutoStart, [switch]$AuthorizeSigner)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
try {
    $root = Split-Path -Parent $PSScriptRoot
    Set-Location $root
    $node = (Get-Command node -ErrorAction Stop).Source
    $acpCommand = Get-Command acp -ErrorAction Stop
    $packageDir = Join-Path (Split-Path $acpCommand.Source -Parent) 'node_modules\@virtuals-protocol\acp-cli'
    $packageFile = Join-Path $packageDir 'package.json'
    if (-not (Test-Path $packageFile)) { throw 'Cannot find the existing ACP installation beside the acp command.' }
    $package = Get-Content $packageFile -Raw | ConvertFrom-Json
    if ($package.bin -is [string]) { $bin = $package.bin } else { $bin = $package.bin.acp }
    $env:JEPETA_ACP_ENTRY = Join-Path $packageDir $bin
    if (-not (Test-Path $env:JEPETA_ACP_ENTRY)) { throw 'ACP JavaScript entry is missing.' }
    & $node --test
    if ($LASTEXITCODE -ne 0) { throw 'Local tests failed; no worker started.' }
    & $node $env:JEPETA_ACP_ENTRY agent use --agent-id 01a0b446-374c-7eb8-8fe8-cd1a9945ea70 --json
    if ($LASTEXITCODE -ne 0) { throw 'Existing ACP authentication is unavailable. No new account was created.' }
    if ($AuthorizeSigner) {
        & $node $env:JEPETA_ACP_ENTRY agent add-signer --agent-id 01a0b446-374c-7eb8-8fe8-cd1a9945ea70 --policy restricted
        if ($LASTEXITCODE -ne 0) { throw 'Local signer approval was not completed.' }
    }
    & $node (Join-Path $root 'worker\run.mjs') doctor
    if ($LASTEXITCODE -ne 0) { throw 'ACP preflight failed. A website-created signer may not be linked to this computer. Do not paste a private key into chat.' }
    if ($Live) {
        Write-Host 'Live provider signatures enabled. Buyer funding/approval stay manual. Overall approved budget: $7.50.'
        $env:JEPETA_CHAIN_FEES_APPROVED = 'true'
    }
    if ($InstallAutoStart) {
        $arguments = '-NoProfile -File "' + $PSCommandPath + '"'
        if ($Live) { $arguments += ' -Live' }
        $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $root
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
        $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 25) -MultipleInstances IgnoreNew
        Register-ScheduledTask -TaskName 'Jepeta Risk Guard' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
        Write-Host 'Auto-start registered for your login. The PC must remain powered on and awake.'
    }
    if ($Live) { & $node (Join-Path $root 'worker\run.mjs') start --live }
    else { & $node (Join-Path $root 'worker\run.mjs') start }
    if ($LASTEXITCODE -ne 0) { throw 'Worker stopped with an error. Offering must remain hidden.' }
} catch {
    Write-Error $_
    exit 1
}

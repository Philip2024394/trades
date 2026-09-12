# install-nex-agent-scheduled-task.ps1
#
# NEX Agent Runtime · Windows Scheduled Task installer (PER-USER · NO ADMIN)
# Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Agent Runtime Phase B
#
# Registers a per-user Scheduled Task that runs
#   node scripts/nex-agents.mjs start all
# at each logon of the CURRENT user. Closes the logoff/reboot
# persistence gap identified in the Agent Runtime activation slice.
#
# WHY PER-USER (no admin):
# The existing walker installer at scripts/walkers/install-scheduled-task.ps1
# requires ADMIN elevation. This installer intentionally uses a per-user
# task so the Founder can install it in a normal PowerShell session.
#
# LIMITATIONS (truth over green):
# - Per-user task fires at LOGON — a reboot with auto-logon disabled
#   will NOT bring the daemons back until the user logs in.
# - Task does NOT survive a user account deletion.
# - For always-on operation across all sessions, an admin-installed
#   system-context task (or Windows Service) is required — out of scope.

param(
    [switch]$WhatIf = $false,
    [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

if ($RepoRoot -eq "") {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}
if (-not (Test-Path (Join-Path $RepoRoot "package.json"))) {
    Write-Error "Cannot find package.json under RepoRoot '$RepoRoot'."
    exit 2
}

$taskName = "NEX-Agent-Runtime-User"
$user = "$env:USERDOMAIN\$env:USERNAME"

$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    Write-Error "node.exe not on PATH. Install Node.js or add it to PATH."
    exit 3
}

$entryScript = Join-Path $RepoRoot "scripts\nex-agents.mjs"
if (-not (Test-Path $entryScript)) {
    Write-Error "Cannot find $entryScript."
    exit 4
}

$logDir = Join-Path $RepoRoot "data\nex-agent-runtime"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$launchLog = Join-Path $logDir "scheduled-task-launch.log"

$commandLine = '"' + $nodePath + '" "' + $entryScript + '" start all >> "' + $launchLog + '" 2>&1'

Write-Host ""
Write-Host "NEX Agent Runtime - Scheduled Task installer" -ForegroundColor Cyan
Write-Host "  Task name : $taskName"
Write-Host "  User      : $user"
Write-Host "  Runs      : node scripts\nex-agents.mjs start all"
Write-Host "  Trigger   : At logon of $user"
Write-Host "  Log       : $launchLog"
Write-Host "  RepoRoot  : $RepoRoot"
Write-Host ""

if ($WhatIf) {
    Write-Host "-- WhatIf mode - no changes made --" -ForegroundColor Yellow
    exit 0
}

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing prior task '$taskName'..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $commandLine" -WorkingDirectory $RepoRoot

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$trigger.Delay = "PT30S"

$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

$settingsParams = @{
    AllowStartIfOnBatteries = $true
    DontStopIfGoingOnBatteries = $true
    StartWhenAvailable = $true
    RestartCount = 5
    RestartInterval = (New-TimeSpan -Minutes 1)
    ExecutionTimeLimit = (New-TimeSpan -Days 365)
    MultipleInstances = "IgnoreNew"
}
$settings = New-ScheduledTaskSettingsSet @settingsParams

$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "NEX Agent Runtime - per-user daemon startup at logon - founder-authorized Phase B"

Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null

$verify = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $verify) {
    Write-Error "Registration verification FAILED - Get-ScheduledTask returned null."
    exit 5
}
Write-Host "Registered task '$taskName'." -ForegroundColor Green
Write-Host "  State  : $($verify.State)"
Write-Host ""
Write-Host "Verify:  Get-ScheduledTask -TaskName $taskName" -ForegroundColor Cyan
Write-Host "Test run without logon: Start-ScheduledTask -TaskName $taskName"
Write-Host "Uninstall: powershell -File scripts\uninstall-nex-agent-scheduled-task.ps1"

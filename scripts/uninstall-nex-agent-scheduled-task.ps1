# uninstall-nex-agent-scheduled-task.ps1
#
# NEX Agent Runtime · Windows Scheduled Task uninstaller
# Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Agent Runtime Phase B
#
# Removes the per-user task installed by install-nex-agent-scheduled-task.ps1.
# Does NOT touch any admin-installed system tasks.

$ErrorActionPreference = "Stop"

$taskName = "NEX-Agent-Runtime-User"
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $existing) {
    Write-Host "No task '$taskName' registered for this user. Nothing to do." -ForegroundColor Yellow
    exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "Removed task '$taskName'." -ForegroundColor Green

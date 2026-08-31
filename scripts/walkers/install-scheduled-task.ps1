# install-scheduled-task.ps1
#
# Registers a per-user Windows Scheduled Task that runs the NEX
# Outer Watchdog at boot AND at user logon. No admin required —
# runs under the invoking user's context.
#
# The task will:
#   · Start automatically at boot (via cmd /c timeout + start)
#   · Restart the outer watchdog if it exits (Task Scheduler retry)
#   · Log to data\indonesia\watchdog-incidents.jsonl
#
# Usage (in PowerShell, no admin):
#   pwsh -ExecutionPolicy Bypass -File scripts\walkers\install-scheduled-task.ps1
#
# To uninstall:
#   pwsh -ExecutionPolicy Bypass -File scripts\walkers\install-scheduled-task.ps1 -Uninstall
#
# To see status:
#   Get-ScheduledTask -TaskName 'NEX-Walker-Watchdog'
#
# To trigger manually:
#   Start-ScheduledTask -TaskName 'NEX-Walker-Watchdog'
#
# To stop it:
#   Stop-ScheduledTask -TaskName 'NEX-Walker-Watchdog'

param(
    [switch]$Uninstall
)

$TaskName = 'NEX-Walker-Watchdog'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogPath = Join-Path $RepoRoot 'data\indonesia\watchdog-scheduled-task.log'

if ($Uninstall) {
    Write-Host "Removing scheduled task '$TaskName'..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Done."
    return
}

Write-Host "Installing NEX Walker Outer Watchdog scheduled task..."
Write-Host "  Repo root: $RepoRoot"
Write-Host "  Log path:  $LogPath"

# Elevation check · Register-ScheduledTask requires Admin on Windows,
# even when the task runs as the current user. Fail loudly rather than
# print a misleading 'Installed' message after a permission-denied error.
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host ""
    Write-Host "ERROR: This installer requires an ELEVATED PowerShell (Run as Administrator)." -ForegroundColor Red
    Write-Host "  Windows Task Scheduler refuses task registration without Admin, even when"
    Write-Host "  the task itself runs under your user account."
    Write-Host ""
    Write-Host "How to fix:" -ForegroundColor Yellow
    Write-Host "  1. Close this window."
    Write-Host "  2. Right-click Windows Terminal / PowerShell → 'Run as administrator'."
    Write-Host "  3. cd '$RepoRoot'"
    Write-Host "  4. pwsh -ExecutionPolicy Bypass -File scripts\walkers\install-scheduled-task.ps1"
    exit 1
}

$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c cd /d `"$RepoRoot`" && npm run workforce:watchdog >> `"$LogPath`" 2>&1" `
    -WorkingDirectory $RepoRoot

# Trigger 1: at user logon
$LogonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Trigger 2: at system boot (with a small delay so services are up)
$BootTrigger = New-ScheduledTaskTrigger -AtStartup
$BootTrigger.Delay = 'PT30S'

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 365)

$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

$Task = New-ScheduledTask `
    -Action $Action `
    -Trigger @($LogonTrigger, $BootTrigger) `
    -Settings $Settings `
    -Principal $Principal `
    -Description "NEX Indonesia Knowledge Workforce · outer watchdog. Keeps the walker supervisor alive across process crashes and machine reboots."

try {
    Register-ScheduledTask -TaskName $TaskName -InputObject $Task -Force -ErrorAction Stop | Out-Null
} catch {
    Write-Host ""
    Write-Host "ERROR: Register-ScheduledTask failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Installed. The watchdog will start automatically at boot and at user logon." -ForegroundColor Green
Write-Host ""
Write-Host "Verify:      Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host "Trigger now: Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Stop:        Stop-ScheduledTask -TaskName '$TaskName'"
Write-Host "Uninstall:   pwsh -File scripts\walkers\install-scheduled-task.ps1 -Uninstall"

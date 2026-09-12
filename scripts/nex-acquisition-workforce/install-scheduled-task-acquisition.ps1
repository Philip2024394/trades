# install-scheduled-task-acquisition.ps1
#
# Registers a per-user Windows Scheduled Task that runs the NEX Acquisition
# Workforce Launcher at boot AND at user logon. No terminal required.
# Requires an ELEVATED PowerShell (Run as Administrator) — Windows Task
# Scheduler refuses task registration without Admin, even when the task
# itself runs under the current user's context.
#
# The task will:
#   · Start automatically at boot (30s delay so services are up)
#   · Start automatically at user logon
#   · Restart the launcher if it exits (RestartCount 999, 1-minute interval)
#   · Log to data\nex-acquisition-workforce\scheduled-task.log
#
# Usage:
#   pwsh -ExecutionPolicy Bypass -File scripts\nex-acquisition-workforce\install-scheduled-task-acquisition.ps1
#
# To uninstall:
#   pwsh -ExecutionPolicy Bypass -File scripts\nex-acquisition-workforce\install-scheduled-task-acquisition.ps1 -Uninstall
#
# To see status:
#   Get-ScheduledTask -TaskName 'NEX-Acquisition-Workforce' | Get-ScheduledTaskInfo
#
# To trigger manually:
#   Start-ScheduledTask -TaskName 'NEX-Acquisition-Workforce'
#
# To stop it:
#   Stop-ScheduledTask -TaskName 'NEX-Acquisition-Workforce'

param(
    [switch]$Uninstall
)

$TaskName = 'NEX-Acquisition-Workforce'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogPath  = Join-Path $RepoRoot 'data\nex-acquisition-workforce\scheduled-task.log'
$LauncherRelative = 'scripts\nex-acquisition-workforce\run-production-launcher.mjs'

if ($Uninstall) {
    Write-Host "Removing scheduled task '$TaskName'..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Done."
    return
}

Write-Host "Installing NEX Acquisition Workforce scheduled task..."
Write-Host "  Repo root: $RepoRoot"
Write-Host "  Log path:  $LogPath"
Write-Host "  Launcher:  $LauncherRelative"

# Elevation check
$identity  = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
$isAdmin   = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host ""
    Write-Host "ERROR: This installer requires an ELEVATED PowerShell (Run as Administrator)." -ForegroundColor Red
    Write-Host "  Windows Task Scheduler refuses task registration without Admin, even when"
    Write-Host "  the task itself runs under your user account."
    Write-Host ""
    Write-Host "How to fix:" -ForegroundColor Yellow
    Write-Host "  1. Close this window."
    Write-Host "  2. Right-click Windows Terminal / PowerShell -> 'Run as administrator'."
    Write-Host "  3. cd '$RepoRoot'"
    Write-Host "  4. pwsh -ExecutionPolicy Bypass -File $LauncherRelative"
    exit 1
}

# Ensure log directory exists
$LogDir = Split-Path -Parent $LogPath
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c cd /d `"$RepoRoot`" && node $LauncherRelative >> `"$LogPath`" 2>&1" `
    -WorkingDirectory $RepoRoot

# Trigger 1: at user logon
$LogonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Trigger 2: at system boot (delay so services are up)
$BootTrigger = New-ScheduledTaskTrigger -AtStartup
$BootTrigger.Delay = 'PT30S'

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 365)

$TaskPrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

$Task = New-ScheduledTask `
    -Action $Action `
    -Trigger @($LogonTrigger, $BootTrigger) `
    -Settings $Settings `
    -Principal $TaskPrincipal `
    -Description "NEX Acquisition Workforce · production launcher. Continuously spawns business-acquisition category walker cycles. Independent from System A (NEX-Walker-Watchdog · taxonomy workforce)."

try {
    Register-ScheduledTask -TaskName $TaskName -InputObject $Task -Force -ErrorAction Stop | Out-Null
} catch {
    Write-Host ""
    Write-Host "ERROR: Register-ScheduledTask failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Installed. The acquisition workforce will start automatically at boot and at user logon." -ForegroundColor Green
Write-Host ""
Write-Host "Verify:      Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host "Trigger now: Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Stop:        Stop-ScheduledTask -TaskName '$TaskName'"
Write-Host "Uninstall:   pwsh -File scripts\nex-acquisition-workforce\install-scheduled-task-acquisition.ps1 -Uninstall"

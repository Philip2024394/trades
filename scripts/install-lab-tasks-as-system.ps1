# scripts/install-lab-tasks-as-system.ps1
#
# Founder 2026-09-10 · Upgrade NEX Lab scheduled tasks to run under SYSTEM
# principal. SYSTEM tasks:
#   * Survive user logoff (Interactive tasks die at logoff)
#   * Survive Windows restart (start at boot, not at user logon)
#   * Do NOT require a stored user password
#
# MUST BE RUN FROM AN ELEVATED (Administrator) PowerShell prompt.
# Right-click PowerShell → "Run as Administrator" → then execute this script.
#
# Verify elevation before running:
#   ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
#
# What this script does (idempotent · safe to re-run):
#   1. Recreates the four Lab scheduled tasks with /RU SYSTEM /RL HIGHEST
#   2. Keeps the same cadences the user-level tasks had
#   3. Adds ONLOGON + ONSTART triggers where appropriate for reboot survival
#
# What this script does NOT do:
#   - Does not touch the DAEMON PID · running processes keep running
#   - Does not touch data · zero DB changes
#   - Does not remove the user-level equivalents · admin should manually remove
#     the old Victus-owned tasks after verifying SYSTEM tasks fire correctly

$ErrorActionPreference = "Stop"

function Assert-Admin {
  $current = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal $current
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script MUST be run from an elevated (Administrator) PowerShell prompt." -ForegroundColor Red
    Write-Host "Right-click PowerShell, choose 'Run as Administrator', then re-run this script." -ForegroundColor Red
    exit 1
  }
  Write-Host "OK: running as Administrator" -ForegroundColor Green
}

function Recreate-SystemTask {
  param(
    [string]$Name,
    [string]$Wrapper,
    [int]   $EveryMinutes,   # 0 = ONSTART only, otherwise minute cadence
    [bool]  $OnLogon = $false
  )
  Write-Host ("Registering {0} · every {1} min · logon={2} · wrapper={3}" -f $Name, $EveryMinutes, $OnLogon, $Wrapper)
  # Remove existing task with same name (SYSTEM or user-owned)
  schtasks /Delete /TN $Name /F 2>$null | Out-Null
  # Build the create command
  $args = @("/Create", "/TN", $Name, "/TR", "`"$Wrapper`"", "/RU", "SYSTEM", "/RL", "HIGHEST", "/F")
  if ($EveryMinutes -gt 0) {
    $args += @("/SC", "MINUTE", "/MO", "$EveryMinutes")
  } else {
    $args += @("/SC", "ONSTART")
  }
  & schtasks.exe @args
  # If we also want an ONLOGON trigger, register a companion task
  if ($OnLogon) {
    $companion = "$Name-OnLogon"
    schtasks /Delete /TN $companion /F 2>$null | Out-Null
    & schtasks.exe /Create /TN $companion /TR "`"$Wrapper`"" /RU SYSTEM /RL HIGHEST /F /SC ONLOGON
  }
}

Assert-Admin

$Repo = "C:\Users\Victus\trades"

# Watchdog · every 2 minutes · MUST fire regardless of who is logged in
Recreate-SystemTask -Name "NEX-Lab-Harvest-Continuous-Watchdog" `
                    -Wrapper "$Repo\scripts\_wrappers\run-harvest-watchdog.cmd" `
                    -EveryMinutes 2 -OnLogon $true

# Cross-source promoter · every 30 minutes
Recreate-SystemTask -Name "NEX-Lab-Promote-Cross-Source" `
                    -Wrapper "$Repo\scripts\_wrappers\run-lab-promote.cmd" `
                    -EveryMinutes 30

# Verifier · every 20 minutes
Recreate-SystemTask -Name "NEX-Lab-Verify" `
                    -Wrapper "$Repo\scripts\_wrappers\run-lab-verify.cmd" `
                    -EveryMinutes 20

# Nominatim harvester · every 15 minutes (respects 1 req/sec policy)
Recreate-SystemTask -Name "NEX-Lab-Nominatim" `
                    -Wrapper "$Repo\scripts\_wrappers\run-lab-nominatim.cmd" `
                    -EveryMinutes 15

# Freshness-decay · daily at 03:15
Write-Host "Registering NEX-Lab-Freshness-Decay · daily 03:15 · SYSTEM"
schtasks /Delete /TN "NEX-Lab-Freshness-Decay" /F 2>$null | Out-Null
schtasks /Create /TN "NEX-Lab-Freshness-Decay" `
  /TR "`"$Repo\scripts\_wrappers\run-lab-freshness-decay.cmd`"" `
  /RU SYSTEM /RL HIGHEST /F /SC DAILY /ST 03:15

Write-Host ""
Write-Host "SYSTEM-principal task installation complete." -ForegroundColor Green
Write-Host ""
Write-Host "VERIFY with:" -ForegroundColor Yellow
Write-Host "  schtasks /query /tn '\NEX-Lab-Harvest-Continuous-Watchdog' /fo LIST /v | Select-String -Pattern 'Run As User|Status|Next Run'"
Write-Host ""
Write-Host "SIDE EFFECT:" -ForegroundColor Yellow
Write-Host "  Old user-level (Victus) tasks with the same names have been REPLACED by SYSTEM tasks."
Write-Host "  If any Victus-only tasks remain that you no longer want, delete them manually."
Write-Host ""
Write-Host "After this: agents survive Windows logoff, reboot, and user switch. Watchdog task at 2min ensures the continuous harvester daemon is respawned within 2 min of any death."

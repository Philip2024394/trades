# NEX Lab · Upgrade scheduled tasks to SYSTEM principal

Currently every NEX Lab scheduled task runs under the `Victus` user account (Interactive session). This means:

- ✅ Tasks survive when the terminal / Claude window is closed
- ✅ Tasks survive when the browser is closed
- ❌ Tasks **die at Windows logoff**
- ❌ Tasks require the user to log back in after a reboot before they can fire

To make the lab truly bulletproof, upgrade the tasks to run under the `SYSTEM` principal. SYSTEM tasks fire regardless of user login state.

## Requirements

- An **elevated** (Administrator) PowerShell prompt on the machine that owns `C:\Users\Victus\trades`.
- The lab's wrapper `.cmd` files must exist at their known paths (they do — checked at install time).

## Procedure

1. Open PowerShell as Administrator: press `Win` → type `PowerShell` → right-click → **Run as Administrator**.
2. Change to the repo:
   ```powershell
   cd C:\Users\Victus\trades
   ```
3. Allow one-shot script execution for this session:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
   ```
4. Run the installer:
   ```powershell
   .\scripts\install-lab-tasks-as-system.ps1
   ```

The script is **idempotent** — safe to re-run. It replaces the following tasks with SYSTEM-principal equivalents:

| Task | Cadence | Trigger |
|---|---|---|
| `NEX-Lab-Harvest-Continuous-Watchdog` | every 2 min | + ONLOGON companion task |
| `NEX-Lab-Promote-Cross-Source` | every 30 min | |
| `NEX-Lab-Verify` | every 20 min | |
| `NEX-Lab-Nominatim` | every 15 min | |
| `NEX-Lab-Freshness-Decay` | daily 03:15 | |

## Verify success

After running the installer:

```powershell
schtasks /query /tn "\NEX-Lab-Harvest-Continuous-Watchdog" /fo LIST /v | Select-String -Pattern "Run As User|Status|Next Run"
```

Expected line: `Run As User: SYSTEM` (previously `Victus`).

## Optional single-command alternative (if you don't want to run the .ps1)

Register just the watchdog as SYSTEM, one line:

```powershell
schtasks /Create /TN "NEX-Lab-Harvest-Continuous-Watchdog" `
  /TR "C:\Users\Victus\trades\scripts\_wrappers\run-harvest-watchdog.cmd" `
  /SC MINUTE /MO 2 /RU SYSTEM /RL HIGHEST /F
```

Then repeat for the other four task names with the appropriate wrapper paths.

## What SYSTEM does NOT change

- Data source reachability: Overpass mirrors that were unreachable from your box remain unreachable. This is a network layer thing, orthogonal to principal.
- Postgres connection: SYSTEM must still be able to reach `localhost:5433/nex_dev` — it always can because it runs on the same host.
- Doctrine: nothing about `ADR-0022` / `ADR-0023` / `ADR-0033` changes.

## To roll back to user-level tasks

```powershell
schtasks /Delete /TN "\NEX-Lab-Harvest-Continuous-Watchdog" /F
schtasks /Create /TN "NEX-Lab-Harvest-Continuous-Watchdog" /TR "..." /SC MINUTE /MO 2 /F
# Repeat for the other tasks
```

## Why we can't do this from Claude Code

Claude Code runs as your user (`Victus`), not Administrator. Registering SYSTEM-principal scheduled tasks requires elevation. This is an OS security boundary, not a codebase limitation.

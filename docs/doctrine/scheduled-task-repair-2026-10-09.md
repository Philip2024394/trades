# Scheduled-task repair runbook · 2026-10-09

Author: Agent 7 of 10 (NEX Search Directory workstream)
Branch: `nex/directory-work`
Repo:   `D:\trades`

## Why this exists

On 2026-09-24 the NEX monorepo moved from `C:\Users\Victus\trades\` to
`D:\trades\`. Twenty-two Windows scheduled tasks (prefix `NEX-*`) still have
the old C: path baked into either their `Execute`, `Arguments`, or
`WorkingDirectory` fields, and the wrapper .cmd files they call also
`cd /d "C:\Users\Victus\trades"` internally.

Result: every task has been firing on schedule and silently failing with
Windows task result code `1` (Incorrect function / file-not-found) or
`2147942667` (`ERROR_INVALID_FUNCTION`), ever since the move. See
`data/scheduled-task-repair/inventory-pre-repair.csv` (captured 2026-10-09)
for the full before-state.

**Nothing is broken by this runbook itself** — it merely redirects the
tasks to the correct D-drive locations that already exist.

## Non-negotiable rules

1. The founder has NOT yet authorised execution. The script's default is
   DRY-RUN. **DO NOT** pass `-Apply` without explicit instruction.
2. **DO NOT** delete the original `C:\...` wrapper .cmd files, the old
   `C:\Users\Victus\trades` folder, or any task. This runbook adds, does
   not remove.
3. **DO NOT** edit `scripts/_wrappers/*.cmd` in place. The repair uses
   sibling `<name>.d-drive.cmd` copies instead.
4. No credentials go into any script, log, or XML backup.

## What has been authored (ready to inspect)

| Artefact | Path | Purpose |
|----------|------|---------|
| Repair script | `D:\trades\scripts\repair-scheduled-tasks.ps1` | Dry-run default · `-Apply` to execute · emits transcript |
| D-drive wrappers | `D:\trades\scripts\_wrappers\*.d-drive.cmd` (26 files) | Correct-root copies of every C-drive wrapper that had `cd /d "C:\Users\Victus\trades"` |
| Pre-repair inventory | `D:\trades\data\scheduled-task-repair\inventory-pre-repair.csv` | Snapshot of all 22 NEX-* tasks before any change |

## Why 26 wrappers (not 27)

`run-hidden.vbs` has no hardcoded repo path — it uses `WScript.Arguments(0)`.
Only the 26 `.cmd` siblings carry the old C: prefix inside their body, so
only they got a `.d-drive.cmd` sibling. Also note: `deploy\minio\start-minio.cmd`
is called directly by `NEX-MinIO-Server` (not through the `_wrappers/` dir)
and already references `D:\trades\deploy\minio\...` internally — no copy
needed.

## Principal policy

The script offers two policies, controlled by `-PrincipalPolicy`:

- **`KeepInteractive`** (default): no `Principal` change. Only paths get
  rewritten. Safest first step.
- **`S4U`**: moves background workers to `-LogonType S4U` so they survive
  logoff. Operator will be prompted once per task to re-type the
  Windows password for the `Victus` user; the script never stores it.

Classification (encoded in `$S4U_CANDIDATES` / `$STAY_INTERACTIVE` in the
script):

### Recommended for S4U (survive logoff · background workers)

- NEX-Agent-Runtime-User
- NEX-Harvest-OSM-Hourly
- NEX-HQ-Selfcheck
- NEX-Lab-Categoriser
- NEX-Lab-Clean
- NEX-Lab-Crawler-Router
- NEX-Lab-Directory-Crawler
- NEX-Lab-Email-Enricher
- NEX-Lab-Gov-Harvester
- NEX-Lab-Harvest
- NEX-Lab-Image-Wikimedia
- NEX-Lab-Instagram-Enricher
- NEX-Lab-News
- NEX-Lab-Quality-Agent
- NEX-Lab-Supervisor
- NEX-Lab-Wikidata
- NEX-Marketing-Import
- NEX-Master-AI-Supervisor
- NEX-Nightly-PG-Backup

### Stay Interactive (verified need, or unverified · defer)

- `NEX-Acquisition-Workforce` — "production launcher" semantics
  unverified; stay Interactive until confirmed background-safe.
- `NEX-Founder-Window-Probe` — name implies desktop/UI probe; stay
  Interactive.
- `NEX-MinIO-Server` — long-lived server with port-9000 health check,
  started by `start-minio.cmd` using `start "" /B`; S4U would complicate
  the "already running" detection pattern. Review separately.

## Step-by-step operator procedure

### Step 0 · Verify environment

```powershell
# Confirm repo location & branch
git -C D:\trades rev-parse HEAD
git -C D:\trades remote get-url origin   # must be Philip2024394/trades.git
git -C D:\trades branch --show-current   # must be nex/directory-work
```

### Step 1 · Dry-run (REQUIRED FIRST STEP)

```powershell
pwsh -NoProfile -File D:\trades\scripts\repair-scheduled-tasks.ps1
```

What you will see:
- A per-task diff of `Execute` / `Arguments` / `WorkingDirectory` showing
  current (C:) vs proposed (D:).
- Any `BLOCKED` tasks (should be zero — all 30 referenced binaries have
  been verified to exist on D:).
- A plan CSV and transcript under `D:\trades\data\scheduled-task-repair\`
  stamped with the UTC run id.

### Step 2 · Review the plan CSV

```powershell
# Replace <utc> with the stamp the dry-run printed
Import-Csv "D:\trades\data\scheduled-task-repair\plan-<utc>.csv" |
  Format-Table TaskName,ActionIdx,TouchesBrokenPath,Blocked -AutoSize
```

Spot-check a couple of entries manually:

```powershell
Get-ScheduledTask -TaskName 'NEX-Nightly-PG-Backup' | ForEach-Object { $_.Actions }
```

### Step 3 · Apply · path rewrites only (recommended first apply)

Only after founder sign-off:

```powershell
pwsh -NoProfile -File D:\trades\scripts\repair-scheduled-tasks.ps1 -Apply
```

This rewrites every C-drive path to D-drive and swaps wrapper arguments
to the `.d-drive.cmd` siblings. Principal is left Interactive. XML
backups of each task (pre-change) are written to
`D:\trades\data\scheduled-task-repair\xml-backup-<utc>\`.

### Step 4 · Verify the first live run of a safe task

Pick a short-running, side-effect-light task to re-run first:

```powershell
Start-ScheduledTask -TaskName 'NEX-HQ-Selfcheck'
Start-Sleep -Seconds 10
Get-ScheduledTaskInfo -TaskName 'NEX-HQ-Selfcheck' |
  Select-Object LastRunTime, LastTaskResult, NextRunTime
# Expect LastTaskResult = 0
Get-Content D:\trades\data\nex-lab\hq-selfcheck-task.log -Tail 20
```

### Step 5 · (Optional) Apply S4U policy

Only after Step 4 shows the path rewrites are healthy:

```powershell
pwsh -NoProfile -File D:\trades\scripts\repair-scheduled-tasks.ps1 `
     -Apply -PrincipalPolicy S4U
```

Windows will prompt once per S4U task for the `Victus` user's password.
The script never records or logs the password.

### Step 6 · Confirm overall health

```powershell
Get-ScheduledTask -TaskName 'NEX*' | ForEach-Object {
  $t = $_; $i = $_ | Get-ScheduledTaskInfo
  [PSCustomObject]@{
    Name       = $t.TaskName
    State      = $t.State
    LastRun    = $i.LastRunTime
    LastResult = $i.LastTaskResult
    LogonType  = $t.Principal.LogonType
  }
} | Sort-Object LastRun -Descending | Format-Table -AutoSize
```

Within the next trigger interval, every repaired task should flip from
`LastTaskResult = 1` to `LastTaskResult = 0`.

## Rollback

Each `-Apply` run writes two things to
`D:\trades\data\scheduled-task-repair\`:

1. `pre-apply-<utc>.csv` — the exact action/principal state before the
   change.
2. `xml-backup-<utc>\<TaskName>.xml` — a full `schtasks /query /XML`
   export for every task that was touched.

To restore any single task from backup XML:

```powershell
$taskName = 'NEX-Nightly-PG-Backup'
$xml = Get-Content "D:\trades\data\scheduled-task-repair\xml-backup-<utc>\$taskName.xml" -Raw
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Register-ScheduledTask    -TaskName $taskName -Xml $xml -User 'Victus'
# For S4U-era tasks replace -User 'Victus' with the appropriate principal
```

To restore every task at once, loop:

```powershell
Get-ChildItem "D:\trades\data\scheduled-task-repair\xml-backup-<utc>\*.xml" |
  ForEach-Object {
    $n = $_.BaseName
    $xml = Get-Content $_.FullName -Raw
    Unregister-ScheduledTask -TaskName $n -Confirm:$false -ErrorAction Continue
    Register-ScheduledTask    -TaskName $n -Xml $xml -User 'Victus'
  }
```

## Why wrapper files were duplicated instead of edited

Two reasons:

1. **The founder's rule**: do not move, rename, or delete without asking.
   Editing a wrapper in place would silently rewrite the same file that
   is still referenced by the live C-drive tasks (today's state). If the
   `Apply` step is deferred for any reason, the live tasks must continue
   to behave exactly as they do now — including still failing in exactly
   the same way. Changing the originals could partially fix some tasks
   before the schtasks `Arguments` are updated, producing an undefined
   half-state.
2. **Clean rollback**: with originals intact, rollback is pure
   schtasks-side — no wrapper rename or restore needed.

Future cleanup (removing the original C-drive wrappers) is explicitly
NOT part of this runbook. It belongs in a separate cleanup task after
all NEX tasks have run healthily on D: for at least one full week.

## Known limitations / things this runbook does NOT do

- Does not touch any task outside the `NEX-*` prefix.
- Does not change triggers, settings, hidden flags, or author metadata.
- Does not purge the old `C:\Users\Victus\trades\` folder.
- Does not re-enable disabled tasks. `NEX-Lab-Harvest` and
  `NEX-Acquisition-Workforce` are currently disabled and will remain
  disabled after repair until the operator re-enables them.
- Does not perform a dry-run `Start-ScheduledTask`. The repair fixes the
  stored action; the next real trigger will exercise it.

## Appendix · Verified D-drive targets

Every `Execute` binary and wrapper the tasks reference has been
`Test-Path`-verified on D: in the dry-run preparation phase (2026-10-09).
Zero `BLOCKED` rows. If a future task is added that points at a path not
yet on D:, the script's `MissingWrappers` / `MissingExecute` columns
will flag it and refuse to apply until it is resolved.

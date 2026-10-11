# NEX Directory · acquisition rotation runbook
_Pass 7 · 2026-10-12 · branch `nex/directory-work`_

## Why this exists

Pass 6 proved growth is reachable (+185 publications, 22,615 → 22,800) but
required a human to invoke `scripts/nex-acquisition/run-live-cycle.mjs`
and the cached-OSM-replay fallback by hand. This document hands over
the two pieces that let growth continue without that manual step:

1. `scripts/nex-acquisition/rotate-and-run-live-cycle.mjs` — one-shot
   runner that picks the next catalogued Indonesian city and invokes
   the sealed acquisition engine for it.
2. `.github/workflows/nex-acquisition-rotation.yml` — scheduled driver.

**The Vercel `nex-continuous-tick` cron entry (c16d9f67) does NOT run
the acquisition engine.** It fires a different code path (orchestrator
tick in `src/lib/nex/discovery-world/`). Leave it in place for its own
purpose; it is not the recurring driver for business discovery.

---

## 0 · Preconditions

- `D:/trades` repo clean and on branch `nex/directory-work`.
- `nex_dev` Postgres reachable at the connection string in `.env.local`
  (`host=localhost port=5433 db=nex_dev`).
- `nex.source_registry.can_display = TRUE` for `nex_food_business_legacy`
  (already true at pass 7 baseline).

Verification:

```sh
git -C /d/trades rev-parse HEAD
# → cb589f0f... or newer

node --env-file=.env.local -e "..." # one-row DB probe
```

---

## 1 · The rotation runner

Script: `scripts/nex-acquisition/rotate-and-run-live-cycle.mjs`.

Each invocation does ONE city:

1. Reads `data/nex-acquisition/city-rotation-cursor.json` (persistent
   state · created on first run).
2. Picks the next catalogued Indonesian city that is eligible:
   - never run, OR
   - last successful run older than `NEX_ROTATION_COOLDOWN_HOURS`
     (default 72), AND
   - not in exponential-backoff cooldown from a prior failure
     (backoff schedule: 1h → 2h → 4h → 8h).
3. Acquires a file lock at `data/nex-acquisition/rotation.lock`.
   Stale locks (> `NEX_ROTATION_LOCK_MAX_AGE_MIN`, default 90 min) are
   reclaimed · prevents a crashed-earlier run from blocking forever.
4. Spawns `node scripts/nex-acquisition/run-live-cycle.mjs
   --vertical=food --city=<picked> --apply`. The spawned engine inherits
   the host env (`NEX_POSTGRES_URL` + anything else the engine wants).
5. Records the outcome in the cursor:
   - success → `last_success_at` = now, `backoff_index` = 0
   - failure → bump `backoff_index`, set `next_eligible_at` = now +
     `BACKOFF_HOURS[backoff_index]` hours.
6. Writes the cursor and releases the lock.

**Dry-run mode** (`--dry-run`) prints the chosen city and exits
without invoking the engine OR mutating the cursor.

**Manual override** (`--city=Denpasar`) runs that specific city,
updates the cursor normally. Useful for one-off backfills.

Exit codes:
- `0` child cycle completed cleanly (or dry-run OK)
- `1` bad CLI args / corrupt cursor / missing catalogue / missing env
- `2` lock contention (another instance is running · not an error)
- `3` child engine returned non-zero
- `99` unexpected internal error

---

## 2 · Scheduling

### Option A · GitHub Actions self-hosted runner (recommended)

Workflow: `.github/workflows/nex-acquisition-rotation.yml`.

Schedule: every 3 hours (8 cycles/day · at mm=17 of 00/03/06/09/12/15/18/21).

**Requires a self-hosted runner.** GitHub-hosted runners cannot reach
`localhost:5433` on the dev workstation. Pick ONE of:

- Install the GitHub Actions self-hosted runner on the dev machine
  (easiest · tag it `nex-dev-host` to match the workflow).
- Move `nex_dev` behind a network-reachable address (bigger change).

Setup steps:
1. Repo Settings → Actions → Runners → "New self-hosted runner".
2. On the dev machine: run the install command GitHub provides.
3. Label the runner `nex-dev-host` during install (or add later).
4. Repo Settings → Secrets → Actions → add `NEX_POSTGRES_URL`
   with the same value as `.env.local`.
5. The workflow starts firing at the next cron slot. First success
   writes an empty cursor; from then on each run advances it.

Monitoring:
- Each run uploads any engine audit JSON as an artifact
  (`scripts/nex-acquisition/.cache/runs/*.json`).
- The rotation cursor commits itself back on success, so the repo's
  git history shows which cities ran when.

### Option B · Windows Task Scheduler (fallback)

If a self-hosted runner is not practical, Windows Task Scheduler
drives the same script directly:

1. Create a batch wrapper, e.g. `C:\nex-acquisition\run-rotation.cmd`:
   ```cmd
   @echo off
   cd /d D:\trades
   node --env-file=.env.local scripts\nex-acquisition\rotate-and-run-live-cycle.mjs
   ```
2. Open Task Scheduler → Create Task:
   - General · "NEX acquisition rotation" · run whether user logged in or not
   - Triggers · Daily, every 3 hours
   - Actions · Start `C:\nex-acquisition\run-rotation.cmd`
   - Settings · Stop the task if it runs > 25 min · Allow task on-demand run
3. Right-click → Run · verify it exits 0.
4. Monitor via Task Scheduler history + the `data/nex-acquisition/`
   cursor file git-ignored on the dev machine.

Option B is less observable than A (no artifact storage, no concurrency
across machines) but needs no cloud credentials.

---

## 3 · Observability

Every invocation emits structured JSON lines on stdout:

```
{"ts":"2026-10-12T02:17:00Z","event":"selected-city","run_id":"...","city":"Seminyak","province":"Bali","priority":5}
{"ts":"2026-10-12T02:17:00Z","event":"spawn-engine","city":"Seminyak","province":"Bali","priority":5}
...engine's own 5-section report streams through unchanged...
{"ts":"2026-10-12T02:19:34Z","event":"cycle-complete","run_id":"...","city":"Seminyac","result":{"ok":true,"exit_code":0,"duration_ms":154128}}
```

To check "when did we last run city X":

```sh
node -e "console.log(require('./data/nex-acquisition/city-rotation-cursor.json').cycles['Denpasar'])"
```

To check "which cities are in backoff":

```sh
node -e "
const c = require('./data/nex-acquisition/city-rotation-cursor.json').cycles;
for (const [k,v] of Object.entries(c)) if (v.next_eligible_at) console.log(k, '→', v.next_eligible_at, 'backoff_idx', v.backoff_index);"
```

Database-side evidence of a successful cycle:

```sql
SELECT started_at, finished_at, worker_id, records_processed, status
  FROM nex.worker_cycle_run
 WHERE worker_type = 'acquisition'
   AND started_at > now() - interval '24 hours'
 ORDER BY started_at DESC;
```

---

## 4 · Expected behavior

Steady-state (72-hour cooldown × 8 cycles/day):

- Every ~9 days, every covered city gets re-scanned.
- Each cycle either (a) ingests new rows for that city or (b) exits
  with `PROVIDER_EMPTY` if Overpass is down · in case (b) backoff
  shields that city for 1-8 hours before the next retry.
- `data/nex-acquisition/city-rotation-cursor.json` grows one entry
  per catalogued city after it has run at least once.
- `nex.business_canonical` and `nex.business_directory_v` grow in step
  with cycles that produce new candidates and pass the sealed resolver /
  precheck / write / promote chain.

---

## 5 · Explicit guard-rails

The rotation runner does NOT:

- Flip `source_registry.can_display` for any vertical. Food is already
  TRUE from an earlier manual authorization; accommodation remains FALSE
  until the sealed clearance doctrine says otherwise.
- Bypass `precheckHandoff`, resolver, or admin-promote-lifecycle. It
  only invokes the sealed engine's existing control flow.
- Chain multiple cities per invocation. One-at-a-time is the host's
  job via the schedule interval.
- Attempt verticals other than food. The script hard-fails on any
  `--vertical` other than `food`. Adding accommodation would require
  (a) `can_display` clearance + (b) a change here.

Rollback (any run):

- The rotation itself is a cursor-file mutation. Delete
  `data/nex-acquisition/city-rotation-cursor.json` to reset the
  rotation to zero.
- Any canonicals / evidence created by the engine are owned by the
  sealed write-approved-candidates path · they do NOT roll back when
  the rotation cursor is reset. That's the correct separation.

---

## 6 · Known limitations

1. **Overpass dependency.** The engine's only live discovery source is
   OSM Overpass. Pass 6 observed 4-of-5 mirrors degraded; pass 7
   confirmed `maps.mail.ru` recovered. When all 5 mirrors are down the
   engine reports `cycle_outcome: PROVIDER_EMPTY` and the backoff kicks
   in cleanly. No alternate discovery source is wired today.
2. **No alerting integration.** The workflow emits GitHub Actions logs
   and artifacts; it does not page a person on failure. If uptime
   matters, add a Slack-notify step on `failure()` or wire the
   `vercel.json`-style monitoring you already use for other crons.
3. **One concurrency group.** The workflow uses `concurrency: group:
   nex-acquisition-rotation`. Only one rotation runs at a time in
   GitHub Actions. The local file lock serves the same purpose for
   Option B.

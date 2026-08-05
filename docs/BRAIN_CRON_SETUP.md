# NEX Brain 24/7 Scheduling · Setup Options

The brain pipeline runs when someone calls `/api/nex/brain/run-once` (or
the GET wrapper at `/api/nex/brain/cron-tick`). This document explains
three ways to make that happen automatically.

**Pick one. Any of the three is enough for 24/7 processing.**

---

## Option A · Local always-on worker (works today, no deploy)

Zero external dependencies. Runs on your laptop, a Raspberry Pi, a $5
VPS, or a Fly.io free machine. Works with `localhost:3008` — no public
URL needed.

**Start:**

```powershell
# Windows PowerShell
$env:NEX_BRAIN_URL = "http://localhost:3008"
$env:NEX_BRAIN_INTERVAL = "30000"
node scripts/nex-brain-worker.mjs
```

```bash
# macOS / Linux
NEX_BRAIN_URL=http://localhost:3008 NEX_BRAIN_INTERVAL=30000 node scripts/nex-brain-worker.mjs
```

Leave the terminal running. Ctrl+C to stop. The script polls every
`NEX_BRAIN_INTERVAL` milliseconds (default 30s) and logs only when
there's real activity.

**Env vars:**

| Var | Default | Purpose |
|---|---|---|
| `NEX_BRAIN_URL` | `http://localhost:3008` | Base URL |
| `NEX_BRAIN_INTERVAL` | `30000` | Polling interval ms |
| `NEX_BRAIN_BATCH` | `5` | Items per worker per cycle |
| `NEX_BRAIN_CRON_TOKEN` | (empty) | Required if server has it set |

**Run as a Windows service** (with [nssm](https://nssm.cc/)):

```powershell
nssm install NexBrainWorker "node.exe" "C:\Users\Victus\trades\scripts\nex-brain-worker.mjs"
nssm set NexBrainWorker AppEnvironmentExtra "NEX_BRAIN_URL=http://localhost:3008"
nssm start NexBrainWorker
```

**Run as a systemd service** (Linux):

```ini
# /etc/systemd/system/nex-brain-worker.service
[Unit]
Description=NEX Brain 24/7 Worker
After=network.target

[Service]
Type=simple
User=philip
WorkingDirectory=/home/philip/trades
Environment=NEX_BRAIN_URL=http://localhost:3008
ExecStart=/usr/bin/node scripts/nex-brain-worker.mjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then: `sudo systemctl enable --now nex-brain-worker`.

---

## Option B · Vercel Cron (activates when deployed to Vercel)

`vercel.json` already contains a cron entry:

```json
{ "path": "/api/nex/brain/cron-tick", "schedule": "* * * * *" }
```

**Every minute.** That's the Vercel Hobby-tier minimum interval.

When you deploy the repo to Vercel, this activates automatically. Vercel
authenticates cron requests using a `CRON_SECRET` env var it injects for
you — the `/cron-tick` endpoint verifies it.

**Set your `NEX_BRAIN_CRON_TOKEN`** in Vercel project settings if you
also want external cron services to call the endpoint. Otherwise the
Vercel cron alone suffices.

**Limits (Vercel Hobby):**
- 2 crons per project (already using several — check `vercel.json`)
- 1 minute minimum interval
- Function timeout: 10s (Hobby) / 60s (Pro) — the brain's `maxDuration=120` is set for Pro; on Hobby, batch sizes may need to shrink

---

## Option C · External HTTPS cron (any hosting)

Works with any public URL. Free tier options:

- [**cron-job.org**](https://cron-job.org) — free, unlimited jobs, 1-min minimum
- [**UptimeRobot**](https://uptimerobot.com) — free, 5-min minimum
- **GitHub Actions** — free minutes, scheduled workflow

**Setup for cron-job.org (5 min):**

1. Sign up
2. Create job:
   - **URL**: `https://YOUR_APP.vercel.app/api/nex/brain/cron-tick`
   - **Method**: GET
   - **Schedule**: every 1 minute
   - **Headers**: `Authorization: Bearer YOUR_NEX_BRAIN_CRON_TOKEN`
3. Save. Requests start immediately.

**GitHub Actions template** — save as `.github/workflows/nex-brain-cron.yml`:

```yaml
name: NEX Brain Cron
on:
  schedule:
    - cron: "* * * * *"   # every minute (best-effort — often runs 5-15 min late)
  workflow_dispatch:
jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger NEX Brain
        run: |
          curl -sf -H "X-Brain-Cron-Token: ${{ secrets.NEX_BRAIN_CRON_TOKEN }}" \
               "${{ secrets.NEX_BRAIN_URL }}/api/nex/brain/cron-tick"
```

Then add `NEX_BRAIN_URL` and `NEX_BRAIN_CRON_TOKEN` in the repo's
Settings → Secrets.

Note: GitHub Actions scheduled workflows run **best-effort**. Expect
drift of 5-15 minutes under GitHub load. Fine for a nightly cadence,
not great for a per-minute cadence.

---

## Setting the cron token

To protect the endpoint from random internet callers, set a token:

```env
# .env.local (server-side, never expose to browser)
NEX_BRAIN_CRON_TOKEN=paste-a-long-random-string-here
```

Generate a strong token:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

```bash
openssl rand -base64 48
```

Every caller — the local worker script, Vercel Cron, external cron —
must send this token via `Authorization: Bearer <token>` or
`X-Brain-Cron-Token: <token>`.

**Local dev without a token is fine** — leave `NEX_BRAIN_CRON_TOKEN`
unset. The endpoint is open. Set the token before deploying publicly.

---

## Verifying it's working

Watch the dashboard at `/nex-app/nex-brain` — the "Completed 24h"
counter should tick up. Or tail the server logs:

```powershell
# Windows
Get-Content .\dev.log -Wait | Select-String "brain"
```

If the counter isn't moving:
- Check the terminal running `nex-brain-worker.mjs` for errors
- Check that `/api/nex/brain/run-once` returns 200 to a manual `curl`
- Check `NEX_BRAIN_CRON_TOKEN` matches on both sides if set

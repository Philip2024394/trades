# NEX Brain · Cloud Worker Runtime

Deploys the always-on brain runtime to Fly.io. Runs `scripts/nex-brain-cloud-worker.ts` in a container that never sleeps, restarts on crash, and polls Supabase for jobs 24/7.

## Prerequisites

1. `flyctl` installed — https://fly.io/docs/hands-on/install-flyctl/
2. Fly account authenticated: `fly auth login`
3. Supabase migration `db/migrations/003_worker_heartbeats.sql` already applied
4. Fresh (rotated) `service_role` key from Supabase

## First-time deploy

Run from the **repo root** (`C:\Users\Victus\trades`).

```powershell
# 1. Create the app (once). Say YES when asked to reuse the existing fly.toml.
fly launch --config deploy/nex-brain-worker/fly.toml `
           --dockerfile deploy/nex-brain-worker/Dockerfile `
           --no-deploy `
           --copy-config `
           --name nex-brain-worker

# 2. Set secrets. Values are encrypted at rest and injected as env vars.
fly secrets set --app nex-brain-worker `
  NEX_SUPABASE_URL=https://ijvqdvsvwtwxzcqmoqit.supabase.co `
  NEX_SUPABASE_SERVICE_ROLE_KEY=<paste_rotated_key> `
  GROQ_API_KEY=<paste> `
  GOOGLE_GEMINI_API_KEY=<paste> `
  ANTHROPIC_API_KEY=<paste_or_omit>

# 3. Deploy.
fly deploy --config deploy/nex-brain-worker/fly.toml `
           --dockerfile deploy/nex-brain-worker/Dockerfile
```

## Verify

```powershell
# Live logs (JSON lines)
fly logs --app nex-brain-worker

# Health from anywhere
curl https://nex-brain-worker.fly.dev/health

# Dashboard chip should flip to "Cloud · fly-xxxx · Ns" green.
```

The dashboard tile at `/nex-app/nex-brain` reads `/api/nex/brain/cloud-status` which reads `worker_heartbeats` from Supabase. If the chip stays "Cloud not deployed" after `fly deploy` succeeded, check:

1. `fly logs --app nex-brain-worker` — does it show `cloud-worker-boot` then `cycle-active`?
2. `curl https://nex-brain-worker.fly.dev/health` — does it return `{"ok": true}`?
3. Supabase table `worker_heartbeats` — is there a row with a recent `last_seen_at`?

## Redeploy after code change

Just:

```powershell
fly deploy --config deploy/nex-brain-worker/fly.toml `
           --dockerfile deploy/nex-brain-worker/Dockerfile
```

Fly does zero-downtime blue/green — spins up the new machine, waits for `/health` to pass, then shuts down the old one via SIGTERM. Our worker's SIGTERM handler drains cleanly.

## Scale horizontally later

```powershell
# Run 2 workers in parallel (both safely claim from the same queue via SKIP LOCKED)
fly scale count 2 --app nex-brain-worker
```

## Tear down

```powershell
fly apps destroy nex-brain-worker
```

## Cost

Single 1x-shared-cpu / 512MB machine in `lhr` region ≈ $5.70/mo.

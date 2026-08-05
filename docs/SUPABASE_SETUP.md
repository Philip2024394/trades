# SUPABASE_SETUP · NEX Brain migration from filesystem to cloud

This is the one-time setup that flips NEX Brain from the local filesystem
backend (currently active) to Supabase. After this, the workers keep
running 24/7 on Supabase Edge Functions with `pg_cron` on Pro tier, or
via external cron on Free tier.

**Time to complete: ~10 minutes.**

**Cost: £0 for years** (Supabase free tier: 500 MB database, 1 GB
storage, 500K function invocations/month, unlimited API requests).

---

## Step 1 · Create the Supabase project (~2 min)

1. Go to [https://supabase.com](https://supabase.com) → **Start your project**.
2. Sign up with GitHub (fastest; no credit card required).
3. Click **New project**.
   - **Name:** `nex-brain` (or whatever you like)
   - **Password:** generate a strong one and store it in a password manager
   - **Region:** London (`eu-west-2`) for lowest latency from UK
   - **Plan:** Free
4. Wait ~2 minutes for the project to provision.

---

## Step 2 · Run the schema migration (~1 min)

1. In your Supabase dashboard, click **SQL Editor** in the left rail.
2. Click **New query**.
3. Open the file `db/migrations/001_nex_brain_schema.sql` from this repo.
4. Copy the **entire file contents** and paste into the SQL editor.
5. Click **Run** (or press `Ctrl+Enter`).
6. You should see: `Success. No rows returned.`

Verify the tables exist: click **Table Editor** in the left rail. You
should see 11 tables:

- `knowledge_records`
- `record_versions`
- `graph_edges`
- `worker_jobs`
- `worker_results`
- `sources`
- `confidence_scores`
- `contradictions`
- `deprecations`
- `knowledge_feedback`
- `audit_log`

---

## Step 3 · Copy your credentials (~1 min)

1. In your Supabase dashboard, click **Project Settings** (gear icon) →
   **API**.
2. You'll see three values you need:
   - **Project URL** — `https://xxxx.supabase.co`
   - **anon public** key — safe to expose to the browser
   - **service_role** key — **SECRET**, server-side only, treat like a password

3. Open `.env.local` in this repo (create if it doesn't exist).
4. Paste in:

   ```env
   NEX_BRAIN_BACKEND=supabase
   # If you already have the Nex Supabase project configured, reuse it:
   #   NEXT_PUBLIC_NEX_SUPABASE_URL is probably already set — good
   #   You still need to add the service-role key below.
   NEX_SUPABASE_SERVICE_ROLE_KEY=eyJ...

   # OR — if you want a fresh dedicated brain project, use these instead:
   # NEX_SUPABASE_URL=https://xxxx.supabase.co
   # NEX_SUPABASE_SERVICE_ROLE_KEY=eyJ...

   # Legacy generic vars are also accepted:
   # SUPABASE_URL=https://xxxx.supabase.co
   # SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

5. Save the file.

**The `NEX_BRAIN_BACKEND=supabase` line is the explicit opt-in.**
Without it, the brain uses the filesystem backend even if the
Supabase vars are set (they may exist for other features in the
project).

**URL resolution order:** `NEX_SUPABASE_URL` → `NEXT_PUBLIC_NEX_SUPABASE_URL` → `SUPABASE_URL`.
**Service-role key order:** `NEX_SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`.
The first configured value in each list wins.

**Never commit `.env.local` to git.** It's already in `.gitignore`.

---

## Step 4 · Install the Supabase client library (~1 min)

```powershell
npm install @supabase/supabase-js
```

Restart your dev server so it picks up the new env vars:

```powershell
# stop the current dev server (Ctrl+C) then:
npm run dev
```

---

## Step 5 · Verify the switch (~1 min)

1. Open [http://localhost:3008/nex-app/nex-brain](http://localhost:3008/nex-app/nex-brain).
2. Look at the top of the page for the backend chip. It should now say
   **"Supabase live"** (blue) instead of **"Filesystem (dev)"** (grey).
3. Click **Dispatch inbox → queue**. You should see rows appear in
   Supabase's Table Editor under `worker_jobs`.
4. Click **Run one cycle**. Watch new rows land in `knowledge_records`,
   `worker_results`, `graph_edges`, and `confidence_scores`.

---

## Step 6 · Turn on 24/7 processing (~5 min)

You have three options depending on how autonomous you want it. All
are free.

### Option A · Supabase Pro + pg_cron (recommended long-term)

Requires upgrading to Supabase Pro ($25/month, kicks in at ~500 MB
database — plenty of headroom before then).

```sql
-- Run in Supabase SQL Editor
select cron.schedule(
    'nex-brain-run',
    '* * * * *',                        -- every minute
    $$
    select net.http_post(
      url:='https://your-app-domain/api/nex/brain/run-once',
      headers:=jsonb_build_object('content-type', 'application/json'),
      body:='{}'::jsonb
    );
    $$
);
```

### Option B · External free cron (Free tier)

Any of these work — pick one and forget it exists:

- **cron-job.org** (free, unlimited) — HTTP POST to
  `https://your-app-domain/api/nex/brain/run-once` every minute
- **UptimeRobot** (free, 5 min minimum interval)
- **Vercel Cron** (Hobby plan — 2 jobs, 1 min interval)
- **GitHub Actions** — free minutes, 5-min scheduled workflow

### Option C · Local always-on worker

Run a small Node script on your laptop or a free tier VM (Fly.io free
tier is perfect):

```powershell
# every 30 seconds
while ($true) {
  Invoke-RestMethod -Method POST -Uri http://localhost:3008/api/nex/brain/run-once -Body '{}' -ContentType 'application/json'
  Start-Sleep -Seconds 30
}
```

---

## Step 7 · Add an LLM API key (optional but recommended)

The brain runs with a mock adapter by default — enough to test the
pipeline but doesn't produce real knowledge. Add one or more of these
to `.env.local` to use real inference:

```env
# Groq — 30 RPM per model, ~14K free calls/day, Llama 3.3 70B fast
GROQ_API_KEY=gsk_...

# Google Gemini — 1500 free req/day, 1M-token context
GOOGLE_GEMINI_API_KEY=AIza...

# Anthropic — for hard escalations (paid, use sparingly)
ANTHROPIC_API_KEY=sk-ant-...
```

Get a Groq key free: [https://console.groq.com](https://console.groq.com) → API Keys
Get a Gemini key free: [https://aistudio.google.com](https://aistudio.google.com) → Get API key

The LLM adapter auto-detects and picks the best one available.
Restart the dev server after editing `.env.local`.

---

## Troubleshooting

**Backend chip still says "Filesystem (dev)":**
- Did you restart the dev server after editing `.env.local`?
- Are both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set? (Anon key
  alone isn't enough; the server needs the service_role key to bypass
  RLS for worker writes.)
- Check the dev server logs for a `[nex-brain.storage]` message telling
  you which backend is active.

**"pg_cron not available on Free tier":**
- Correct — pg_cron requires Pro. Use external cron (Option B) or the
  local always-on worker (Option C) for Free tier scheduling.

**"Row-Level Security policy violation":**
- You're calling the API with the anon key. The workers need the
  service_role key. Check that `SUPABASE_SERVICE_ROLE_KEY` is set in
  `.env.local` on the server side (not `NEXT_PUBLIC_...` — that would
  leak the key to the browser).

**Migration re-run fails:**
- All CREATE statements use `IF NOT EXISTS`. If you get an error, it's
  probably an `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on a table
  that already has RLS enabled — safe to ignore.

---

## Cost projection

- **Month 1-6:** £0 (Free tier)
- **Month 6-12:** £0-£25/month (may hit Free tier limits on database
  size at ~500K records; upgrade to Pro then)
- **Year 2+:** £25/month (Pro) + $5-20/month for storage + egress as
  corpus grows

Fine for the foreseeable future.

---

## What you get after this migration

- **NEX Brain is truly 24/7.** Your laptop can be off; workers keep
  processing on Supabase.
- **Every dump you paste, every URL you import, every voice note you
  upload gets turned into governed records without you touching them.**
- **The dashboard at `/nex-app/nex-brain` shows live worker health
  and corpus growth.**
- **Corrections you make get stored in `knowledge_feedback` — the
  moat that compounds over years.**
- **Multi-worker parallelism** via Postgres `SKIP LOCKED` — you can
  add specialist workers (Image Analyst, Voice Personality,
  Regulation Worker, etc.) in Phase 2 without touching the manager.

The mailbox is connected to the filing cabinet **and** the filing
cabinet is now cloud-hosted. Phase 1 complete.

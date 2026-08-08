# HEADQUARTERS WORKER DEPLOYMENT AUDIT · A2

**Status:** DRAFT · Phase A of Full Production-Readiness Programme
**Date:** 2026-08-09
**Sibling document:** `HEADQUARTERS-DATA-STORAGE-MAP.md` (A1) · read that first.
**Scope:** Every process that reads or writes NEX data · where it runs · which queue it claims from · what breaks if the deployment shifts.

**Central thesis (proven by Harper failure):** The code can look correct while the deployed architecture is broken. This audit therefore starts from **what is actually running today** and works back to the code.

---

## Section 1 · Observed running processes (evidence from `worker_heartbeats`)

Live query against NEX Supabase `worker_heartbeats` at 2026-08-08T18:58Z:

| host_id | Origin | cycles_total | Last seen | last_cycle_summary format | Notes |
|---|---|---|---|---|---|
| `8ed9d16c720908` | Fly machine 1 · region `lhr` | 44,117 | 2026-08-08T18:58:48 (fresh · 30s cadence) | `{checks,drafts,errors,contexts,duration_ms}` (legacy shape) | Written by `scripts/nex-brain-cloud-worker.ts` on Fly |
| `2870903c4d2638` | Fly machine 2 · region `lhr` | 44,135 | 2026-08-08T18:58:45 (fresh) | legacy shape | Same script |
| `knowledge-context@5572` | Local dev server (current) | 0 | 2026-08-08T18:55:36 | 12.3 shape `{worker_type, status, current_job_id, current_stage}` | Written by heartbeat.ts from Phase 12.3 |
| `voice-context@5572` | Local dev | 0 | 18:55:37 | 12.3 shape | ↑ |
| `learning-context@5572` | Local dev | 0 | 18:55:38 | 12.3 shape | ↑ |
| `knowledge-extractor@5572` | Local dev | 0 | 18:55:39 | 12.3 shape | ↑ |
| `image-analyst@5572` | Local dev | 0 | 18:55:39 | 12.3 shape | ↑ |
| `quality-checker@5572` | Local dev | 0 | 18:55:40 | 12.3 shape | ↑ |
| `@3172` (6 rows) | Prior local dev (killed) | 0 | 17:15:xx (stale) | 12.3 shape | Superseded by @5572 |
| `@11300` (6 rows) | Earlier local dev (killed) | 0 | 08:47:xx (stale) | 12.3 shape | Superseded |

**Interpretation:**
- Three CONCURRENT worker source pools are polling the same `worker_jobs` queue on NEX Supabase
- Two are long-running Fly machines with ~44k cycles each (started ~5 days ago at ~5 seconds per cycle)
- One is the local dev server (writes per-worker heartbeats via the Phase 12.3 code)
- Every cycle they call `nex.claim_next_job(worker_type, worker_id, 60)` via SKIP LOCKED

---

## Section 2 · Deployment surfaces

### 2A · Local development

- **Machine:** Philip's Windows laptop
- **Process:** `next dev -p 3008` (currently pid 5572)
- **Trigger for worker cycle:** `GET /api/nex/brain/cron-tick` (auth: `CRON_SECRET` bearer)
- **Worker code:** `src/lib/nex/brain/manager.ts::runOneCycle` runs all 6 workers in-process
- **Also runs:** `dispatchNewInboxItems` (reads local `data/knowledge-inbox/index.json`), 11.2 shadow writes to local Postgres (`NEX_INBOX_SHADOW_POSTGRES=1`), 12.3 heartbeats
- **File access:** Full filesystem access to `data/knowledge-inbox/files/` (uploads live here)
- **Env:** `NEX_BRAIN_BACKEND=supabase` · `NEX_INBOX_SHADOW_POSTGRES=1` · `NEX_POSTGRES_URL=postgresql://localhost:5433/nex_dev`

### 2B · Fly.io deployment (`fly.toml` at `deploy/nex-brain-worker/`)

- **App:** `nex-brain-worker` · `primary_region = "lhr"` · `min_machines_running = 1`
- **VM:** shared-cpu-1x · 512 MB
- **Container script:** `scripts/nex-brain-cloud-worker.ts`
- **What it does (per its own header):** "pull jobs from Supabase (via SupabaseStore + SKIP LOCKED RPC), run the 5-stage pipeline every INTERVAL_MS, drain the LLM retry queue, write a heartbeat every HEARTBEAT_MS"
- **What it does NOT do (per its own header, verbatim):**
  1. *"dispatch new inbox items — that reads from local filesystem and stays on Philip's Next.js machine"*
  2. *"image analysis by default — image jobs reference local file paths (data/knowledge-inbox/uploads/*) that don't exist in the container. Set RUN_IMAGE_ANALYST=1 once images move to Supabase Storage."*
- **Env on Fly (from fly.toml):**
  - `NEX_BRAIN_BACKEND = "supabase"`
  - `NEX_WORKER_INTERVAL_MS = "5000"`
  - `NEX_WORKER_HEARTBEAT_MS = "10000"`
  - `NODE_ENV = "production"`
- **Secrets on Fly** (per README): `NEX_SUPABASE_URL`, `NEX_SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
- **Actual machines observed:** 2 running (`8ed9d16c720908` + `2870903c4d2638`) — one more than `min_machines_running = 1` · likely scaled up manually at some point OR a stopped-machine failing to actually stop

### 2C · Vercel deployment (production Next.js)

- **Status:** UNKNOWN · not part of this audit yet
- **What would run here:** the Next.js dev server's API routes (including `/api/nex/brain/cron-tick`) if Vercel Cron is wired
- **Missing evidence:** need to check `vercel.json` for cron config · check whether Vercel Cron hits `/cron-tick` in prod · check whether prod Vercel is even deployed
- **Flag:** must be answered before Refactor Plan

### 2D · Legacy filesystem-polling script

- **Path:** `scripts/nex-brain-worker.mjs` (different file from `nex-brain-cloud-worker.ts`)
- **What it does:** polls `/api/nex/brain/run-once` every INTERVAL_MS
- **Status:** Not observed in current heartbeat pool · likely dormant · flag for confirmation

---

## Section 3 · Which worker runs on which surface

The critical question: for each of the 6 pipeline workers, which surface actually executes it?

| Worker | Persona | Runs on local dev? | Runs on Fly? | Runs on Vercel? | LLM? | File access needed? |
|---|---|---|---|---|---|---|
| knowledge-context | Mason | YES (via cron-tick) | YES (cloud-worker script) | UNKNOWN | no | no · reads from Supabase only |
| voice-context | Blake | YES | YES | UNKNOWN | no | no |
| learning-context | Rowan | YES | YES | UNKNOWN | no | no |
| knowledge-extractor | Avery | YES | YES | UNKNOWN | YES (Groq · Mistral · fallback chain) | no · text in job payload |
| **image-analyst** | Harper | YES (theoretically) | **YES (currently claims and fails)** | UNKNOWN | YES (Gemini vision · Anthropic vision) | **YES · reads local binary from filesystem** |
| quality-checker | Iris | YES | YES | UNKNOWN | conditional (Part B uses Groq) | no |

**Consequence:** For 5 workers, Fly OR local can process. For image-analyst, **only the machine that received the upload can process** · and Fly never has the file.

---

## Section 4 · Findings

Numbered severity: **P0** = production blocker · **P1** = serious · **P2** = important · **P3** = improvement.

### P0 · Image-analyst has never successfully completed a job

**Evidence:** 
- Query: `SELECT COUNT(*) FROM worker_jobs WHERE worker_type='image-analyst' AND status='completed'` → **0 rows lifetime**
- Query: `SELECT * FROM worker_results WHERE worker_type='image-analyst'` → **0 rows lifetime**
- All 4 attempts (3 from earlier + 1 today) failed with identical ENOENT on `/app/data/knowledge-inbox/files/<id>-<name>.png`

**Impact:** Harper's LLM code has never been exercised on any environment. Its vision-analysis behavior is entirely UNPROVEN in the running system.

**Root cause chain:**
1. Fly workers claim image-analyst jobs (queue is shared)
2. `RUN_IMAGE_ANALYST=1` flag documented in the cloud worker header but never checked in code → Fly runs image-analyst unconditionally
3. Fly container has no access to local upload files
4. `fs.readFile('/app/data/...')` throws ENOENT
5. Job marked failed, no retry attempted (attempts=1 · no requeue logic for this error class)

**Fix:** Requires all of:
- Object storage for inbox binaries (see A1 § 4 · P0)
- Worker code change: image-analyst reads via HTTP GET from object storage URL
- Inbox schema change: `file_path` (local) → `file_url` (shared)
- Backfill: existing local files need to be pushed to object storage AND `nex.knowledge_inbox.file_url` populated
- Then re-attempt failed jobs

**Belongs in:** Refactor Plan · Object Storage subplan.

### P0 · Shared queue split-brain across 3 worker pools

**Evidence:** `worker_heartbeats` shows 2 Fly + 1 local dev, all polling `nex.claim_next_job('image-analyst', ...)` (and every other worker type) on the same NEX Supabase queue.

**Impact:**
1. Non-deterministic which pool claims a given job
2. For location-dependent work (images) the wrong pool wins ~100% of the time
3. Post-11.3 flip to Postgres, Fly workers would still be on Supabase (they'd be stranded unless their fly.toml env is updated AND redeployed simultaneously with the flip)
4. If both pools are running with the shadow flag set, both would try to shadow-write · potentially double-writes

**Fix category:** Coordinated deployment redesign. Options:
- (a) All workers run on Fly · dev disables in-process cron-tick from claiming
- (b) All workers run in-process on Vercel serverless · Fly decommissioned
- (c) Fly workers migrated onto NEX Postgres backend at same moment as 11.3 flip
- (d) Multi-tenant queue: worker_id includes region · claim helper filters

**Belongs in:** Refactor Plan.

### P0 · Fly worker deployment predates Phase 12.3

**Evidence:**
- Fly heartbeat shape: `{checks,drafts,errors,contexts,duration_ms}` (LEGACY)
- Local heartbeat shape: `{worker_type,status,current_job_id,current_stage}` (Phase 12.3)

The Fly cloud-worker script is running an OLDER build of the code that doesn't include the Phase 12.3 heartbeat updates. This means:
- Fly workers can't be observed via `/api/nex/brain/workers-live` (that endpoint expects 12.3 shape)
- The Reception dashboard's per-worker card treats Fly heartbeats as unknown/malformed
- Any bug fix or improvement committed since the last `fly deploy` is missing from production

**Fix:** `fly deploy --config deploy/nex-brain-worker/fly.toml` after the current codebase is validated (but not before we've decided whether Fly should continue existing at all).

**Belongs in:** Refactor Plan.

### P0 · `dispatchNewInboxItems` cannot run on Fly

**Evidence:** Cloud worker header explicitly disables inbox dispatch because it reads from local filesystem.

**Impact:** If the local dev server is offline, NO new inbox items get enqueued into `worker_jobs` regardless of how many Fly workers are alive. The Fly workers process what's already queued and go idle. The system silently stops accepting new inputs.

**Fix:** Same as P1 in A1 · flip inbox reads to Postgres so dispatch is location-transparent.

**Belongs in:** Refactor Plan · Inbox migration subplan.

### P1 · `RUN_IMAGE_ANALYST` env flag documented but not enforced

**Evidence:** grep of `scripts/nex-brain-cloud-worker.ts` for `RUN_IMAGE_ANALYST` returns only comments (lines 23 · 40). No code check.

**Impact:** Doctrinal safety valve doesn't exist. Even if operator sets `RUN_IMAGE_ANALYST=0` to prevent Fly from touching images, it has no effect.

**Fix:** Two-line code change to gate `runImageAnalyst()` invocation behind `process.env.RUN_IMAGE_ANALYST === "1"`.

**Belongs in:** Refactor Plan (quick fix if we're keeping Fly workers · skip if we're removing them).

### P1 · No configured production trigger for `dispatchNewInboxItems`

**Evidence:** Only `GET /api/nex/brain/cron-tick` calls dispatch. If dev server is off and Fly can't dispatch (see previous finding), what triggers dispatch in prod?

**Fix category:** Needs Vercel deployment audit (see 2C · UNKNOWN). If Vercel Cron hits `/cron-tick` in prod, we're covered. If not, dispatch requires a machine with local filesystem access + a scheduled trigger.

**Belongs in:** Refactor Plan · after Vercel audit.

### P1 · Two extra Fly machines running vs configured

**Evidence:** `fly.toml` says `min_machines_running = 1` · heartbeats show 2 machines active.

**Impact:** One machine is unnecessary at current volume · doubles LLM cost if both are actively draining the queue · doubles the risk of race conditions on non-idempotent operations.

**Fix:** `fly scale count 1 --app nex-brain-worker` after Harper testing OR just confirm one is a zombie that should be stopped.

**Belongs in:** Refactor Plan.

### P2 · Fly worker not gated on `NEX_BRAIN_BACKEND=postgres` support

**Evidence:** Fly toml hardcodes `NEX_BRAIN_BACKEND = "supabase"`. Post-11.3 flip, Fly still writes to Supabase.

**Impact:** For a coordinated 11.3 flip we must update Fly's env AND redeploy simultaneously. This is fragile.

**Fix:** Either sync Fly + Vercel envs from one source, or replace the legacy cloud-worker with a NEX-Postgres-aware equivalent as part of the migration.

**Belongs in:** Refactor Plan.

### P2 · Cron-tick auth relies on shared bearer secret in `.env.local`

**Evidence:** `CRON_SECRET=15022048...` in dev env · same token expected in prod.

**Impact:** Bearer-in-URL/header pattern · rotate frequently · leak recovery slow.

**Fix category:** Standard operational — key rotation cadence + rotation procedure documented.

**Belongs in:** Compliance audit.

### P3 · Legacy `scripts/nex-brain-worker.mjs` still exists

**Evidence:** File exists (checked). Not observed in heartbeat pool. Purpose superseded by `nex-brain-cloud-worker.ts`.

**Impact:** Dead code · confusion for future maintainers.

**Fix:** Delete or clearly deprecate with a comment · verify no consumer references it.

**Belongs in:** Refactor Plan (P3).

---

## Section 5 · The Harper proof plan (unchanged · gated on you)

Independent of the audit findings above, the Harper proof itself is a specific bench-test that will confirm the code path is correct:

1. **You** suspend Fly: `fly apps suspend nex-brain-worker`
2. Both `8ed9d16c720908` and `2870903c4d2638` stop writing heartbeats
3. I verify staleness (>60s no writes)
4. I upload a fresh image (`public/badges/badge-01.png`) to `POST /api/nex/knowledge-inbox/upload`
5. I fire `GET /api/nex/brain/cron-tick` bearer-authorised
6. My local dev server wins the image-analyst claim (nothing else is polling)
7. Image-analyst reads local file · calls vision LLM (expect gemini or mistral) · produces `worker_results` row with real provider/model/tokens/latency
8. Extractor path completes with a `knowledge_records` draft
9. Quality-checker gates → AUTHORITATIVE / UNDER_REVIEW / REJECTED
10. I report the full trace
11. **You decide** whether to `fly apps resume` OR redesign the deployment first

This proof answers ONE narrow question: does Harper's code work end-to-end when it's the only worker in the queue? It does NOT solve the location-transparency problem · that's a Refactor Plan item.

---

## Section 6 · What this audit does NOT cover

- Vercel deployment audit (needs its own read of `vercel.json` + Vercel dashboard confirmation)
- The actual LLM provider chain fallthrough behavior (belongs in B · Engineering Quality)
- Retry-queue drain semantics (belongs in B)
- Rate-limit + circuit-breaker per provider (belongs in B)
- Cost telemetry per worker (belongs in B)
- Whether cron-tick can be triggered from multiple sources simultaneously (belongs in B · concurrency)

---

## Section 7 · Recommended next steps in priority order

1. **You suspend Fly** · I do the Harper proof · we get definitive evidence that Harper's code is correct (or that there's a second bug hiding behind the ENOENT)
2. **Vercel audit** — read-only inspection of `vercel.json` and current prod deploy state (if any). Answers "who dispatches inbox items in production?"
3. **Decide the deployment model** — one of the 4 options in Finding P0 · shared queue split-brain
4. **Decide object storage** — pick a provider (NEX-branded S3-compat? Cloudflare R2? ImageKit? ...)
5. **THEN** phase into the Engineering Quality Audit (B), Compliance Audit (B), Refactor Plan (C)

Nothing in step 3-5 gets built without your explicit go per step.

---

*A2 · draft · authored 2026-08-09 · to be revised after Harper proof and Vercel audit.*

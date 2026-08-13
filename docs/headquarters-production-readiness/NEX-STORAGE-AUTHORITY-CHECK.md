# NEX Storage Authority Check

**Type:** Read-only architecture gate · runs before WAVE 1 (Migration 046) authorisation
**Date:** 2026-08-10 (late)
**Author role:** Independent auditor (continuation of the read-only forensic pass)
**Scope:** Determine — with evidence — the current authority relationship between "NEX Storage" and Supabase in this repository.
**Rule:** Report actual state first. Do not tune the answer to match the doctrine.

---

## 0 · The principle under test

> **"NEX Storage is the native storage layer of NEX."**

This check tests whether the actual repository behaves that way today.

---

## 1 · Is NEX Storage currently the authoritative/native storage layer?

**Answer: PARTIALLY — it is one of three co-existing layers, and it is authoritative only for a slice of the surface.**

Three distinct persistence layers coexist in this repo. All three are alive and in use:

| Layer | Selector | Adapters | Currently authoritative for |
|---|---|---|---|
| **NEX Storage runtime** (`src/lib/nex/storage/`) | `NEX_STORAGE_BACKEND` | jsonl · postgres · dual-write (records) · filesystem · postgres · dual-write (objects) | Object storage · a slice of records |
| **BrainStore** (`src/lib/nex/brain/storage.ts`) | `NEX_BRAIN_BACKEND` | filesystem · **supabase** · postgres | Knowledge records · worker jobs · audit_log — **via Supabase in local + prod today** |
| **App-level Supabase clients** (`src/lib/supabase.ts`, `src/lib/supabaseAdmin.ts`, etc.) | none — direct imports | supabase-js | ~40 non-brain subsystems (memory, insights, feed, hero-swap, oauth, publications, story-arcs, activity, licenses, gold-path, etc.) plus middleware |

**Verdict on principle:** the doctrine "NEX Storage is the native storage layer" is **aspirational**, not the current state. NEX Storage is authoritative for objects + inbox reads today; Supabase is authoritative for Brain and for the majority of non-brain subsystems.

---

## 2 · What exact storage/database implementation sits underneath NEX Storage?

`src/lib/nex/storage/registry.ts:29`:
```
const kind = (process.env.NEX_STORAGE_BACKEND ?? "jsonl").toLowerCase();
```

Adapters present (`src/lib/nex/storage/adapters/`):
- `jsonl.ts` — filesystem JSONL (default)
- `postgres.ts` — direct `pg` client via `withClient` → NEX Postgres
- `dual-write.ts` — records: primary + secondary wrapper
- `object-filesystem.ts` · `object-postgres.ts` · `object-dual-write.ts` — object surface

**No Supabase adapter for records.** `object-registry.ts:124` `case "supabase":` throws:
> `"backend supabase is on the Contract §12.4 roadmap but not yet implemented"`

So under NEX Storage today the concrete implementations are only: filesystem (jsonl) OR NEX Postgres (via `pg` pool).

---

## 3 · What is PostgresBrainStore actually connected to?

`src/lib/nex/brain/adapters/postgres.ts:50-67` uses `withClient` from `@/lib/nex/db`.

`src/lib/nex/db.ts:14-38`:
- Reads `NEX_POSTGRES_URL` via `getPostgresUrlOrNull()`.
- Creates a `pg` `Pool` with that connection string.
- Sets `ssl: { rejectUnauthorized: false }` when the URL host matches `/supabase\.co|render\.com|neon\.tech|amazonaws\.com/`.

**Actual value of `NEX_POSTGRES_URL` in `.env.local` (redacted):**
```
NEX_POSTGRES_URL=postgresql://postgres:<REDACTED>@localhost:5433/...
```

**Verdict:** PostgresBrainStore in local dev connects to a **local, standalone Postgres server** on `localhost:5433`. Not Supabase. Not managed. A separate DB.

Production value: unknown from this repo alone — that URL is set on Vercel by the operator. The `pg`-pool SSL heuristic allows it to point at a Supabase Postgres (via direct connection string) OR at any other managed Postgres. What it points at TODAY in production is a 🔵 operator-owned fact.

---

## 4 · Is Supabase still a runtime dependency?

**Answer: YES. Firmly runtime, firmly required today.**

Evidence:

- `NEX_BRAIN_BACKEND=supabase` in current `.env.local` — Brain reads and writes go through `SupabaseStore` today. `brainStore()` returns a `SupabaseStore` instance, not `PostgresBrainStore`.
- `SUPABASE_URL=https://msdonkkechxzgagyguoe.supabase.co` in current `.env.local` — the Supabase project referenced across the codebase.
- **42 files** across `src/` import from `@supabase/supabase-js`:
  - 6 in `src/lib/nex/` (`brain/adapters/supabase.ts`, `brain/adapters/supabase.wc-companion.test.ts`, `brain/audit-log.ts`, `brain/warehouse.ts`, `brains/_supabase.ts`, `supabase.ts`)
  - The rest across non-brain subsystems: `middleware.ts`, `story-arcs/`, `signals/`, `insights/`, `hero-swap/`, `gold-path/`, `feed/`, `memory/`, `oauth/`, `activity/`, `licenses/`, `publications/`, `feed/`, plus many api routes.
- **703 hits** for `createClient(...supabase...)` / `@/lib/supabase` / `@/lib/supabaseAdmin` imports across `src/app/`.
- **331 migration files** in `supabase/migrations/` — the Supabase-legacy schema layer.
- Middleware (`src/middleware.ts:27,301,307`) creates a Supabase client for custom-domain routing lookups on every request.
- Fly deployment config `deploy/nex-brain-worker/fly.toml` still references Supabase env-vars (2 mentions) — that deployment is decommissioned (Wave 1 scaled to 0) but the file remains as-is.

Vercel `vercel.json` has **0** Supabase references at the JSON level (env vars are set in Vercel Project Settings, not in this file).

---

## 5 · Is Supabase merely external / legacy / dev / authoritative?

**Answer: currently AUTHORITATIVE (for Brain + ~40 other subsystems) — not merely legacy, not merely dev.**

Categorised:

| Kind of Supabase use | Status | Example |
|---|---|---|
| Brain (records, jobs, audit) | **AUTHORITATIVE** today via `NEX_BRAIN_BACKEND=supabase` | `SupabaseStore` in `brain/adapters/supabase.ts` |
| Custom-domain routing (middleware) | **AUTHORITATIVE runtime** — every request hits it | `middleware.ts:301-307` |
| App subsystems (memory · insights · feed · hero-swap · oauth · publications · story-arcs · activity · licenses · gold-path · signals · voice · vision · events · cron) | **AUTHORITATIVE runtime** | 703 call sites in `src/app/` |
| `hammerex_*` tables (trade-off directory, xrated newsletter, xrated admin) | **LEGACY but currently authoritative** — the customer-facing data sits here | `supabase/migrations/20260625*.sql` |
| Fly worker (`fly.toml`) | **LEGACY** — Fly scaled to 0 · not runtime | `deploy/nex-brain-worker/fly.toml` |

Nothing in `nex.*` schema on our local Postgres is currently authoritative for user-visible customer data. NEX Postgres holds inbox uploads (per Wave 3 · `nex.object_blobs`) and inbox read indexes (post Wave 6a), plus contact registry (`nex.contacts` per Contact Intelligence doctrine) — but Brain records, dashboard metrics, and merchant-facing data still originate on Supabase.

---

## 6 · What exact component owns migration 046?

`deploy/postgres/init/046_worker_jobs_active_dedup.sql`:

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  worker_jobs_input_ref_active_uniq
ON nex.worker_jobs (input_ref, worker_type)
WHERE status IN ('waiting', 'assigned', 'running');
```

Ownership breakdown:

- **Schema:** `nex.*` (the NEX Postgres schema created by migrations 041/042).
- **Table:** `nex.worker_jobs` (defined in `041_nex_brain_schema.sql`).
- **Sole code consumer:** `src/lib/nex/brain/adapters/postgres.ts::enqueueJob` — the ON CONFLICT clause added tonight (per session log · commit not made).
- **Not consumed by:** `SupabaseStore.enqueueJob` (uses plain INSERT · no ON CONFLICT · index absent from Supabase schema) · `FilesystemStore.enqueueJob` (JSON file · no SQL).

Therefore migration 046 is owned by the **NEX Postgres deployment of the `nex.*` brain schema**. It has no home on Supabase's `public.worker_jobs` (different schema · different code path).

---

## 7 · Does migration 046 need to be applied to A · B · C · D?

Given the ownership in §6 and the runtime facts in §3 and §4:

| Target | Needs 046? | Why |
|---|---|---|
| **A · NEX Storage** (in the sense: NEX Postgres, where the `nex.*` brain schema lives) | **YES** — but only once `PostgresBrainStore` is on a code path that runs. Today `NEX_BRAIN_BACKEND=supabase` so `PostgresBrainStore.enqueueJob` is unreachable at runtime. The moment Wave 5 A2 (`NEX_BRAIN_BACKEND=postgres` on Vercel) fires, 046 becomes hard-required or every enqueue 500s. | Nex Postgres holds the schema this migration targets. |
| **B · Supabase** | **NO** — direct application impossible (`nex.*` schema doesn't exist on Supabase) AND unnecessary (`SupabaseStore.enqueueJob` doesn't use ON CONFLICT). A *parallel* index on Supabase's `public.worker_jobs` would only matter IF Supabase later became a Postgres-adapter target (via a `NEX_POSTGRES_URL` pointing at Supabase's direct-pg endpoint) — not the current architecture. | Different schema; no code consumer today. |
| **C · Both** | **NO** — per B, Supabase doesn't need it. | |
| **D · Neither** | **NO** — NEX Postgres needs it before the Wave 5 flip. | |

**Corrected answer: A only.**

**Correction to my prior audit (WORLD-CLASS-OPS-FINAL-GAP-AUDIT.md · finding C-1):** I flagged the migration-046 gap as an immediate deploy landmine. The refinement: **it is a landmine only for the Wave 5 flip path (setting `NEX_BRAIN_BACKEND=postgres`)**. Today's `supabase` backend never touches the ON CONFLICT clause in `PostgresBrainStore.enqueueJob`. The tonight tree can be deployed onto the current `NEX_BRAIN_BACKEND=supabase` production environment without immediate breakage. C-1 severity is therefore **P1 gate for the Wave 5 flip**, not P0 for the next arbitrary deploy.

The gate is still real: Wave 5 A2 cannot flip without 046 first landing on the NEX Postgres that `NEX_POSTGRES_URL` points at.

---

## 8 · Every direct Supabase touchpoint still present

### 8.1 · Env vars

- `NEX_SUPABASE_URL` — Brain adapter primary
- `NEXT_PUBLIC_NEX_SUPABASE_URL` — Brain adapter fallback + client-side reads
- `SUPABASE_URL` — generic fallback + app-level clients
- `NEX_SUPABASE_SERVICE_ROLE_KEY` — Brain adapter (server-side)
- `SUPABASE_SERVICE_ROLE_KEY` — generic app-level (server-side)
- `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY` — client-side reads
- `NEX_BRAIN_BACKEND=supabase` — the selector that keeps Brain on Supabase
- `NEX_BRAIN_SHADOW_SUPABASE` — reverse-shadow gate (Wave 7 · rollback safety)

Total: 143 grep hits across `src/` + `vercel.json` for the string patterns above.

### 8.2 · Direct client imports (`from "@supabase/supabase-js"`)

42 files, of which 6 sit inside `src/lib/nex/`:
1. `src/lib/nex/brain/adapters/supabase.ts` — the BrainStore Supabase adapter
2. `src/lib/nex/brain/adapters/supabase.wc-companion.test.ts` — test-only
3. `src/lib/nex/brain/audit-log.ts` — mirrors audit rows to Supabase `worker_audit_events`
4. `src/lib/nex/brain/warehouse.ts` — dashboard warehouse queries
5. `src/lib/nex/brains/_supabase.ts` — older per-brain wrapper
6. `src/lib/nex/supabase.ts` — shared client helper

Non-`nex.*` (36 files):
- `src/middleware.ts` — every request path
- `src/lib/supabase.ts` · `src/lib/supabaseAdmin.ts` — shared clients
- Loaders under `src/lib/`: `activity`, `feed`, `insights`, `hero-swap`, `licenses`, `signals`, `story-arcs`, `publications`, `memory`, `oauth`, `gold-path`, `events`, `live-edit`, `watermark`, `vision`, `voice`, `business-brains`, `channels`, `crons`, `llm`
- 6+ API routes under `src/app/api/` (cron/send-monthly-digests, oauth/meta/callback, vision/preprocess, story-arcs/sweep-idle, licenses/download, signals/webhook/meta, channels/connect-stub)

### 8.3 · Migration dependencies

- `supabase/migrations/*.sql` — **331 files**. This is the Supabase-legacy schema baseline. Every table starting `hammerex_*`, `app_*`, `os_*` lives here.
- `deploy/postgres/init/*.sql` — **49 files**, ending with the four tonight-authored migrations (046-049). This is the `nex.*` schema baseline for NEX Postgres.

### 8.4 · Deployment dependencies

- Vercel Project env — must set every Supabase env-var in §8.1 for the current tree to boot (else brain writes fail, middleware 500s, subsystem loaders 500s).
- Fly `nex-brain-worker` (decommissioned per Wave 1) — `fly.toml` still references Supabase env-vars. If ever re-enabled, needs Supabase available.
- `next.config.mjs:15-19` — `remotePatterns` allow-lists `msdonkkechxzgagyguoe.supabase.co` for image loading. Removing Supabase without removing this ref = images 404. Removing the ref without removing Supabase = images broken.

---

## 9 · Would any current production path fail if Supabase were completely removed?

**Answer: YES — catastrophically. Removing Supabase today breaks:**

1. **Every request that hits middleware** — custom-domain routing lookup throws.
2. **Every Brain read/write** — `NEX_BRAIN_BACKEND=supabase` means `brainStore()` returns `SupabaseStore` which fails constructor without env-vars.
3. **All ~40 subsystems** that import `@supabase/supabase-js` directly — memory, insights, feed, hero-swap, oauth callbacks, cron send-monthly-digests, story-arcs sweeper, vision preprocess, signals meta webhook, licenses download, and more.
4. **Every `hammerex_*` table read** — `hammerex_trade_off_listings` (trades connector · master audit), `hammerex_xrated_newsletter_subscribers` (newsletter connector), etc. These are the source-of-truth for merchant-facing data.
5. **Dashboard warehouse queries** — `src/lib/nex/brain/warehouse.ts` queries Supabase for reception + factory + timeline dashboards.
6. **Image loading** — `next.config.mjs` allows Supabase-hosted images; other subsystems reference `msdonkkechxzgagyguoe.supabase.co` URLs.
7. **The Wave 7 rollback safety net** — reverse-shadow's whole purpose is to mirror pg→supabase so a rollback is loss-less; no Supabase = no rollback path from a Wave-5-flipped state.

Only these classes of paths would keep working without Supabase:
- Object storage (`nex.object_blobs` on NEX Postgres · `NEX_OBJECT_BACKEND=postgres`)
- Inbox reads (`NEX_INBOX_READ_BACKEND=postgres`)
- Newer nex.* subsystems that use `@/lib/nex/db` (analytics · delivery · notifications · comms-social · contacts) — all 27 hits use the shared pg pool, not the Supabase client.
- Filesystem dev fallbacks.

---

## 10 · Contradictions against the principle "NEX Storage is the native storage layer of NEX"

Every gap between doctrine and reality, classified:

| # | Contradiction | Classification | Evidence |
|---|---|---|---|
| 1 | Brain is on Supabase, not NEX Storage or NEX Postgres, in current dev + inferred prod | **CURRENT / INTENTIONAL** — Wave 5 flip is planned; today's `NEX_BRAIN_BACKEND=supabase` is a deliberate gate awaiting A1+A2 | `.env.local` · master audit Sections 2 + 16 |
| 2 | NEX Storage runtime has no Supabase adapter (`case "supabase": throws`) | **CURRENT / INTENTIONAL** — matches Wave 2 decision "NEX Storage runtime is production standard · ImageKit/Supabase adapters not scheduled" | `src/lib/nex/storage/object-registry.ts:124-131` |
| 3 | ~40 non-brain subsystems use `@supabase/supabase-js` directly, bypassing any storage abstraction | **LEGACY** — they predate the NEX Storage runtime. Every one is a candidate for migration to `nex.*` via the shared pg pool, but the work has not been scheduled. | 703 grep hits under `src/app/` |
| 4 | Middleware creates a Supabase client on every request for custom-domain routing | **LEGACY** — subsystem predates any abstraction; correct place would be a `nex.custom_domains` table or a caching layer above NEX Postgres | `src/middleware.ts:27,301,307` |
| 5 | `hammerex_*` tables carry customer-facing data on Supabase-legacy schema | **LEGACY** — original app schema; migration to `nex.*` would require a full data-model port and is out of the current wave scope | `supabase/migrations/20260625*.sql` |
| 6 | `fly.toml` hardcodes `NEX_BRAIN_BACKEND=supabase` and Supabase env-var references | **LEGACY** — Fly decommissioned Wave 1 · file remains for reference | `deploy/nex-brain-worker/fly.toml` |
| 7 | Vercel image `remotePatterns` allow-lists `msdonkkechxzgagyguoe.supabase.co` | **LEGACY** — images hosted on Supabase Storage haven't been migrated to NEX Object Storage | `next.config.mjs:15-19` |
| 8 | Reverse-shadow (`MirrorToSupabaseBrainStore`) writes pg→supabase after a Wave 5 flip | **CURRENT / INTENTIONAL** — Wave 7 rollback safety net; only active with `NEX_BRAIN_SHADOW_SUPABASE=1` | `src/lib/nex/brain/pg-to-supabase-shadow.ts` |
| 9 | `SUPABASE_SERVICE_ROLE_KEY` sits in `.env.local` with a JWT valid ~70 years | **CURRENT / INTENTIONAL** — Supabase-provided key; rotation deferred (W-DAT-2) | `.env.local:3` |
| 10 | Contact registry (`nex.contacts`) lives on NEX Postgres but its connectors read source data from Supabase (`hammerex_*`, `app_crm_contacts`, `hammerex_xrated_newsletter_subscribers`) | **CURRENT / INTENTIONAL** — connectors are the bridge; long-term some source tables migrate to nex.* | `src/lib/nex/contacts/connectors/*.ts` |
| 11 | The Supabase adapter's `enqueueJob` does NOT use ON CONFLICT dedup that the Postgres adapter (tonight) adds | **UNINTENTIONAL semantic drift** — same interface, different guarantees; a Wave 5 flip closes the drift but until then Supabase runs without the dedup that D1 tries to provide | `src/lib/nex/brain/adapters/supabase.ts` vs `postgres.ts::enqueueJob` |
| 12 | Migration 004 (worker_audit_events) was never applied to Supabase per master audit line 90 — audit inserts silently fail | **UNINTENTIONAL** — an operator-omission gap, still live | Master audit table row 90 |
| 13 | Prod value of `NEX_POSTGRES_URL` is unknown from this repo | **UNKNOWN** — could be a managed Postgres, could be Supabase's direct-pg endpoint, could be Neon/Render/RDS. This is a 🔵 operator-owned fact. | grep of `.env.example` shows only the pattern, not the value |
| 14 | Whether a Vercel deploy today has `NEX_BRAIN_BACKEND` set (and to what) is unknown from this repo | **UNKNOWN** — 🔵 operator dashboard state | Vercel Project Settings not exposed here |
| 15 | Whether Supabase RLS on legacy `public.*` tables has been changed since W-SEC-1 was surfaced | **UNKNOWN** — needs the operator to run the pg_policies query (E10) | E10 pending |

---

## 11 · Impact on the Wave-1 authorisation decision

**Refined C-1 finding:**

- **Not** an immediate landmine for the next arbitrary deploy under `NEX_BRAIN_BACKEND=supabase`.
- **Is** a hard blocker for the Wave 5 flip (`NEX_BRAIN_BACKEND=postgres`).
- Sequencing: 046 must be applied to whatever DB `NEX_POSTGRES_URL` points at BEFORE the operator flips `NEX_BRAIN_BACKEND=postgres` on Vercel.
- If the operator applies 046 to local NEX Postgres today (localhost:5433), Wave 1 § 1.4 verifies the index is present locally. Whether the same index exists on the prod NEX Postgres is a separate 🔵 check that requires operator DB access.

Wave 1 authorisation should therefore include:
- Explicit confirmation of what `NEX_POSTGRES_URL` points at in production.
- Confirmation of the sequencing: 046 lands BEFORE A2, not after.
- No requirement to touch Supabase for 046 itself (contradicting my prior audit text — corrected here).

---

## 12 · Explicit conclusion

> **"NEX Storage is authoritative and Supabase is REQUIRED."**

**Justification:**

- REQUIRED because: (a) `NEX_BRAIN_BACKEND=supabase` is the current selector — all Brain reads/writes flow through Supabase; (b) middleware makes a Supabase call on every HTTP request for custom-domain routing; (c) ~40 non-brain subsystems import `@supabase/supabase-js` directly and their production paths break without it; (d) the `hammerex_*` customer-facing tables live only on Supabase; (e) the Wave 7 reverse-shadow rollback safety net targets Supabase.
- NOT "authoritative" in the doctrinal sense — NEX Storage runtime handles object storage and inbox reads, but Brain and dozens of subsystems still bypass it. Making the doctrine true (as opposed to aspirational) requires: Wave 5 flip + Wave 6 cutover + a per-subsystem migration of every legacy `@supabase/supabase-js` importer + middleware refactor. That is a multi-quarter programme, not a single wave.
- NOT "legacy": Supabase is running the majority of user-visible traffic today; calling it "legacy" would mislead operators into thinking it is optional. It is not.
- NOT "optional": removing it (see §9) collapses ~half the request paths.
- NOT "unknown": the state is well understood and evidenced above.

**Practical consequence for the WORLD-CLASS-OPS-REMEDIATION-PLAN.md wave sequence:**

- WAVE 1 (Migration 046) target scope narrows: **NEX Postgres only** (whichever host `NEX_POSTGRES_URL` points at). No Supabase index required.
- WAVE 1 becomes a **Wave 5 pre-flight**, not a deploy-blocker for arbitrary deploys under `NEX_BRAIN_BACKEND=supabase`.
- The prior audit finding C-1's characterisation as "the tonight tree deploy will 500 every enqueue" was **incorrect for the current backend selection**; it is **correct for the Wave 5 flip path**. Report supersedes.
- The 46-item W-C Gap Register and the 8 newly-discovered gaps are unaffected by this refinement.

---

## 13 · Stop condition

Report authored. Read-only. No code changed. No migrations applied. No fixtures touched. No prior documents modified.

Wave 1 authorisation may now proceed with the refined scope in §11 + §12 baked in.

**Stop.**

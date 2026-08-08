# HEADQUARTERS DATA STORAGE MAP · A1

**Status:** DRAFT · Phase A of Full Production-Readiness Programme
**Date:** 2026-08-09
**Scope:** Every NEX-owned data component · current storage · target storage · location transparency · migration state.
**Evidence source:** Live queries against Supabase (`ijvqdvsvwtwxzcqmoqit.supabase.co`) and our Postgres (`postgresql://localhost:5433/nex_dev`) executed 2026-08-08 · code inspection of `src/lib/nex/**` · `worker_heartbeats` observation.

**NOT included in scope:** main Thenetworkers Supabase project (`msdonkkechxzgagyguoe.supabase.co`) — belongs to the marketplace/hammerex/delivery app, NOT to NEX. Untouched by any migration.

---

## Section 1 · Storage inventory table

Every NEX data store, in one place. Legend:
- **Storage now** — where the row physically lives today.
- **Target (post-migration)** — the intended NEX Postgres or NEX Object Storage location.
- **Location-transparent?** — YES = any correctly-configured worker on any machine can read/write. NO = depends on a specific machine's filesystem.
- **Migration state:** NOT-STARTED · PREPARED · SHADOW-WRITE · BACKFILLED · CUTOVER · DECOMMISSIONED.

### 1A · Brain records (managed by `BrainStore` interface · `src/lib/nex/brain/storage.ts`)

| Component | Storage now | Target | Location-transparent? | Migration state | Evidence |
|---|---|---|---|---|---|
| `knowledge_records` | NEX Supabase · 135 AUTH · 353 REVIEW · 2879 DRAFT · 191 DEPRECATED | `nex.knowledge_records` on our Postgres | YES both | PREPARED (11.1a schema · 11.1c parity 28/28) | Live `/status` endpoint · verified 2026-08-08 |
| `record_versions` | NEX Supabase | `nex.record_versions` | YES both | PREPARED | schema 041 |
| `graph_edges` | NEX Supabase · ~5-10k rows | `nex.graph_edges` | YES both | PREPARED | schema 041 |
| `worker_jobs` (5-stage queue) | NEX Supabase · **1000+ rows** · statuses: 995 completed / 5 failed | `nex.worker_jobs` | YES both | PREPARED | REST query 2026-08-08 |
| `worker_results` | NEX Supabase · has real LLM provenance | `nex.worker_results` | YES both | PREPARED | Evidence: `nx_mskmwso5_59523073` @ 17:15:51 · groq · llama-3.3-70b · 1177ms · 3572→334 tokens |
| `sources` (provenance) | NEX Supabase · ~3000 rows | `nex.sources` | YES both | PREPARED | schema 041 |
| `confidence_scores` | NEX Supabase · ~10k rows | `nex.confidence_scores` | YES both | PREPARED | schema 041 |
| `contradictions` | NEX Supabase | `nex.contradictions` | YES both | PREPARED | schema 041 |
| `deprecations` | NEX Supabase · ~200 rows | `nex.deprecations` | YES both | PREPARED | schema 041 |
| `knowledge_feedback` | NEX Supabase · ~278 rows total · 147 unapplied | `nex.knowledge_feedback` | YES both | PREPARED | schema 041 |
| `audit_log` | NEX Supabase · ~1000+ rows | `nex.audit_log` | YES both | PREPARED | schema 041 |
| `llm_retry_queue` | NEX Supabase | `nex.llm_retry_queue` | YES both | PREPARED | schema 042 |
| `worker_heartbeats` | NEX Supabase · 20+ rows (Fly machines + local pids) | `nex.worker_heartbeats` | YES both | PREPARED | schema 042 · **live evidence of 3 competing worker sources** |
| `worker_audit_events` | Attempted NEX Supabase · **migration 004 NOT APPLIED · every insert fails silently · dual-write to filesystem Event Bus catches them** | `nex.worker_audit_events` (or delete this table entirely once Event Bus is authoritative) | Effectively NO in Supabase · YES for Event Bus fallback | BROKEN | Dev logs: `[nex-audit] insert failed (job_started): Could not find the table 'public.worker_audit_events'` |

**All 14 tables are behind `BrainStore` · `NEX_BRAIN_BACKEND=supabase|postgres|filesystem` selects the adapter. Postgres adapter passes 28/28 parity but has never processed production traffic.**

### 1B · Inbox + Dump-Jobs (Phase 11.2 shadow layer)

| Component | Storage now | Target | Location-transparent? | Migration state | Evidence |
|---|---|---|---|---|---|
| Knowledge Inbox items | Filesystem `data/knowledge-inbox/index.json` (primary) · `nex.knowledge_inbox` (shadow · 107 backfilled) | `nex.knowledge_inbox` | Filesystem: **NO** (per-machine) · Postgres: YES | SHADOW-WRITE (11.2 · gated on `NEX_INBOX_SHADOW_POSTGRES=1`) | Parity report 2026-08-08: fs=107 = pg=107 · zero drift after 3s settle |
| Inbox stats | Filesystem `data/knowledge-inbox/stats.json` (primary) · `nex.knowledge_inbox_stats` (shadow) | `nex.knowledge_inbox_stats` | Filesystem: NO · Postgres: YES | SHADOW-WRITE | Parity report OK |
| Knowledge Dump jobs | Filesystem `data/nex-jobs/jobs.jsonl` (primary) · `nex.knowledge_dump_jobs` (shadow · 25 backfilled) | `nex.knowledge_dump_jobs` | Filesystem: NO · Postgres: YES | SHADOW-WRITE | Parity report OK |

### 1C · Filesystem-only stores (no shadow yet)

| Component | Storage now | Target (proposed) | Location-transparent? | Migration state | Evidence |
|---|---|---|---|---|---|
| **Inbox content files (`.txt`)** | Filesystem `data/knowledge-inbox/content/<id>.txt` | NEX Object Storage OR `nex.knowledge_inbox_content` | **NO** · but text is denormalised into `worker_jobs.input_payload` at dispatch so workers don't need to re-read it | NOT-STARTED | `saveTextItem` writes text to disk before returning to caller |
| **Inbox uploaded files (binaries)** | Filesystem `data/knowledge-inbox/files/<id>-<name>.png` | **NEX Object Storage · REQUIRED** | **NO · This is the Harper failure root cause** | NOT-STARTED · P0 blocker for image pipeline | 4/4 image-analyst jobs failed with ENOENT because `/app/data/knowledge-inbox/files/<id>.png` doesn't exist on Fly containers |
| Event Bus events | Filesystem `data/nex-events/events.jsonl` via `src/lib/nex/storage/registry.ts` | Postgres OR NEX Object Storage (has its own storage abstraction outside 11.x scope) | NO | NOT-STARTED · out of Headquarters scope? | `emitEventSafe` writes JSONL |
| Per-brain memories (`memories.jsonl`) | Filesystem `data/nex-brains/{slug}/memories.jsonl` (`router.ts`) | Postgres OR NEX Object Storage | NO | NOT-STARTED · out of Headquarters scope? | `appendMemory` writes JSONL |

### 1D · Contact Intelligence (already on NEX Postgres)

| Component | Storage now | Target | Location-transparent? | Migration state | Evidence |
|---|---|---|---|---|---|
| `nex.contacts` | NEX Postgres (already) | Same | YES | LIVE | Registry at `src/lib/nex/contacts/registry.ts:100` |
| `nex.contact_sources` | NEX Postgres | Same | YES | LIVE | 6 connectors: Trades · Newsletter · Contact Form · Manual · fs-store · CSV |
| `nex.contact_merges`, `nex.contact_duplicate_suggestions`, `nex.contact_segments` | NEX Postgres | Same | YES | LIVE | Same |

**Finding:** Contact registry is the only NEX subsystem already fully on NEX Postgres · not blocked by 11.3. However, **the Knowledge Inbox is NOT wired as a contact connector** · dumped emails don't populate `nex.contacts` (verified 2026-08-09).

### 1E · Frozen systems (out of scope · confirmed untouched)

| Component | Storage now | Target | Notes |
|---|---|---|---|
| `nex.social_*` (Comms Social v1.0.0) | NEX Postgres | UNCHANGED | Frozen doctrine |
| Predictive engine | NEX Postgres/Supabase (out-of-Headquarters) | UNCHANGED | Frozen doctrine |
| Hammerex Social | External repo `~/hammer/` · shares Thenetworkers Supabase | UNCHANGED | Out of NEX scope |
| v1.0.0 kernel | (as-is) | UNCHANGED | Frozen doctrine |

---

## Section 2 · Location transparency matrix

The Harper failure exposed this dimension. Every store must be answered: *"Can a worker in region X read/write a component the same way a worker in region Y can?"*

| Store | Read location-transparent? | Write location-transparent? | Verdict |
|---|---|---|---|
| NEX Supabase (14 brain tables) | YES | YES | ✅ Production-safe |
| Our Postgres (`nex.*`, 14+ tables) | YES | YES | ✅ Production-safe |
| Contact registry (nex.contacts et al) | YES | YES | ✅ Production-safe |
| Inbox items (index.json + shadow) | NO from filesystem · YES from shadow when reads switch | NO · primary write is fs | ⚠️ CONDITIONAL until reads flip to Postgres |
| Inbox content `.txt` files | NO — only on origin machine | NO — only on origin machine | ❌ **FAIL** unless text is inline in job payload (currently is · for text kind) |
| Inbox uploaded binaries (PNGs, PDFs, MP3s, etc.) | NO — only on origin machine | NO — only on origin machine | ❌ **FAIL · P0 · Harper cannot run remotely** |
| Knowledge Dump jobs (JSONL) | NO — only on origin machine · shadow catches it | NO — primary write is fs | ⚠️ CONDITIONAL |
| Event Bus events | NO | NO | ❌ **NOT-PROVEN** — how does the ops timeline read events from Fly workers today? |
| Per-brain memories JSONL | NO | NO | ❌ **NOT-PROVEN** — same question |

---

## Section 3 · Migration state summary

### Currently on NEX Postgres (already the source of truth)
- Contact Intelligence · 5 tables · 6 connectors
- Comms Social v1.0.0 · frozen

### Prepared on NEX Postgres · not authoritative yet
- 14 brain tables (11.1a schema + 11.1b adapter + 11.1c parity 28/28 · `NEX_BRAIN_BACKEND=supabase` unchanged)
- 3 inbox shadow tables (11.2 · shadow-writes with `NEX_INBOX_SHADOW_POSTGRES=1` in dev only · 21/21 tests · 189/189 across suite)

### Still filesystem-primary
- Inbox items (shadowed)
- Inbox stats (shadowed)
- Knowledge Dump jobs (shadowed)
- **Inbox binary files** (not shadowed · not migratable to Postgres · needs Object Storage)
- Event Bus (has own storage abstraction · not audited yet)
- Per-brain memories (JSONL append)

### Still on NEX Supabase (11.3 flip target)
- 14 brain tables (see 1A)

---

## Section 4 · Blockers surfaced by the map

Numbered severity: **P0** = production blocker · **P1** = serious · **P2** = important · **P3** = improvement.

### P0 · Inbox binaries are not location-transparent

**Component:** Inbox uploaded files (`data/knowledge-inbox/files/`)
**Evidence:** All 4 image-analyst jobs ever attempted failed with `ENOENT /app/data/knowledge-inbox/files/<id>-<name>.png`. Fly containers can't read local Windows uploads.
**Impact:** Image pipeline is inoperable in any multi-machine deployment. Harper cannot run in production. Any future PDF/audio upload path inherits the same failure.
**Fix category:** Requires NEX Object Storage adapter · rewrite of upload endpoint to push to object store · schema change to `nex.knowledge_inbox` (`file_path` → `file_url`) · rewrite of `image-analyst.ts` to HTTP-GET.
**Belongs in:** Phase A2 (deployment audit) · then Refactor Plan.

### P0 · Multiple worker sources compete for same queue

**Component:** `worker_jobs` on NEX Supabase
**Evidence:** `worker_heartbeats` shows 3 concurrent worker sources: 2 Fly machines (`host=8ed9d16c720908` cycles=44117, `host=2870903c4d2638` cycles=44135) + local dev server (`host=<worker_type>@<pid>`).
**Impact:** Whichever polls first claims. For location-transparent work (text) this is fine. For location-dependent work (images with local file paths) the wrong machine wins and the job fails. Post-11.3 flip, Fly workers still on Supabase would be stranded (or would need coordinated redeploy).
**Fix category:** Deployment consolidation · pause Fly · Harper proof · redesign deployment so every worker uses the same NEX Postgres backend.
**Belongs in:** A2 (deployment audit) · then Refactor Plan.

### P1 · `worker_audit_events` writes fail silently

**Component:** Supabase `public.worker_audit_events` table
**Evidence:** Dev logs: `[nex-audit] insert failed (job_started): Could not find the table 'public.worker_audit_events' in the schema cache`. Migration `db/migrations/004_worker_audit_events.sql` is committed in the repo (commit 4c45c37) but **not applied to production Supabase**.
**Impact:** Audit trail is running only via the filesystem Event Bus fallback. Every deploy expects the Supabase audit table to succeed silently. When 11.3 flips to Postgres, migration 004 exists at `deploy/postgres/init/` but its equivalent for `nex.worker_audit_events` was NEVER created — 11.1a/b only added the 13 core tables + retry queue + heartbeats.
**Fix category:** Either apply migration 004 to Supabase (short-term) OR create the `nex.worker_audit_events` table on our Postgres AND wire audit-log.ts to use the postgres backend (long-term).
**Belongs in:** Refactor Plan.

### P1 · Filesystem-primary state cannot be read by cloud workers

**Component:** Inbox items index · Inbox stats · Knowledge Dump jobs · Event Bus · per-brain memories
**Evidence:** All 5 of these live on filesystem. Fly workers can't read them. Any read-path that expects these on a remote worker fails.
**Impact:** Certain dispatch decisions and downstream reactions can only happen on the machine that has the file. This is why the doctrine header on `nex-brain-cloud-worker.ts` says *"does NOT dispatch new inbox items — that reads from local filesystem and stays on Philip's Next.js machine."*
**Fix category:** Complete 11.2 by flipping inbox/jobs reads to Postgres · design storage for Event Bus + per-brain memories · align cloud-worker capabilities with the new location-transparent stores.
**Belongs in:** Refactor Plan.

### P2 · `RUN_IMAGE_ANALYST=1` gating flag documented but never checked

**Component:** `scripts/nex-brain-cloud-worker.ts`
**Evidence:** Header comment says "Set `RUN_IMAGE_ANALYST=1` once images move to Supabase Storage." Grep shows the string appears only in comments · never in code. The cloud worker runs `runImageAnalyst()` unconditionally.
**Impact:** The intended safety valve doesn't exist. Fly workers claim image jobs even without the opt-in.
**Fix category:** Small code change · gate `runImageAnalyst()` behind `process.env.RUN_IMAGE_ANALYST === "1"`.
**Belongs in:** Refactor Plan (quick win) but low priority if we're removing the legacy cloud worker anyway.

### P2 · Inbox is not a contact connector

**Component:** Contact Intelligence
**Evidence:** 6 connectors exist. Knowledge Inbox is not one of them. Dumping an email into the inbox does not create a `nex.contacts` row.
**Impact:** Documented separately — dumped email/phone in free-form text is treated as prose knowledge, never as structured contact data.
**Fix category:** New connector + extractor schema extension. Not a P0 · flag for product decision on whether Inbox emails SHOULD automatically become contacts.
**Belongs in:** Refactor Plan.

### P3 · Two Supabase projects easy to confuse

**Component:** `.env.local`
**Evidence:** `SUPABASE_URL=msdonkkechxzgagyguoe.supabase.co` (main app) + `NEXT_PUBLIC_NEX_SUPABASE_URL=ijvqdvsvwtwxzcqmoqit.supabase.co` (NEX brain). I hit the wrong one during the audit and got `PGRST205 · table not found`.
**Impact:** Every query, every migration, every operational task needs to pick the right URL. Easy source of "why is my query returning empty?" confusion.
**Fix category:** Naming discipline in docs · ideally rename `SUPABASE_URL` → `MAIN_SUPABASE_URL` for clarity · or remove main-Supabase env from NEX brain contexts entirely.
**Belongs in:** Refactor Plan (P3).

---

## Section 5 · What this map does NOT yet cover

Deliberately deferred to later audit phases:

- **Actual runtime request-path tracing per API endpoint** (needs per-endpoint drill · belongs in B)
- **RLS policy verification per table** (Compliance audit · belongs in B)
- **Consent field semantics on `nex.contacts`** (Compliance audit · belongs in B)
- **Backup/restore/PITR posture** for both Supabase projects and our Postgres (needs separate operational audit)
- **Secrets rotation posture** (Compliance)
- **Data retention timelines per table** (Compliance)
- **Encryption at rest / in transit posture** (Compliance)
- **Vector/embedding storage** (`embedding BYTEA` placeholder in schema 041 · pgvector deferred to pre-11.3 flip · not audited yet)

Each of these lands in Phase B and appears as a discrete finding with evidence.

---

## Section 6 · Cross-references

- `deploy/postgres/init/041_nex_brain_schema.sql` — 11 core brain tables schema
- `deploy/postgres/init/042_nex_brain_role_and_extended_tables.sql` — `nex_brain_app` role + retry queue + heartbeats + RLS
- `deploy/postgres/init/043_nex_knowledge_inbox_and_dump_jobs.sql` — inbox shadow tables (11.2)
- `db/migrations/004_worker_audit_events.sql` — Supabase-side · **not applied**
- `src/lib/nex/brain/storage.ts` — BrainStore interface + FilesystemStore + SupabaseStore + PostgresBrainStore
- `src/lib/nex/brain/tests/brain-adapter-contract.test.mjs` — 28/28 · Postgres adapter parity
- `src/lib/nex/brain/tests/inbox-jobs-shadow.test.mjs` — 21/21 · 11.2 shadow
- `scripts/parity-report.mjs` — inbox/jobs parity check
- `scripts/nex-inbox-jobs-backfill.mjs` — one-shot backfill
- `scripts/nex-brain-cloud-worker.ts` — Fly worker source (legacy)
- `deploy/nex-brain-worker/fly.toml` — Fly app `nex-brain-worker` in `lhr`

---

## Section 7 · Next document in the programme

**A2 · `HEADQUARTERS-WORKER-DEPLOYMENT-AUDIT.md`** builds directly on this map. It answers: given that we know WHERE data lives, WHERE do the processes that read/write it actually run, and are their locations consistent with the location-transparency verdicts in Section 2?

That's authored in the same session as A1 · same evidence base.

---

*A1 · draft · authored 2026-08-09 · to be revised as later audit findings surface additional storage layers.*

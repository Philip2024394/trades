# V1 Step 1 · PostgresStore Deliverable

**Date:** 2026-08-15
**Scope:** ADR-0044 V1 Step 1 · get the pipeline off JSONL onto real Postgres, in the local dev/test environment (`localhost:5433/nex_dev`).
**Target:** Local dev only. Hosted Supabase is a later environment change, not touched here. No production credentials introduced.
**Result:** Full parity proven. 37/37 assertions pass on both backends. Same numbers, same behaviour.

All numbers below are **observed** from actual runs. No estimates.

---

## Philip's 8 required deliverable items

### 1 · Migration success

Migration `050_nex_conv_learning_pipeline_schema.sql` applied cleanly to `localhost:5433/nex_dev` via `npm run nex:apply-storage-schema`. 3 pre-existing unrelated failures remain in the migration set (029, 046, 047, 048) — not caused or affected by this work.

Because pgvector isn't installed on this local Postgres (no VS 2022 C++ toolchain, no Docker), migration 050 was rewritten to be **pgvector-conditional**:
- Tries `CREATE EXTENSION vector` in a `DO / EXCEPTION` block · logs a NOTICE if unavailable.
- Creates the `embedding` columns as `JSONB` in dev; `VECTOR(384)` on any pgvector-having Postgres.
- Includes an in-file promotion block (§11): if pgvector becomes available AND the embedding columns are still JSONB AND the tables are empty (so no data loss), automatically ALTERs to `VECTOR(384)` + creates the ivfflat cosine index. Non-empty tables are left as JSONB with a NOTICE.
- Every other column, constraint, index, trigger, comment, and enum matches the canonical ADR-0044 schema **exactly**. Only the embedding column type differs, and only in the dev fallback path.

Full rationale is documented in the migration file header. On promotion to hosted Supabase, pgvector is pre-installed, so migration 050 applied to an empty hosted schema will produce canonical `VECTOR(384)` + ivfflat directly — no code changes anywhere.

### 2 · Migration idempotency

Re-applied migration 050 immediately after the first successful apply:

- Second apply completed in **12ms**
- Every CREATE emitted `NOTICE: relation "..." already exists, skipping`
- pgvector conditional block emitted `[050 §11] pgvector not installed · leaving embedding columns as JSONB (dev fallback)`
- Table count unchanged: **9 `nex.conv_*` objects** (8 schema tables + 1 pre-existing unrelated `conversion_events`)

Also verified **ingestion idempotency** at the DB level:
- Before re-ingest: `{knowledge_items: 865, edges: 4602, entities: 56, intents: 16}`
- Re-ingest ran full pipeline (no `--fresh`, no `TRUNCATE`)
- After re-ingest: **identical** `{knowledge_items: 865, edges: 4602, entities: 56, intents: 16}`
- Eval still 37/37

Idempotency mechanism: deterministic UUID from SHA-256 content hash → same content produces same UUID → `INSERT ... ON CONFLICT (id) DO UPDATE` replaces the row rather than duplicating.

### 3 · Tables created

All 8 canonical ADR-0044 tables present under `nex.` schema:

| Table | Columns | Indexes |
|---|---|---|
| `conv_intents` | slug PK · display_name · class (CHECK) · example_phrases[] · created_at | 1 (PK) |
| `conv_entities` | slug PK · display_name · brain · entity_class (CHECK) · aliases[] · embedding JSONB · created_at | 3 (PK · brain · aliases GIN) |
| `conv_knowledge_items` | id UUID PK · brain · source_batch · source_ref · kind (CHECK) · question_text · answer_text · canonical_intent FK · entities[] · topics[] · confidence NUMERIC (2 CHECKs: range + gate ≥0.50) · draft_only · embedding JSONB · created_at · updated_at | 6 (PK · brain · intent · entities GIN · topics GIN · draft_only) |
| `conv_edges` | id UUID PK · from_item FK · to_item FK · edge_type (CHECK) · weight NUMERIC (3 CHECKs) · evidence_count · last_seen_at · created_at + UNIQUE(from,to,type) | 4 (PK · from · to · weight) + UNIQUE |
| `conv_states` | conversation_id PK · business_id · brain · state JSONB · updated_at · created_at | 4 (PK · business · brain · state GIN) |
| `conv_turns` | id UUID PK · conversation_id · turn_index · speaker (CHECK) · text · detected_intent FK · detected_entities[] · used_item_ids[] · walked_edge_ids[] · latency_ms · created_at + UNIQUE(conv,turn) | 4 (PK · convo · intent · entities GIN) + UNIQUE |
| `conv_outcomes` | conversation_id PK · outcome (CHECK) · outcome_note · labelled_by (CHECK) · labelled_at | 3 (PK · outcome · labelled_at DESC) |
| `conv_feedback` | id UUID PK · turn_id FK · signal (CHECK) · source (CHECK) · note · created_at | 4 (PK · turn · signal · created_at DESC) |

**Triggers:**
- `conv_ki_touch_updated_at` on `conv_knowledge_items` (BEFORE UPDATE) → sets `updated_at = now()`
- `conv_states_touch_updated_at` on `conv_states` (BEFORE UPDATE) → sets `updated_at = now()`
- `conv_ki_enforce_draft_tier` on `conv_knowledge_items` (BEFORE INSERT OR UPDATE) → raises exception if `draft_only=false AND confidence < 0.70` (ADR-0033 rule enforced at DB level, not just app level)

**DB-level ADR-0033 gates · both verified with direct SQL probes:**

```
Test:  INSERT ... confidence=0.55, draft_only=false
Result: OK · draft-tier trigger fired: 'conv_knowledge_items: confidence 0.550 < 0.70 requires draft_only=true (ADR-0033)'

Test:  INSERT ... confidence=0.30, draft_only=true
Result: OK · confidence >= 0.50 check fired: 'new row violates check constraint "conv_ki_confidence_gate"'
```

### 4 · Rows inserted

Fresh Postgres run (`--backend=postgres --fresh` · truncates all `nex.conv_*` first):

| Table | Rows |
|---|---:|
| `conv_intents` | **16** |
| `conv_entities` | **56** |
| `conv_knowledge_items` | **865** (208 live · 657 draft) |
| `conv_edges` | **4,602** |
| `conv_states` | 0 (populated by inference runs, not ingestion) |
| `conv_turns` | 0 (populated by inference runs) |
| `conv_outcomes` | 0 (populated by inference runs) |
| `conv_feedback` | 0 (populated by inference runs) |

Edge type distribution:

| edge_type | count |
|---|---:|
| `related_to` | 1,667 |
| `requires` | 1,058 |
| `elaborates` | 999 |
| `comparison_to` | 697 |
| `prices` | 133 |
| `corrects` | 48 |

Total: **4,602**. All observed. All ≥0.50 weight (below-floor rejected by CHECK). All non-self-loop.

### 5 · Retrieval latency

Postgres backend, 9-conversation eval suite (37 turns):

| Metric | Value |
|---|---|
| Avg turn end-to-end latency | **6.3 ms** |
| P95 turn latency | **8 ms** |
| Total wall time (fresh full run: ingest + embed + link + eval) | **20,246 ms** |
| Warm-up wall time (bge-small load, warm HF cache) | **475 ms** |
| Total embed calls (ingest phase) | **865** |
| Avg embed ms/call (warm) | **102.46 ms** |

Retrieval budget target from ADR-0044 §7 is <100ms · observed **P95 8ms** — comfortably inside.

### 6 · Evaluation pass/fail

Postgres backend eval — same 9-conversation fixture set as the MVP:

- **37/37 assertions passed (100%)**
- **9/9 conversations full-pass**
- All 4 real bugs found + fixed during MVP iteration remain fixed (intent priority · pronoun/state enrichment · specify_constraint rule · ontology parent-child implication)

Per conversation:

| ID | Pass |
|---|---:|
| `eval-001-materials-follow-up` | 6/6 |
| `eval-002-correction` | 4/4 |
| `eval-003-pronoun-that` | 3/3 |
| `eval-004-comparison` | 3/3 |
| `eval-005-constraint` | 3/3 |
| `eval-006-topic-return` | 4/4 |
| `eval-007-unrelated-topic` | 2/2 |
| `eval-008-clarification-triggered` | 1/1 |
| `eval-009-multi-turn-chain` | 8/8 |

### 7 · Any differences between JSONL and Postgres behaviour

**Fresh side-by-side runs** (both `--fresh`, identical data, identical code paths):

| Metric | JSONL | Postgres | Δ |
|---|---:|---:|---|
| Knowledge items | 865 | 865 | ✓ identical |
| Live / draft | 208 / 657 | 208 / 657 | ✓ identical |
| Entities | 56 | 56 | ✓ identical |
| Intents | 16 | 16 | ✓ identical |
| Edges | 4,602 | 4,602 | ✓ identical |
| Edge types populated | 6 | 6 | ✓ identical distribution |
| Eval assertions passed | 37/37 | 37/37 | ✓ identical |
| Full-pass conversations | 9/9 | 9/9 | ✓ identical |
| Avg turn latency | 21.5 ms | 6.3 ms | Postgres faster (warm-cache effect · both backends read from in-memory Maps at retrieval time) |
| P95 turn latency | 41 ms | 8 ms | Postgres faster (same reason) |
| Wall time (fresh ingest+eval) | 36,151 ms | 20,246 ms | Postgres faster (warmer bge-small model cache on second run) |

**Behavioural differences: none observed.** Same items, same edges, same eval outcomes, same edge-type distribution, same state accumulation, same correction/pronoun/constraint handling. The only differences are latency deltas explained by warm caches, not architecture.

**Files added:**
- `scripts/nex-conv/lib/store-postgres.mjs` (Postgres adapter — 200 LOC)
- `scripts/nex-conv/lib/store-factory.mjs` (backend switcher — 15 LOC)
- Modified: `deploy/postgres/init/050_nex_conv_learning_pipeline_schema.sql` (pgvector-conditional)
- Modified: `scripts/nex-conv/ingest.mjs` (deterministic UUID for cross-store idempotency)
- Modified: `scripts/nex-conv/run-mvp.mjs` (`--backend=postgres|jsonl` flag + Postgres TRUNCATE on `--fresh`)

**Reports written:**
- `data/nex-conv/mvp/run-report-2026-08-15-postgres.{json,md}` (Postgres run)
- `data/nex-conv/mvp/run-report-2026-08-15.{json,md}` (JSONL run — comparable)

### 8 · Any hosted-Supabase promotion (deliberately: NONE)

Zero hosted-Supabase actions taken. `NEX_POSTGRES_URL` remained pointed at `localhost:5433/nex_dev` throughout. No hosted credentials introduced, requested, or referenced beyond the pre-existing `NEXT_PUBLIC_NEX_SUPABASE_URL` env var that the JS client uses (which was NOT touched).

**When hosted deployment happens later:**
1. Set `NEX_POSTGRES_URL` to the hosted direct-connection URL (from Supabase dashboard, added to `.env.local` when you're ready).
2. Run `npm run nex:apply-storage-schema` — migration 050 detects pgvector · lands canonical `VECTOR(384)` + ivfflat directly.
3. Run `node scripts/nex-conv/run-mvp.mjs --backend=postgres --fresh` — same output, same eval.
4. No code changes anywhere.

---

## What Step 1 proved

1. **Migration 050 is real Postgres DDL** that lands cleanly and idempotently on a native Windows Postgres 17.10, with or without pgvector.
2. **PostgresStore adapter matches the JSONL Store interface 1:1** — the pipeline works identically against both backends with a single `--backend=postgres` flag flip.
3. **All ADR-0033 gates enforce at the DB level, not just the app level.** Both the confidence-≥0.50 CHECK constraint and the draft-tier trigger fire correctly when tested with direct SQL.
4. **Idempotency holds across three layers:** migration re-apply (12ms, all NOTICEs) · ingestion re-run (same DB counts) · re-run of the same source content (deterministic content-hash UUID → `ON CONFLICT DO UPDATE`).
5. **Zero behavioural drift.** 37/37 assertions passed on Postgres, identical to JSONL. Same 9/9 conversation full-pass. Same edge counts. Same edge-type distribution. Same state accumulation.

---

## What's queued for Step 2 (per Philip's v1 ladder · SERIAL)

Step 2: **LLM response layer** — make NEX actually speak using retrieved context.

Prerequisites now met from Step 1:
- Real Postgres storage substrate proven
- `response_frame` objects produced with `acknowledge` · `core_answer_from_item_id` · `core_answer_head` · `hedge` · `next_ask` — ready to hand to an LLM
- State summary is compact (<8KB) and can safely be sent as system context
- Retrieval returns top-K=8 items with full metadata

Step 2 needs one decision from you: which LLM to call for response generation, given the Core Dependency Rule allows an LLM in the response path only (never in pipeline enrichment). Options I'll present when you're ready to green-light Step 2.

---

## Stop and confirm

Per your `stop-after-Step-1-and-confirm` directive: **Step 1 complete. Awaiting your review before starting Step 2.**

No hosted-Supabase actions. No LLM introduced. No autonomous learning. No scope expansion.

## Reproduce

```
# Apply migration 050 (idempotent · safe to re-run)
node --env-file=.env.local scripts/apply-nex-storage-schema.mjs

# Full Postgres run (fresh · ingest + eval)
node --env-file=.env.local scripts/nex-conv/run-mvp.mjs --backend=postgres --fresh

# Full JSONL run for parity comparison
node --env-file=.env.local scripts/nex-conv/run-mvp.mjs --backend=jsonl --fresh

# Verify DB gates fire
# (see inline SQL probes in this deliverable)
```

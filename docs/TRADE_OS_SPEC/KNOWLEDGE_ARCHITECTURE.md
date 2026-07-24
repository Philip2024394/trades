# Trade Intelligence Platform — architecture

The knowledge layer that powers Nex. **The LLM is replaceable. The
knowledge is not.** Everything in this document is a promise the code
enforces.

## The eight non-negotiable principles

Every knowledge entry, every edge, every review must satisfy all eight.
The DB triggers, RLS, Zod schemas and library functions all enforce
these — the principles are not aspirational.

| # | Principle | How it's enforced |
|---|---|---|
| 1 | **Searchable** | `search_tsv` (GIN) today; `embedding VECTOR(1536)` column ready for the async embedding worker. Hybrid retrieval via `hybridSearch()` combines text + vector + graph |
| 2 | **Versioned** | Every content change writes a new row into `hammerex_nex_knowledge_versions`. Append-only trigger blocks UPDATE + DELETE |
| 3 | **Reviewable** | Every proposed change routes through `hammerex_nex_review_queue`. Nothing enters live knowledge automatically |
| 4 | **Explainable** | `sources[]` + `evidence[]` + `verified_by` mandatory. UI shows source chips + version + confidence on every hit |
| 5 | **Linked** | `hammerex_nex_knowledge_edges` — directional relationships (requires, references, used_by, creates, needs, similar_to, contradicts, refines, supersedes, part_of) |
| 6 | **Source-backed** | `KnowledgeEntryDraftSchema` requires `sources.min(1)`. Migration comment enforces the invariant at review time |
| 7 | **Confidence scored** | 0-100 int, CHECK constraint. Health dashboard treats <80 as suspect |
| 8 | **Never silently overwritten** | Trigger `fn_nex_knowledge_prevent_silent_edit` rejects UPDATEs to content columns unless `app.nex_editor='true'` is set by the RPC `fn_nex_publish_new_version` |

## Data model

### `hammerex_nex_knowledge_entries` (current published state)

The fast-read row per entry. Content columns are protected — the only
way to change them is via the publish RPC which is only callable from
the approval flow.

Key columns: `id, trade, topic, title, summary, body_md, category,
subcategory, difficulty, keywords, sources JSONB, evidence JSONB,
confidence, version, status, superseded_by, embedding VECTOR(1536),
created_at, updated_at`.

### `hammerex_nex_knowledge_versions` (immutable history)

One row per published version. Append-only trigger prevents UPDATE +
DELETE. Powers the Timeline UI.

Every version records: `entry_id, version, change_kind, change_summary,
proposed_by, proposed_by_kind, approved_by, approved_at, review_id`
plus a snapshot of every content column at that version.

### `hammerex_nex_knowledge_edges` (the graph)

Directional edges between entries. `relationship` picks from a fixed
enum. `weight` (0-1) informs graph traversal ranking. `verified`
gate: merchants only see verified edges via RLS.

### `hammerex_nex_review_queue` (nothing enters silently)

Every proposed change first lands here. `kind ∈ create | edit |
correction | delete | edge | teach`. `submitted_by_kind ∈ staff |
merchant | ai | builder`. `status ∈ pending | approved | rejected |
merged | archived`. Merchants can see their own submissions via RLS.

Approval writes a new version + updates the entry. Rejection requires
notes (enforced by API). Merge dedupes duplicate suggestions.

### `hammerex_nex_teaching_uploads` (Teach Nex)

Raw uploads (PDF, guide, photo, video). Extraction worker (deferred
this pass) reads status='queued', parses, files structured drafts
into the review queue linked back via `source_upload_id`.

### `v_nex_knowledge_health` (SQL view)

Per-trade coverage. `health_pct = high-confidence entries × 5, capped
100`. Reveals where Nex is weak (the point of the whole dashboard).

## The publish flow

Never bypass this. Ever.

```
propose (submitCreate / submitEdit)
    ↓
review queue row (status=pending, submitted_by_kind)
    ↓
staff reviews in /admin/nex/review
    ↓
approveReview()
    ↓
call fn_nex_publish_new_version RPC
    ↓
    ┌─ SET app.nex_editor=true (TX-local)
    ├─ UPDATE entries table (silent-edit guard now passes)
    ├─ INSERT into versions table (append-only)
    └─ COMMIT
    ↓
review row: status=approved, resulting_version_id set
```

Nothing about this flow is optional. Even seed data goes through
`createEntryImmediate()` which still writes both an entry AND a
version row.

## Retrieval: hybrid search + graph expansion

`hybridSearch({ query, trade?, limit?, expand? })`:

1. Text search via `search_tsv` websearch — top-k text hits with
   reciprocal-rank scoring
2. Graph expansion from top 3 seeds via `traverse()` — BFS to depth 2,
   max 12 neighbours, weighted by 1/depth
3. Vector similarity (once embedding worker lands) — cosine similarity
   against `embedding` column

Combined score: `0.6·text + 0.3·vector + 0.1·graph`. Weights are
tunable constants in `search.ts` — change here, not in callers.

Every returned hit carries `reason ∈ text | vector | graph` so the UI
can explain provenance.

## Nex Learning — merchant correction flow

Merchant asks Nex a question → answer arrives with source chips →
merchant clicks "That's not right" → free-form correction lands in
review queue with kind=correction and full context (their message +
Nex's reply). Staff turns it into a proper edit or new entry via the
Studio. RLS lets the merchant see their own submission.

## Teach Nex — upload flow

Staff (pass 1) or merchant (later) uploads any document. Signed URL
returned; browser PUTs directly to Supabase Storage (never through
our API). Row lands with status='queued'. Extraction worker:

1. Reads queued rows, marks `extraction_status='extracting'`
2. Parses PDF / OCRs image / transcribes video
3. Calls LLM to produce structured `KnowledgeEntryDraft[]`
4. Files each draft as a review queue item linked via `source_upload_id`
5. Marks upload `extraction_status='extracted'` + `extracted_entries_count`

**The worker itself is not shipped this pass.** Storage path, DB row,
and review-queue linkage are ready. Drop in the worker any time.

## What's shipped

**Phase 2 (foundation):**
- 5 tables + 1 view + 1 RPC + 5 triggers + 6 RLS policies
- TypeScript library at `src/lib/nex/intelligence/` (7 modules)
- 6 admin API routes + 2 merchant-facing endpoints
- 4 admin UI pages (Knowledge Studio, Review Queue, Health, Timeline, Teach)
- Nex chat "That's not right" correction affordance on knowledge answers
- 10 seeded knowledge entries + 10 seed versions

**Phase 3 (this pass — brain that grows itself):**
- Research reports table + `runResearch()` pipeline that drafts candidates via LLM reasoning, diffs against existing knowledge, files each draft in the review queue linked to the report
- Weekly report table + cron `/api/cron/nex-weekly-report` writes Monday-morning summary
- Health view extended: Official vs Company split, Outdated (>365 days), Growth series
- Source Library view (from prior pass) still live
- Merchant identity + continuity: greeting reads `nex_last_seen_at`, produces "Good morning Phil. Welcome back. 3 items waiting for your review."
- Chat intents added: **research** (topic capture), **teach** (learn this), **approve_all** (with confirm guardrail), **what_changed** (recent activity summary)
- Rich review diff view: current vs proposed side-by-side for edit reviews
- Research history + report detail admin pages
- Weekly report admin page

**73 passing tests across 11 files** including greeting time-of-day + last-seen, all new intents, and everything from prior passes.

## Research pipeline — honest limits

Pass 1 (this pass) uses Claude reasoning (via `reasonJson`) to draft
candidate entries. Sources cited are attributed by name, not URL, and
every draft carries confidence <100 so approvers know it needs
verification. The `method` column on `hammerex_nex_research_reports`
records `"reasoning"` so downstream audits can spot pre-web-fetch data.

Pass 2 (deferred): swap the reasoning-only drafter for a real web-fetch
worker (Firecrawl / server-side fetch of gov.uk pages + PDF parser).
Same interface, same review flow. The `method` column becomes
`"web-fetch"` or `"hybrid"`. Storage bucket for fetched raw HTML +
PDFs slots into the existing `hammerex_nex_teaching_uploads` table.

## Chat as the primary command surface

Phil can drive the platform from `/nex`:

| Merchant says | Nex does |
|---|---|
| "Nex, research UK staircase guidance" | Runs `runResearch()`, returns count + link to report |
| "Nex, learn this: max rise 220mm" | Files a create review with confidence 60 |
| "What changed this week?" | Reads versions since Monday, lists them |
| "Approve everything" | Returns count + confirmation prompt (never auto-fires) |
| "Approve everything, confirm" | Bulk-approves (staff only) |
| "Design my van" | Invokes Van Wrap Studio |
| "What's the VAT threshold?" | Retrieves from knowledge, cites source |
| "That's not right" (after any answer) | Files correction with full context |

The chat never bypasses the review workflow. Every write path lands
in `hammerex_nex_review_queue` first.

## Not shipped this pass (documented)

- **Embedding worker** — column is ready, hybridSearch factored to
  consume vectors. Needs OPENAI_API_KEY + a background job runner.
- **PDF/OCR/transcription extraction worker** — same story. Storage +
  DB + review-queue linkage in place.
- **Edge-proposal AI** — LLM proposes graph edges after entries land.
  Structure is ready via `proposeEdge()` + verified flag.
- **Coverage-target taxonomy** — health formula is deliberately rough
  (high-confidence × 5). Real taxonomy of expected topics per trade
  lands once staff has curated 5+ trades manually and we can spot the
  shape.
- **Vector index tuning** — HNSW index config waits for real vector
  data volume.

## Guardrails you cannot bypass

1. Direct `UPDATE hammerex_nex_knowledge_entries SET title=...` from
   anywhere (route handler, admin UI, cron) is rejected by the trigger.
   Use `publishNewVersion()`.
2. `UPDATE` or `DELETE` on the versions table is rejected by the
   append-only trigger. History is forever.
3. Merchants can't read another merchant's review submissions (RLS).
4. Merchants can only see verified edges (RLS).
5. Reject-review requires notes (enforced by the review-action API).

If the system starts drifting from these principles, add a test to
`src/lib/nex/intelligence/*.test.ts` that reproduces the drift. The
architecture only stays true because the tests keep it true.

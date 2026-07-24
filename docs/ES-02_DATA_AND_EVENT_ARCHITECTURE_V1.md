# ES-02 · Nex Data & Event Architecture v1.0

**Data platform blueprint · 2026-07-23**
**Purpose:** the single source of truth for how Nex stores data, models domains, emits events, and evolves its schema. Every module writes and reads under these rules. Ratifies ES-01's data-layer decisions with concrete detail.

**Related documents:** ES-01 Engineering Execution Bible (wins on architecture) · Master Architecture v1.0 (wins on product) · Build Execution Playbook v1.0 (wins on delivery timing).

---

## Section 1 — Data Philosophy

Every data decision at Nex is checked against these ten principles. When a decision fails one, the decision changes.

### 1.1 Single Source of Truth

Every fact has one authoritative row. Cross-module reads happen through the owning module's public interface; no reaching into another module's tables directly. Copies of data outside their owner are caches, not truth, and are marked as such.

### 1.2 Event First

Every material state change emits a typed event before returning. Consumers subscribe rather than poll. The event log is durable; consumers can be added after the fact and backfilled.

### 1.3 Audit Everything

Every write records who + when + why. Every action that changes a merchant-visible outcome (money, communication, scope) is immutably logged. Deletion means the row's `deleted_at` populates; never physical row removal outside GDPR flows.

### 1.4 Immutable History

Corrections chain; corrections do not overwrite. Whether it's Memory corrections, Twin events, or Workforce audit entries, the historical record is preserved. Legal admissibility depends on it.

### 1.5 Construction Memory First

Every module writes to and reads from the Memory Engine as a first-class concern. Data that doesn't go into memory is invisible to the platform's compound intelligence.

### 1.6 Privacy by Design

Every cross-tenant surface goes through K-anonymity gating. PII never crosses tenant boundaries. Regional granularity is capped at ONS-region / AU-state / IE-province. Merchant opt-out is a first-class database field, honoured at query time.

### 1.7 Multi-Tenant, Single Postgres

Rejected in ES-01: per-tenant databases. Adopted: single multi-tenant Postgres with row-level security. Every tenant table carries `merchant_slug` (or `owner_*_id`) as an indexed column; RLS policies enforce isolation.

### 1.8 Scalable in Layers

The design scales to 100k merchants without change. Beyond that, partitioning + replicas + regional deploys arrive in tiers. Do not pre-optimise for scale we don't have.

### 1.9 Type-Safe End to End

Every table has a TypeScript type generated from the schema. Every column has a Zod validator at the write boundary. Runtime type mismatches are impossible in normal operation.

### 1.10 Cost-Conscious

Storage is cheap; queries are not. Every hot query has an index. Every wide table is partitioned. Every event log has an archival tier. LLM cost is monitored per merchant per day.

---

## Section 2 — Complete Domain Model

Every domain, its owning module, and its key entities.

### 2.1 Domain inventory

| Domain                | Owning module   | Key entities                                                       |
| --------------------- | --------------- | ------------------------------------------------------------------ |
| Users                 | auth (existing) | user, merchant_membership, team_membership                          |
| Companies (Merchants) | auth + tenancy  | merchant, merchant_profile, merchant_settings                      |
| Projects              | pi + twin-live  | project, project_phase, project_member                             |
| Buildings (Passports) | cc              | property, property_component, property_history                     |
| Customers             | cx              | customer, customer_project, review                                 |
| Trades                | brains + world  | trade_registry, trade_regional_variant                             |
| Trade Brains          | brains          | brain, brain_module, brain_version                                 |
| Construction Memory   | memory          | memory_user, memory_company, memory_project, memory_trade, memory_region, memory_industry, memory_market |
| Knowledge Graph       | bos             | graph_node, graph_edge, graph_edge_weight                          |
| SiteBook              | pi (extension)  | site_log, site_photo, snag, delivery                                |
| Estimator             | est + estimator | estimate, estimate_line, quote, quote_revision                     |
| Finance               | fi              | invoice, payment, cost, vat_return                                 |
| Marketplace           | mp              | listing, search, search_result_impression                          |
| Trade Centre          | (existing)      | product, product_variant, product_order                             |
| Digital Twin          | twin-live       | twin_event, twin_snapshot, twin_perspective                        |
| AI Workforce          | workforce       | workforce_role, workforce_task, workforce_approval, workforce_kpi   |
| Business Builder      | builder         | builder_session, builder_assumption, verified_claim                 |
| Market Intelligence   | market          | market_signal, market_forecast, market_ingest_feed                 |
| Documents             | docs            | document, document_version, document_access_grant                   |
| Media                 | media           | media_asset, media_variant, media_metadata                          |
| Notifications         | notify          | notification, notification_channel, delivery_receipt                |
| Analytics             | analytics       | metric_event, metric_rollup                                        |
| Permissions           | rbac            | role, permission, role_grant                                       |
| Settings              | settings        | tenant_setting, user_setting                                       |

### 2.2 Cross-domain relationships (the map)

```
Users ─┬─→ Merchant (many-to-many via merchant_membership)
       └─→ Team (roles per module)

Merchant ─┬─→ Projects (owner)
          ├─→ Customers (owner)
          ├─→ Estimates (owner)
          ├─→ Invoices (owner)
          ├─→ Trade Brains (which are hired/active)
          ├─→ Workforce Employees (which are hired)
          ├─→ Memory rows (all layers scoped to merchant)
          └─→ Settings + Permissions

Project ─┬─→ Property (address linkage, optional)
         ├─→ Customer (single)
         ├─→ Estimate(s)
         ├─→ SiteBook entries
         ├─→ Twin events (event log per project)
         ├─→ Deliveries
         └─→ Documents

Property ─┬─→ Projects (multiple projects can share a property)
          └─→ Property History (Twin data survives project handover)

Trade Brain ─→ Knowledge Graph nodes (Brain owns nodes in its speciality)

Memory ─→ read + written by every module

Workforce Employee ─→ acts on behalf of merchant · logs to audit

Market Signal ─→ derived from cross-tenant memory + external feeds
```

### 2.3 Key relationship rules

- Every entity carries `merchant_slug` (tenant scope) unless it is shared globally (trade registry, knowledge graph global nodes, market signals)
- Every entity carries `created_at` + `updated_at`
- Every merchant-scoped entity has an RLS policy filtering on `merchant_slug`
- No cross-tenant foreign keys ever

---

## Section 3 — Database Design

### 3.1 Naming conventions

- Tables: `hammerex_nex_<domain>_<entity>` (matches shipped convention)
- Columns: `snake_case`
- Primary keys: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Foreign keys: `<referenced_table>_id UUID REFERENCES ... ON DELETE <policy>`
- Booleans: `is_<state>` or `has_<state>`
- Timestamps: `<verb>_at TIMESTAMPTZ`
- Every table: `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 3.2 Primary keys

UUIDs universally. Rationale:

- Cross-service safety (no ID collisions if we ever extract services)
- Merchant-safe (integer IDs leak count information)
- Distributable (can generate client-side)

Serial integers only for high-write append-only tables (event logs) where sortability by insertion order matters.

### 3.3 Foreign keys + delete policies

- Tenant-scoped tables always cascade delete on merchant deletion
- Project-scoped tables cascade on project deletion
- Cross-module references use `ON DELETE SET NULL` where the relationship is optional, `RESTRICT` where the relationship is required
- Never `CASCADE` across module boundaries; audit logs must survive

### 3.4 Standard columns on every tenant table

```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
merchant_slug     TEXT NOT NULL,
created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by        UUID REFERENCES auth.users(id),
deleted_at        TIMESTAMPTZ,           -- soft delete
version           INTEGER NOT NULL DEFAULT 1
```

### 3.5 Audit fields

For high-integrity entities (Finance, Workforce actions, Memory corrections):

```sql
audit_correlation_id  UUID,               -- links related audit entries
audit_reason          TEXT,               -- why this change happened
audit_source          TEXT,               -- "user" | "agent:<id>" | "cron" | "system"
```

### 3.6 Versioning

- Optimistic concurrency via `version` column
- Every UPDATE increments version; write fails if `WHERE version = <expected>` matches zero rows
- Application layer retries on version conflict with fresh read

### 3.7 Soft deletes

- `deleted_at` populated instead of row removal
- RLS policies filter `WHERE deleted_at IS NULL` by default
- Hard delete only for GDPR right-to-be-forgotten flows
- Restore = clear `deleted_at`

### 3.8 Indexing strategy (concrete)

Every tenant table has:

- Composite index on `(merchant_slug, created_at DESC)` for range queries
- Composite index on `(merchant_slug, deleted_at)` for RLS + soft-delete filter
- Additional composite indexes per common query pattern

Memory + signal tables additionally have:

- `(owner_id, subject)` for structured retrieval
- `(subject, region, observed_at DESC)` for cross-tenant reads
- Partial `WHERE correction_of IS NOT NULL` for correction chain traversal

Twin events additionally have:

- `(project_id, kind, observed_at DESC)` for perspective queries
- `(project_id, observed_at DESC)` for timeline queries
- Partitioned by `observed_at` (month)

Full-text search:

- tsvector generated columns per Phase 4 knowledge pattern (already shipped)

Vector search:

- pgvector HNSW indexes with `m=16, ef_construction=64` defaults

### 3.9 Constraints

- NOT NULL on every column that has a semantic meaning
- CHECK constraints on enum-like columns (per Phase 26 memory shipped pattern)
- UNIQUE constraints on natural business keys where applicable (`merchant_slug` on merchant table)
- No enum types; text + CHECK for schema evolution flexibility

### 3.10 Partitioning strategy

Partition when a table crosses:
- 100M rows, OR
- 50GB, OR
- P95 query time > 100ms and index doesn't help

Immediate partitioning candidates:

- `hammerex_nex_twin_events` — partition by observed_at month
- `hammerex_nex_platform_events` — partition by observed_at month
- `hammerex_nex_workforce_audit_log` — partition by observed_at month
- `hammerex_nex_memory_project` (once merchant density grows) — partition by hash(merchant_slug)

Postgres native declarative partitioning. No third-party tools.

### 3.11 Scaling strategy per tier

- **Up to 100k merchants:** single Supabase Postgres, current infrastructure
- **100k-500k:** add read replicas for read-heavy modules · scale write leader vertically
- **500k-1M:** consider extracting Twin event log to a purpose-built store (ClickHouse or dedicated Postgres partition set) · consider archival tier for cold data
- **1M+:** regional deployments (data residency) · cross-region read replicas · ML-optimised storage

Every tier's migration path is planned + rehearsed before the tier is reached.

### 3.12 Table inventory (references)

Complete inventory in ES-01 §6 and Playbook §6. Every new phase's tables are documented in their phase blueprint.

---

## Section 4 — Event Model

Complete catalogue of every platform event.

### 4.1 Event shape (canonical)

```typescript
{
  event_id:            string;    // UUID, unique per emission
  kind:                string;    // e.g. "project.created"
  version:             number;    // schema version of this event kind
  merchant_slug:       string;    // tenant scope
  correlation_id?:     string;    // links to originating event chain
  causation_id?:       string;    // the event that caused this one
  actor_kind:          "user" | "agent" | "cron" | "system";
  actor_id?:           string;    // user_id or agent_id
  payload:             Record<string, unknown>;
  observed_at:         string;    // when the underlying thing happened
  emitted_at:          string;    // when we recorded the event
  is_replay:           boolean;   // true if this is a replayed event
}
```

Every event is persisted to `hammerex_nex_platform_events` before dispatch.

### 4.2 Event catalog

Grouped by domain. Not exhaustive — the catalog grows as new phases ship.

**Users + Merchants:**

- `user.registered` · `user.verified_email` · `user.deleted`
- `merchant.registered` · `merchant.verified` · `merchant.upgraded_tier` · `merchant.downgraded_tier` · `merchant.deleted`
- `team.member_added` · `team.member_role_changed` · `team.member_removed`

**Projects:**

- `project.created` · `project.updated` · `project.status_changed` · `project.completed` · `project.cancelled`
- `project.phase_started` · `project.phase_completed`

**Customers:**

- `customer.added` · `customer.updated` · `customer.review_received`

**Estimator:**

- `estimate.drafted` · `estimate.reviewed_by_merchant` · `estimate.approved_by_merchant` · `estimate.sent_to_customer` · `estimate.viewed_by_customer` · `estimate.accepted` · `estimate.rejected`
- `quote.revised` · `quote.accepted` · `quote.expired`

**Finance:**

- `invoice.issued` · `invoice.sent` · `invoice.paid` · `invoice.overdue` · `invoice.written_off`
- `payment.received` · `payment.failed`
- `cost.recorded` · `cost.categorised`

**SiteBook:**

- `sitebook.entry_added` · `sitebook.photo_uploaded` · `sitebook.snag_opened` · `sitebook.snag_resolved` · `sitebook.inspection_recorded` · `sitebook.sign_off_recorded`

**Digital Twin:**

- `twin.created` · `twin.event_appended` · `twin.snapshot_taken` · `twin.anomaly_detected` · `twin.handover_generated` · `twin.transferred_to_new_owner`

**Trade Brains:**

- `brain.activated` · `brain.consulted` · `brain.updated` · `brain.corrected_by_merchant`

**Memory:**

- `memory.row_written` · `memory.correction_appended` · `memory.rollup_generated` · `memory.decayed`

**Marketplace + Trade Centre:**

- `listing.created` · `listing.updated` · `listing.deleted`
- `product.added` · `product.updated`
- `search.executed` · `search.result_clicked`
- `order.placed` · `order.fulfilled` · `order.refunded`

**AI Workforce:**

- `workforce.role_hired` · `workforce.role_retired` · `workforce.role_promoted`
- `workforce.task_assigned` · `workforce.task_completed` · `workforce.task_failed`
- `workforce.approval_requested` · `workforce.approval_granted` · `workforce.approval_rejected`
- `workforce.action_executed` · `workforce.emergency_stop_triggered`

**Business Builder:**

- `builder.session_started` · `builder.assumption_recorded` · `builder.business_published` · `builder.claim_verified`

**Market Intelligence:**

- `market.signal_ingested` · `market.forecast_computed` · `market.report_generated`

**Documents:**

- `document.uploaded` · `document.version_added` · `document.access_granted` · `document.access_revoked`

**Compliance:**

- `regulation.published` · `regulation.changed`
- `gdpr.export_requested` · `gdpr.deletion_requested` · `gdpr.deletion_completed`

**Vision:**

- `vision.image_analysed` · `vision.finding_recorded`

### 4.3 Publisher / subscriber matrix

Every event has:

- **Publisher** — exactly one module owns emission
- **Subscribers** — any number of modules receive
- **Payload** — typed, versioned schema
- **Retry** — 3 immediate retries with exponential backoff; then dead-letter queue
- **Failure handling** — subscriber failures don't affect publisher; failed events replay after fix
- **Idempotency** — every subscriber records processed `event_id`; re-delivery is safe
- **Priority** — normal by default; urgent for safety + emergency events

### 4.4 Event delivery mechanism

Two paths:

1. **Postgres LISTEN/NOTIFY** — for in-process realtime delivery within the same deployment; fastest, lightest
2. **Task queue table** — for durable delivery + retry; slower but reliable

Publisher chooses based on delivery guarantee. Emergency stop uses NOTIFY (instant); financial actions use task queue (durable).

### 4.5 Retry strategy (concrete)

- Attempt 1: immediate
- Attempt 2: +30 seconds
- Attempt 3: +5 minutes
- Attempt 4: +1 hour (final attempt)
- Failure → dead-letter queue → CTO-alerted if accumulation exceeds threshold

### 4.6 Idempotency

Every subscriber:

- Records processed `event_id` in its subscriber-specific state table
- Checks on every event: if already processed, return success without side effect
- Retention: 30 days of processed IDs (protects against most retry windows)

### 4.7 Ordering

- Ordering guaranteed per event kind per merchant (partitioned by `merchant_slug` in the queue table)
- No cross-kind global ordering (unnecessary complexity)

---

## Section 5 — Construction Memory Model

Detailed data model for Phase 26 Memory Engine.

### 5.1 What Memory stores

- **Facts** — atomic observations with subject/predicate/value/evidence
- **Experiences** — merchant-specific patterns (their supplier preferences, their pricing style)
- **Conversations** — chat history with retention rules per tier
- **Projects** — every project's atomic memory rows survive the project
- **Images** — Vision-extracted findings (references to media in Media service)
- **Videos** — Vision-extracted per-frame findings
- **Lessons** — merchant-tagged learnings ("always check wall run flatness")
- **Trade Knowledge** — Brain-authored facts + Brain-corrected facts
- **Business Rules** — merchant-declared preferences (min margin, safe supplier set)
- **AI Decisions** — every autonomous action logged with rationale
- **Historical Context** — memory decays but never disappears; correction chains preserved

### 5.2 Layer separation

Seven layers per ES-01 §6:

| Layer     | Owner        | Cross-tenant visibility     | K threshold |
| --------- | ------------ | --------------------------- | ----------- |
| user      | single user  | Owner only                  | —           |
| company   | merchant     | Owner + team members        | —           |
| project   | project      | Project participants        | —           |
| trade     | trade slug   | All merchants in that trade | K≥10 pricing, K≥5 demand |
| region    | region       | All merchants in that region | K≥10 pricing, K≥5 demand |
| industry  | cross-trade  | Paying subscribers          | K≥20 margin, K≥10 pricing |
| market    | supplier+spec| Paying subscribers          | K≥20 margin, K≥10 pricing |

### 5.3 Row envelope (shared shape)

Per Phase 26 blueprint §1.2. Key fields:

- `id`, `layer`, `owner_*_id`, `subject`, `predicate`, `value_json`, `unit`
- `observed_at`, `sample_size`, `confidence`, `is_official`, `is_verified`
- `visible_to`, `source_engine`, `evidence_tables`, `decays_at`, `correction_of`

### 5.4 Retrieval strategy

Every read is:

1. **Scoped** by `merchant_slug` (own layers) or K-anonymity-gated (cross-tenant)
2. **Correction-aware** — newest un-superseded row per subject is returned
3. **Decay-aware** — decayed rows deranked but not hidden
4. **Confidence-badged** — every returned row surfaces its confidence
5. **Evidence-chained** — every returned row's evidence tables listed

Read patterns:

- Exact subject match (`subject = X`)
- Prefix match (`subject_like = 'pricing.'`)
- Semantic match (V3+, via pgvector on `subject` or `value_text`)
- Range match (`observed_at >= X AND observed_at <= Y`)

### 5.5 Write strategy

- Merchant-authored writes: direct to memory rows
- Engine-authored writes (adapters): via `writeMemory()` with source_engine attribution
- Rollup writes: cron-generated, tagged `source_engine = 'rollup'`
- Correction writes: append with `correction_of` set

### 5.6 Rollup pipeline

Nightly cron:

1. Query atomic rows written since last rollup
2. Group by (layer_target, subject, region, trade)
3. Compute median, p50, p95, count
4. K-anonymity check per §5.2 thresholds
5. Write rollup row with `source_engine = 'rollup'`, `sample_size = count`
6. Log to `hammerex_nex_memory_transparency_log` — merchants can see what their data contributed to

### 5.7 Retention + decay

- Regulations: never decay
- Pricing / financial: decay window 180 days (drop confidence 1 tier per half-life)
- Market / supplier: decay window 90 days
- Everything else: decay window 365 days

Decay is a query-time consideration; rows aren't deleted.

---

## Section 6 — Knowledge Graph Model

### 6.1 Structure

Per Phase 25 BOS graph seed + Phase 27 extension:

**Nodes** — trades · sub-trades · tools · materials · suppliers · regulations · certifications · adjacent trades · standards

**Edges** — typed relationships:

- Trade `requires` Skill
- Trade `uses` Tool
- Trade `consumes` Material
- Material `sold_by` Supplier
- Supplier `delivers_to` Region
- Trade `regulated_by` Regulation
- Regulation `scoped_to` Region
- Trade `adjacent_to` Trade
- Project `instance_of` Trade
- Project `uses` Material
- Project `produces` CustomerReview
- Customer `pays` Merchant (weight = median days)
- Merchant `operates_in` Region

### 6.2 Tables

```sql
hammerex_nex_graph_nodes (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL,           -- 'trade' | 'material' | ...
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  metadata JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

hammerex_nex_graph_edges (
  id UUID PRIMARY KEY,
  from_node_id UUID REFERENCES hammerex_nex_graph_nodes(id),
  to_node_id UUID REFERENCES hammerex_nex_graph_nodes(id),
  kind TEXT NOT NULL,           -- edge type
  weight NUMERIC,               -- observed frequency or strength
  confidence TEXT,              -- 'low'|'medium'|'high'
  version INTEGER,
  observed_at TIMESTAMPTZ,
  computed_at TIMESTAMPTZ,
  source_engine TEXT
);

CREATE INDEX idx_graph_edges_from ON hammerex_nex_graph_edges(from_node_id, kind);
CREATE INDEX idx_graph_edges_to ON hammerex_nex_graph_edges(to_node_id, kind);
```

### 6.3 Edge weighting

- Static seed weight = 1.0
- Observed weight updated from memory rollups (edge count / total possible)
- Confidence bumps for K-gated cross-tenant observation
- Weights decay same as memory rows

### 6.4 Versioning

Edges are append-only when significant weight change (>10%) occurs. Prior versions retained for time-travel queries.

### 6.5 Trade-specific links

Each Trade Brain owns:

- Its craft nodes (concepts within the trade)
- Its material subset of the global material graph
- Its tool subset
- Its regulation subset
- Its adjacent-trade edges (cross-trade learning)

Query pattern for Brain use:

```typescript
// "What tools do I need for a Cardiff plumbing job?"
graph.query({
  from: trade("plumbing"),
  through: ["uses"],
  filter_region: "cardiff",
  min_confidence: "medium"
})
```

### 6.6 Cross-Brain learning

Adjacency edges (`Trade adjacent_to Trade`) allow one Brain to inform another. When Roofing has 10× more data than Solar PV on rafter spacing, Solar PV can traverse the `adjacent_to` edge to Roofing for a calibrated inference — marked as inferred, not direct.

---

## Section 7 — Vector Search

### 7.1 Where embeddings live

pgvector columns on:

- `hammerex_nex_knowledge_entries` (already shipped) — knowledge base semantic search
- `hammerex_nex_memory_company` (V3+) — semantic recall over structured facts
- `hammerex_nex_documents` — document search
- `hammerex_nex_estimates` — "similar past estimate" retrieval
- `hammerex_nex_products` — product catalogue search
- `hammerex_nex_project_summaries` — cross-project pattern lending (Phase 29 V3)

### 7.2 Embedding model

- **Provider:** OpenAI `text-embedding-3-small` for cost efficiency; upgrade to `-large` when accuracy demands
- **Alternative:** Voyage `voyage-2` (cheaper at scale, comparable quality)
- **Vector dimension:** 1536 (matches text-embedding-3-small)
- **Storage:** pgvector `vector(1536)` column

### 7.3 Chunking strategy

- **Knowledge entries:** whole entry embedded (typically < 2000 tokens)
- **Documents:** split by section or 500-token windows with 100-token overlap
- **Estimates:** scope + line items concatenated, embedded as one vector
- **Project summaries:** structured summary of key facts embedded

### 7.4 Indexing

HNSW index with defaults `m=16, ef_construction=64`. Tune per corpus:

- Knowledge: `ef_search=100` for quality-first
- Documents: `ef_search=50` for latency-first
- Estimates: `ef_search=200` for precision-first ("very similar past estimate")

### 7.5 Retrieval pattern

```typescript
// hybrid retrieval — combine vector + full-text + structured filters
const candidates = await hybridSearch({
  query_text: "loft conversion in Dublin",
  vector_top_k: 20,        // pgvector similarity
  fts_top_k: 20,           // tsvector full-text
  filters: { region: "IE", trade: "carpentry" },
  merge_strategy: "reciprocal_rank_fusion",
  final_limit: 3           // per merchant memory rule "always return 3"
});
```

### 7.6 Embedding refresh strategy

- On write: embedding computed and stored synchronously for critical entities (knowledge)
- On write: enqueued for background embedding for less-critical (documents, project summaries)
- On model upgrade: bulk re-embed via cron; migration prevents mixing dimensions

---

## Section 8 — Media Architecture

### 8.1 Storage strategy

Supabase Storage buckets:

- `photos` — merchant + homeowner photo uploads (SiteBook, portfolio, gallery)
- `videos` — merchant + homeowner video (SiteBook progression, portfolio)
- `drones` — drone photogrammetry captures (Phase 29 V2+)
- `drawings` — CAD drawings, floor plans, PDFs
- `certificates` — completion certificates, insurance policies, warranties
- `documents` — general PDFs
- `voice` — merchant-side scope-capture audio (never customer-facing)
- `avatars` — AI employee avatars (generated once + cached)
- `logos` — merchant brand logos
- `reports` — generated PDFs (handover packs, Regional Market Reports)
- `exports` — GDPR data-portability exports

### 8.2 URI conventions

Every media asset row has:

- `bucket` — bucket name
- `path` — storage path
- `content_type` — MIME
- `size_bytes`
- `checksum_sha256`
- `visibility` — `owner_only` | `owner_and_customer` | `public`
- `retention_policy` — `hot` | `warm` | `cold`

### 8.3 Compression + variants

Every image on upload generates:

- Original (preserved for evidence integrity)
- Web variant (max 2048px, WebP, quality 85)
- Thumbnail (400px, WebP, quality 80)

Videos: transcoded to H.264 web variant + thumbnail (first frame).

Transcoding runs in background workers on upload.

### 8.4 Retention

- **Hot** (Supabase Storage): 90 days
- **Warm** (Storage default tier): 12 months
- **Cold** (archived): thereafter

Retention rules per bucket vary; per platform rules construction contracts require 6-12 years of retention for legal evidence.

### 8.5 Permissions

- Every media row has RLS policy matching `merchant_slug`
- Signed URLs generated on demand for public-ish assets (customer-shared photos)
- Time-limited signed URLs (5-minute default)
- Public assets (marketing site) use CDN direct

### 8.6 Vision AI integration

- On photo upload: enqueue Vision AI analysis
- Vision output writes findings to relevant module (Twin, Estimator, SiteBook)
- Original photo referenced, not copied

### 8.7 Constitutional constraint

- No voice on customer purchasing path (per platform rule)
- Merchant-side voice for scope capture only; transcription local (browser Web Speech API) with merchant review before it enters any pipeline

---

## Section 9 — Audit + Compliance

### 9.1 What is audited

Every write that changes:
- Money (payments, invoices, costs)
- Communication (customer messages, marketing sends)
- Scope (project changes, variations)
- Permissions (role changes, delegations)
- Autonomous action (agent decisions)
- Cross-tenant read (Memory rollup access)

### 9.2 Audit log shape

```sql
hammerex_nex_platform_audit_log (
  id BIGSERIAL PRIMARY KEY,
  merchant_slug TEXT NOT NULL,
  actor_kind TEXT NOT NULL,    -- 'user' | 'agent' | 'cron' | 'system'
  actor_id TEXT,
  action_kind TEXT NOT NULL,   -- 'invoice.sent' | 'agent.action.executed' | ...
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  correlation_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Partitioned by `occurred_at` month.

### 9.3 Immutability

Append-only. No UPDATE or DELETE allowed except for GDPR-forced deletion (subject to retention floor per jurisdiction).

### 9.4 Legal retention

- UK construction contracts: 12 years retention typical for building work
- General business: 7 years for tax
- GDPR right-to-be-forgotten: cascade deletes except where legal retention supersedes
- Audit log retention: 24 months hot, 10 years cold

### 9.5 GDPR export

Merchant-triggered export produces:

- All rows across every table where `merchant_slug = <slug>`
- Zip file with per-table JSON exports + media asset manifest
- Delivered as signed URL (7-day expiry)
- Logged as `gdpr.export_completed` event

### 9.6 GDPR deletion

Cascade delete driven by `hammerex_nex_platform_gdpr_requests`:

- All tenant tables' rows soft-deleted then hard-deleted after 30-day appeal window
- Media assets deleted from storage
- Memory rows deleted (including contributions to rollups; rollups recomputed)
- Audit log rows retained per legal retention floor with PII redacted
- Confirmation logged + emailed

### 9.7 SOC2 readiness

- Structured logs
- Immutable audit
- Principle of least privilege enforced
- Secrets management (Vercel + Supabase)
- Encryption in transit + at rest
- Annual penetration test
- Aim for SOC2 Type 1 by end Y2 · Type 2 by end Y3

---

## Section 10 — Performance

### 10.1 Caching strategy

Three tiers:

1. **Vercel Edge Cache** — public marketing pages, tradesite public pages (with tenant-specific query strings)
2. **Redis (Upstash)** — expensive computed values with explicit TTL + invalidation
3. **Postgres materialized views** — expensive cross-table aggregates refreshed nightly

Redis-cached values:

- Twin state snapshots (rebuild takes seconds; cache saves user time; invalidated on any Twin event)
- Regional benchmark reads (5-minute TTL)
- LLM prompt responses (30-day TTL keyed on prompt hash + model)
- Trade Brain module loads (1-hour TTL; invalidated on Brain update)

### 10.2 Indexes

Every hot query has an index. Every index is justified with a query pattern. Explain plans reviewed on every schema change.

### 10.3 Read models

For expensive cross-table queries (e.g., merchant dashboard rollups):

- Materialized view refreshed via pg_cron nightly OR on-demand invalidation
- Read layer queries the view; write layer updates source tables + triggers refresh
- Consistency is eventually-consistent within 5 minutes

### 10.4 CQRS considered + rejected for now

Per ES-01: CQRS complexity cost isn't justified except for Twin event log. Domain modules use CRUD.

### 10.5 Background jobs

- Task queue table (`hammerex_nex_platform_task_queue`)
- Workers process queue on schedule + on-notify
- Backoff + retry per Section 4.5

### 10.6 Search

- Full-text via tsvector + pgroonga (Postgres extension) for non-English support at V2+
- Vector via pgvector
- Hybrid retrieval per Section 7.5

### 10.7 Scaling milestones

Per ES-01 §6.6:

- **100k merchants:** current stack
- **500k:** read replicas + partitioning review
- **1M:** regional deploys + specialised stores + archival

---

## Section 11 — Disaster Recovery

### 11.1 Backups

- Point-in-time recovery: Supabase default 24h (extended to 90 days for Business+ tiers)
- Daily full snapshots to independent Supabase Storage bucket (cross-region)
- Weekly encrypted backup exported to independent S3-compatible provider (e.g., Cloudflare R2, Backblaze B2)
- Quarterly restore test to prove backup viability
- Backup metadata logged; missing backups alert immediately

### 11.2 Recovery

- **RTO (Recovery Time Objective):** 4 hours for full platform
- **RPO (Recovery Point Objective):** 15 minutes
- Runbook maintained; rehearsed quarterly

### 11.3 Replication

- Supabase built-in read replicas at V1 (500k merchants)
- Cross-region replication at V2 (1M merchants)

### 11.4 Snapshots

- Daily full snapshots retained 30 days
- Weekly snapshots retained 12 months
- Monthly snapshots retained 7 years

### 11.5 Failover

- Vercel: automatic region failover (default)
- Supabase: managed failover to standby within region; cross-region manual per DR runbook

### 11.6 Testing

- Backup restore rehearsal: quarterly
- Failover drill: annually
- Chaos test on Anthropic API outage: monthly
- Chaos test on Supabase failure: monthly (staging only)

---

## Section 12 — Final Data Review

Challenge every decision. Simplify. Optimise.

### 12.1 Challenges + resolutions

- **Challenge:** should we use event sourcing everywhere for auditability?
  **Resolution:** No. Only Twin + Audit Log. Domain modules use CRUD + audit log where needed.
- **Challenge:** should every table be partitioned?
  **Resolution:** No. Partition when size or query time demands. Premature partitioning adds operational cost.
- **Challenge:** should we normalise across modules to reduce redundancy?
  **Resolution:** No. Each module owns its data. Cross-module reads via public interfaces.
- **Challenge:** should we use per-tenant schemas?
  **Resolution:** No. Multi-tenant with RLS. Per-tenant schemas break connection pooling.
- **Challenge:** should we use a graph DB for the Knowledge Graph?
  **Resolution:** No. Postgres + adjacency tables scales to Nex's needs. Graph DB adds vendor + operational overhead.
- **Challenge:** should we use a separate time-series DB for market signals?
  **Resolution:** No. Postgres with month-partitioning handles Nex's signal volumes. Revisit at 1M merchants.
- **Challenge:** should we use TimescaleDB for Twin events?
  **Resolution:** Considered. Native Postgres partitioning + pg_cron is sufficient for now; migrate to TimescaleDB if analytics queries become dominant.

### 12.2 Simplifications applied

- Rejected event sourcing except Twin + Audit Log
- Rejected microservices (see ES-01)
- Rejected per-tenant DBs
- Rejected graph DB
- Rejected time-series DB
- Rejected Kafka
- Single Supabase Postgres · pgvector · Postgres LISTEN/NOTIFY · pg_cron
- Six new tables in Y1 (Memory rollups + Twin events + Workforce audit + Platform events + Platform errors + Feature flags)

### 12.3 Ready for engineering

Database engineers can begin migration authorship on ratification of the 5 ADRs from ES-01 §14.10. Every table's schema is documented; every relationship is specified; every performance concern has a plan.

---

**End of ES-02 · Data & Event Architecture v1.0.**

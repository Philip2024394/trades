# NEX Infrastructure Runtime · v1.5

**Version 1.5 · 2026-08-07**
**Author: Chief Systems Architect, NEX**
**Status: Foundation complete · feature-phase begins**

> **Naming note (Philip 2026-08-07):** originally *"NEX Storage
> Contract"* while the scope was records-only. As of §11-§14 the doctrine
> covers records, objects, AI providers, capability routing, preference
> ranking, and reserved policy constraints — i.e. a general
> infrastructure runtime. Renamed accordingly. The code namespace
> `src/lib/nex/storage/` keeps the legacy name (files are still called
> `types.ts`, `registry.ts`, etc.) to avoid a large source rename with
> many callers; only this document and cross-reference comments carry
> the new name.

---

## 1 · Purpose

Every service in NEX Headquarters currently writes its own JSONL files under
`data/nex-*/`. This has been correct for the prototype phase because it let
us discover what NEX actually needed to persist. That phase is over. Data
patterns are now clear, and the next 60 days will add enough volume that
per-service migration cost compounds.

**This document defines the single Infrastructure Runtime that every service will
talk through going forward.** No service directly reads or writes files
after this contract is in effect. Every service becomes storage-agnostic.

**The contract is the load-bearing decision.** Get this right and swapping
JSONL → Postgres (or later, Postgres + object store for large payloads) is
an adapter change, not a service rewrite.

## 2 · Design principles (locked)

1. **Contracts, not files.** Every data domain is a named collection with a
   schema, an owner service, a retention policy, and a version. Files or
   tables are implementation details.
2. **Append-only by default.** Every write is a new snapshot. Latest-per-id
   wins on read for state stores. Full history preserved for audit stores.
3. **The interface is small.** `save`, `load`, `latestPerKey`, `query`,
   `count`. If you need more, propose it — don't sneak it in.
4. **Migration is reversible.** Every migration path supports dual-write for
   a verification window. If parity fails, roll back is a config flag.
5. **The Postgres adapter is not built until the JSONL adapter passes every
   service in production.** Prove the abstraction on the primitive we know
   works, then add the second implementation.
6. **Tenancy from day 1** (Philip 2026-08-07). Every table in the `nex`
   schema carries a `business_id UUID NULL` column and an index on it.
   NULL = system-level rows (crons, platform events not owned by any
   business). Every row that belongs to a business MUST set it. This
   operationalises Record Constitution Clause 1 (*"every record has one
   canonical owner"*) at storage level and makes the Business Brain's
   Four Memory Levels (personal · business · industry · global) enforceable
   later without a schema migration.
7. **Two schemas, one foundation** (Philip 2026-08-07). The existing
   `public.*` tables from `db/migrations/001_nex_brain_schema.sql` are the
   **knowledge layer** — records, versions, edges, confidence, feedback,
   audit-of-knowledge. The new `nex.*` tables from this contract are the
   **operational layer** — events, jobs, workers, tracking, KPE pipeline.
   Different lifecycles, different owners, both live in the same Postgres.
   No table exists in both schemas.
8. **No application code may know the infrastructure provider** (Philip
   2026-08-07 · the top-level goal that principles 1-7 serve). Business
   logic never learns whether the database is Supabase, self-hosted
   Postgres, or another provider. Never learns whether objects live in
   ImageKit, Cloudflare R2, S3, MinIO, or local disk. Never depends on
   a specific AI vendor. NEX interacts only with its own interfaces —
   `StorageBackend` (§3), `ObjectStorage` (§12), and the future
   `LLMProvider` interface (§13 · reserved). Providers can change
   underneath without any application-layer rewrite. This is what
   thinking in decades — not months — requires. Every review of a new
   service asks the question: *does this code depend on knowing which
   provider is behind the interface?* If yes, refactor before merge.
9. **Applications route by capability, not by provider name** (Philip
   2026-08-07 · operational form of principle 8). Application code that
   needs a specific capability asks the registry for an adapter that
   supports it — `selectStorage({ requires: ["vectorSearch"] })` — never
   checks the provider name (`if (backend === "postgres") ...`). Every
   adapter declares its capabilities in a typed `capabilities` property
   on the interface. Registries route based on those declarations. This
   closes the last surface where provider names could leak into business
   logic and lets NEX add specialised adapters — a vector-search-native
   backend, a low-latency streaming LLM, an image-transform-native
   object store — without editing calling code. Application code states
   its requirements as data, not as branches. See §14 for the technical
   spec.

## 3 · The interface

```typescript
interface StorageBackend {
  save<T>(collection: string, record: T): Promise<void>;
  load<T>(collection: string, id: string): Promise<T | null>;
  latestPerKey<T>(collection: string, keyField: string, filter?: QueryFilter): Promise<T[]>;
  query<T>(collection: string, filter: QueryFilter): Promise<T[]>;
  count(collection: string, filter?: QueryFilter): Promise<number>;
  stats(collection: string): Promise<CollectionStats>;
  // No delete() in v1 · every store is append-only.
  // Soft-delete via a `deleted_at` field or a superseding snapshot.
}

interface QueryFilter {
  where?: Record<string, unknown>;   // exact-match filters
  since?: string;                     // ISO timestamp cutoff
  limit?: number;                     // default 100 · max 10000
  order_by?: string;                  // field name
  order_dir?: "asc" | "desc";         // default "desc"
}

interface CollectionStats {
  total_records: number;
  latest_write_at: string | null;
  size_bytes: number;
}
```

That's it. Every backend implements those six methods.

## 4 · The registry pattern

Every service asks for a storage backend from the registry:

```typescript
import { getStorage } from "@/lib/nex/storage/registry";

const store = getStorage();
await store.save("events", event);
```

The registry picks the active backend from an environment variable:
- `NEX_STORAGE_BACKEND=jsonl` (default · current state)
- `NEX_STORAGE_BACKEND=postgres` (after migration)
- `NEX_STORAGE_BACKEND=dual-write` (during migration · primary=jsonl, secondary=postgres, parity checker runs async)

Zero code changes in services when the backend changes.

## 5 · Runtime collections

Every collection in NEX with its full contract. Sorted by ownership.

### 5.1 · Event Bus & Audit (owner: Intelligence Bus)

**Collection: `events`**
- Fields: `event_id (pk) · event_type · source · actor_id · timestamp · related_department · related_brain · related_job · related_contact · outcome · payload (json) · reversible · reverse_of · supersedes`
- Primary key: `event_id`
- Indexes: `(timestamp DESC)`, `(event_type, timestamp)`, `(related_job, timestamp)`, `(related_department, timestamp)`
- Retention: **forever** — audit truth surface, never deleted
- Version: 1
- Current backing: `data/nex-events/events.jsonl`

**Collection: `worker_audit_events`**
- Fields: `event_id (pk) · worker_type · event_type · actor · job_id · input_ref · details (json) · created_at · latency_ms · tokens_in · tokens_out · provider · model · error`
- Primary key: `event_id`
- Indexes: `(worker_type, created_at)`, `(job_id, created_at)`, `(provider, created_at)`
- Retention: 90 days rolling
- Version: 1
- Current backing: `data/nex-audit-log/*.jsonl`

### 5.2 · Job Queue & Workers (owner: Worker Manager)

**Collection: `jobs`**
- Fields: `job_id (pk) · source · owner · created_at · knowledge_type · target_brains (jsonb) · status · progress · completion_result (jsonb) · inbox_item_id · title · content_length · updated_at`
- Primary key: `job_id`
- Latest-per-key: yes (append-only snapshots · latest wins)
- Indexes: `(status, updated_at)`, `(owner, created_at)`, `(inbox_item_id)`
- Retention: forever
- Version: 1
- Current backing: `data/nex-jobs/jobs.jsonl`

**Collection: `recovery_attempts`**
- Fields: `attempt_id (pk) · job_id · level (1-5) · level_name · action · at · outcome · detail · target_provider · target_worker`
- Primary key: `attempt_id`
- Indexes: `(job_id, at)`, `(level, at)`, `(outcome, at)`
- Retention: 180 days
- Version: 1
- Current backing: `data/nex-recovery/attempts.jsonl`

### 5.3 · Brain (owner: Brain Router)

**Collection: `brain_memories`** (partitioned by brain_slug in Postgres)
- Fields: `memory_id (pk) · brain_name · brain_slug · source_job_id · source_kind · source_owner · knowledge_type · title · content_length · inbox_item_id · added_at`
- Primary key: `memory_id`
- Indexes: `(brain_slug, added_at)`, `(source_job_id)`, `(source_owner, added_at)`
- Retention: forever
- Version: 1
- Current backing: `data/nex-brains/{slug}/memories.jsonl` (per-brain files)

### 5.4 · Contacts (owner: Master Contact Database)

**Collection: `contacts`**
- Fields: `contact_id (pk) · email (unique nullable) · phone (unique nullable) · name · kind · source · source_ref · tags (jsonb) · consent_marketing · consent_transactional · consent_source · attributes (jsonb) · lifecycle_stage · first_seen_at · last_seen_at · linked_business_id · updated_at`
- Primary key: `contact_id`
- Unique constraints: `email`, `phone`
- Latest-per-key: yes
- Indexes: `(email)`, `(phone)`, `(lifecycle_stage)`, `(consent_marketing)`
- Retention: forever (GDPR erasure via soft-delete flag on supersession)
- Version: 1
- Current backing: `data/nex-contacts/contacts.jsonl`

### 5.5 · Event Tracking (owner: Event Tracking Service)

**Collection: `tracking_events`**
- Fields: `event_id (pk) · session_id · contact_id · fingerprint · event_name · path · referrer · user_agent · ip_prefix · utm_source · utm_medium · utm_campaign · utm_content · utm_term · properties (jsonb) · occurred_at · server_received_at`
- Primary key: `event_id`
- Indexes: `(session_id, occurred_at)`, `(contact_id, occurred_at)`, `(utm_campaign, occurred_at)`, `(occurred_at DESC)`
- Retention: 365 days rolling
- Version: 1
- Current backing: `data/nex-tracking/events.jsonl`

### 5.6 · Analytics Pipeline (owner: Analytics Service)

**Collection: `analytics_records`**
- Fields: `record_id (pk) · provider · event_name · path · hostname · referrer · country · device · browser · os · session_id · visitor_id · duration_sec · bounced · properties (jsonb) · occurred_at · ingested_at`
- Primary key: `record_id`
- Indexes: `(provider, occurred_at)`, `(path, occurred_at)`, `(country)`
- Retention: 730 days rolling
- Version: 1
- Current backing: `data/nex-analytics/records.jsonl`

### 5.7 · Automation Engine (owner: Automation Engine)

**Collection: `automation_rules`**
- Fields: `rule_id (pk) · name · description · authority (L1|L2|L3) · enabled · trigger (jsonb) · condition (jsonb) · action (jsonb) · created_at · updated_at · created_by · version`
- Primary key: `rule_id`
- Latest-per-key: yes (append-only versioning)
- Indexes: `(enabled, updated_at)`, `(authority)`
- Retention: forever
- Version: 1
- Current backing: `data/nex-automation/rules.jsonl`

**Collection: `automation_runs`**
- Fields: `run_id (pk) · rule_id · rule_name · rule_authority · triggered_by_event_id · triggered_by_event_type · triggered_at · status · outcome_detail · action_snapshot (jsonb) · admin_actor · admin_decided_at`
- Primary key: `run_id`
- Latest-per-key: yes
- Indexes: `(rule_id, triggered_at)`, `(status, triggered_at)`, `(triggered_by_event_id)`
- Retention: 180 days
- Version: 1
- Current backing: `data/nex-automation/runs.jsonl`

### 5.8 · KPE (owner: Knowledge Processing Engine)

**Collection: `kpe_documents`**
- Fields: `document_id (pk) · source · title · content_hash (unique) · byte_length · ingested_at · classifier_label · classifier_confidence · target_brains (jsonb)`
- Primary key: `document_id`
- Unique constraint: `content_hash` (duplicate detection)
- Latest-per-key: yes
- Indexes: `(content_hash)`, `(source, ingested_at)`, `(classifier_label)`
- Retention: forever
- Version: 1
- Current backing: `data/nex-kpe/documents.jsonl`

**Collection: `kpe_chunks`**
- Fields: `chunk_id (pk) · document_id · order_index · heading_path (jsonb) · content · content_hash · token_estimate · context_before · context_after`
- Primary key: `chunk_id`
- Indexes: `(document_id, order_index)`, `(content_hash)`
- Retention: matches document retention (forever v1)
- Version: 1
- Current backing: `data/nex-kpe/chunks.jsonl`

**Collection: `kpe_metadata`**
- Fields: `chunk_id (pk) · authors (jsonb) · dates (jsonb) · versions (jsonb) · urls (jsonb) · references (jsonb) · language · keywords (jsonb) · extracted_entities (jsonb)`
- Primary key: `chunk_id`
- Indexes: `(language)`
- Retention: matches chunk
- Version: 1
- Current backing: `data/nex-kpe/metadata.jsonl`

**Collection: `kpe_decisions`**
- Fields: `decision_id (pk = chunk_id) · chunk_id · route (jsonb) · decided_at · provider_used · latency_ms · cost_estimate_gbp · alternatives_considered (jsonb)`
- Primary key: `chunk_id` (one decision per chunk)
- Indexes: `(decided_at)`, `((route->>'tier'), decided_at)`
- Retention: forever
- Version: 1
- Current backing: `data/nex-kpe/decisions.jsonl`

**Collection: `kpe_duplicates`**
- Fields: `duplicate_id (pk) · chunk_id · matched_chunk_id · similarity · match_type · detected_at`
- Primary key: `duplicate_id`
- Indexes: `(chunk_id)`, `(matched_chunk_id)`, `(detected_at)`
- Retention: 90 days
- Version: 1
- Current backing: `data/nex-kpe/duplicates.jsonl`

**Collection: `kpe_edges`** (Knowledge Graph)
- Fields: `edge_id (pk) · from_id · to_id · type · confidence · created_at`
- Primary key: `edge_id`
- Indexes: `(from_id, type)`, `(to_id, type)`, `(type)`
- Retention: forever
- Version: 1
- Current backing: `data/nex-kpe/edges.jsonl`

**Collection: `kpe_processing_runs`**
- Fields: `run_id (pk) · document_id · source · started_at · finished_at · stages_completed (jsonb) · errors (jsonb) · final_outcome · chunks_created · decisions_made · brain_writes`
- Primary key: `run_id`
- Indexes: `(document_id)`, `(started_at DESC)`
- Retention: 180 days
- Version: 1
- Current backing: `data/nex-kpe/processing_runs.jsonl`

**Collection: `kpe_human_reviews`**
- Fields: `review_id (pk) · chunk_id · document_id · decision (approved|rejected) · admin · reason · decided_at`
- Primary key: `review_id`
- Indexes: `(chunk_id)`, `(decision, decided_at)`, `(admin, decided_at)`
- Retention: forever
- Version: 1
- Current backing: `data/nex-kpe/human_reviews.jsonl`

### 5.9 · Object Manifest (owner: Object Storage Registry)

**Collection: `object_manifest`**
- Fields: `manifest_id (pk) · bucket · key · version_id · content_hash · size_bytes · mime_type · uploaded_at · uploaded_by · business_id · source_ref · is_delete_marker · custom (jsonb)`
- Primary key: `manifest_id`
- Uniqueness at (bucket, key, version_id) is enforced by DB constraint
- Indexes: `(bucket, key, uploaded_at DESC)`, `(content_hash)`, `(business_id, uploaded_at DESC) WHERE business_id IS NOT NULL`, `(source_ref) WHERE source_ref IS NOT NULL`
- Retention: forever (matches the durability of the underlying object store)
- Version: 1
- Current backing: `data/nex-storage/object_manifest.jsonl` (JSONL adapter) / `nex.object_manifest` (Postgres)
- Written automatically by the ObjectStorage registry after every `put()` — services don't manage manifest rows directly. See §12.

## 6 · Contract summary table

| Collection | Owner | Records/day (est) | Retention | Version |
|---|---|---|---|---|
| events | Intelligence Bus | 1K-100K | forever | 1 |
| worker_audit_events | Worker Manager | 500-20K | 90d | 1 |
| jobs | Worker Manager | 100-5K | forever | 1 |
| recovery_attempts | Recovery Manager | 10-1K | 180d | 1 |
| brain_memories | Brain Router | 100-10K | forever | 1 |
| contacts | Contact DB | 10-1K | forever | 1 |
| tracking_events | Event Tracking | 5K-500K | 365d | 1 |
| analytics_records | Analytics | 5K-500K | 730d | 1 |
| automation_rules | Automation | 1-50 | forever | 1 |
| automation_runs | Automation | 100-10K | 180d | 1 |
| kpe_documents | KPE | 100-5K | forever | 1 |
| kpe_chunks | KPE | 1K-50K | forever | 1 |
| kpe_metadata | KPE | 1K-50K | forever | 1 |
| kpe_decisions | KPE | 1K-50K | forever | 1 |
| kpe_duplicates | KPE | 10-5K | 90d | 1 |
| kpe_edges | KPE | 5K-500K | forever | 1 |
| kpe_processing_runs | KPE | 100-5K | 180d | 1 |
| kpe_human_reviews | KPE | 1-100 | forever | 1 |

**18 collections total.** At the high-volume tier we're looking at ~1.5M writes/day. JSONL scan latency will bite tracking_events + analytics_records + kpe_edges first — those are the migration priorities inside the migration.

## 7 · Migration sequence

### Day 0 · this turn
- ✅ Runtime doctrine document (this file · originally the Storage Contract)
- ✅ Interface types (`src/lib/nex/storage/types.ts`)
- ✅ JSONL reference adapter (`src/lib/nex/storage/adapters/jsonl.ts`)
- ✅ Registry (`src/lib/nex/storage/registry.ts`)

### Week 1 (next turn)
- Pilot migration: refactor the Event Bus (smallest, most-called store) to use the abstraction. Every emit goes through `storage.save("events", ...)`. Existing filesystem paths unchanged (JSONL adapter still writes there).
- Verify: every existing consumer still reads the same events. Zero behaviour change externally.

### Week 2
- Add Postgres adapter. Requires Postgres running locally (Docker Compose or Supabase Free tier — both work). Same interface, different storage.
- Add DualWriteAdapter that wraps two backends: primary=jsonl, secondary=postgres, secondary writes fire-and-forget.

### Week 3
- Enable dual-write for `events` collection. Both files AND Postgres receive every event. Parity checker runs hourly · alerts if divergence.
- After 5-7 days of clean parity, flip `NEX_STORAGE_BACKEND=postgres` for reads. JSONL keeps receiving writes as archive.

### Week 4
- Repeat for `jobs`, `contacts`, `automation_*`, then KPE stores.
- Each service migration takes ~1 day once the pattern is proven on Event Bus.

### Week 5+
- Delete filesystem write path from services once 30 days of Postgres-only operation have passed.
- Keep archived JSONL files as historical reference for at least 6 months.

## 8 · What this contract prevents

- **Schema drift between services.** Every field is declared here. If a service tries to save a record shape the contract doesn't allow, the adapter rejects it at write time.
- **Ad-hoc reads.** No more `fs.readFile("some.jsonl")` scattered through the codebase. Reads go through `storage.query(collection, filter)`.
- **Silent backend swaps.** Every backend change is a config flag with observable side effects.
- **Data loss during migration.** Dual-write with parity checking means we only cut over when we have hard evidence of equivalence.

## 9 · What this contract does NOT do

- **Query planning.** The interface is deliberately minimal. Complex queries (joins across collections, aggregates) are the responsibility of the calling service. The abstraction gives you the primitives; you compose them.
- **Migrations of data schema versions.** When a collection's schema changes (version 1 → 2), a separate migration script handles the data transformation. The adapter doesn't do it silently.
- **Transactions across collections.** Every operation is single-collection. Multi-collection consistency is a service-layer concern (usually handled via event-driven eventual consistency, which is what NEX already does).

## 10 · Resilience & Continuity (Philip 2026-08-07)

NEX is intended as a long-lived AI platform for real business records.
The Infrastructure Runtime is the layer that decides how much of that longevity
is credible. Every capability below is a **design target** — not all
implemented today, but every current decision must remain compatible with
each. Absence of a design hook for any one of them is a red risk to
flag, not a silent deferral.

Each capability lists: **Target** · **Current** · **Design hook** — the
specific way today's code already enables the capability so it can be
added later without a rewrite.

### 10.1 · Automated daily backups + restore testing

- **Target:** Nightly snapshot of every table in `nex.*` and `public.*`, retained ≥30 days, with a quarterly restore-to-scratch drill that replays a snapshot against an empty database and confirms every collection's row count and latest-hash match the source.
- **Current:** When `NEX_POSTGRES_URL` points at Supabase Free tier, daily backups exist with 7-day rolling retention. Supabase Pro extends to daily + 30-day retention. JSONL side is backed by the workstation filesystem — Windows File History if enabled, nothing otherwise.
- **Design hook:** `nex:apply-storage-schema` is idempotent — the schema can be rebuilt from source-controlled DDL against any empty Postgres. Combined with a Supabase-side `pg_dump` (or the WAL-based backup they provide), restore-to-scratch is a two-step procedure. `nex:test-restore` script (deferred) will apply the schema to a scratch DB, replay a dump, and diff `count(collection)` per collection against source. Contract §7 dual-write pattern is itself a form of continuous backup validation.

### 10.2 · Point-in-time recovery

- **Target:** Restore the operational state of `nex.*` to any timestamp within the retention window, at second-grade granularity. Ability to say *"put the events collection back to exactly what it looked like at 2026-11-14 09:32:00 UTC"*.
- **Current:** Supabase Pro has physical PITR (WAL-based, 5-min granularity). Supabase Free tier does not.
- **Design hook:** The Contract's append-only-by-default principle (§2 principle 2) and every collection's `inserted_at` server-side timestamp column make **logical PITR** possible at the app layer, even without a physical PITR product. Reconstructing state at time T = filter `WHERE inserted_at <= T`, then `latestPerKey` for snapshot collections. This is not a substitute for physical PITR (it won't help with accidental TRUNCATE) but it means the audit trail itself is a time machine for any collection that follows the doctrine.

### 10.3 · Versioned object storage (images · CAD · PDFs · generated assets)

- **Target:** Every binary blob NEX ever stores — inbox uploads, CAD files, generated images, rendered PDFs, worker outputs — lives in a versioned object store with lifecycle policies (hot → warm → glacier), immutable version history, and typed references from `nex.*` records to specific object versions.
- **Current (2026-08-07):** ObjectStorage interface delivered as §12. `FilesystemObjectStorage` reference adapter shipped. `nex.object_manifest` collection (§5.9) is the queryable metadata index. Real production adapters (ImageKit / Cloudflare R2 / S3 / MinIO / Supabase Storage) are named in §12 as roadmap but deferred per Contract §2 Principle 5 — prove the abstraction on the primitive first.
- **Design hook:** Records in `nex.*` reference blobs by string ID (e.g. `input_ref` on `jobs`, `content_hash` on `kpe_documents`) — never by filesystem path. That means every future ObjectStorage adapter plugs in without touching any record schema. Image-specific transformations (thumbnails, format conversion, dimension changes) will layer on via a companion `ImageOps` interface — kept out of the core so non-image blobs (PDFs, CAD) aren't forced to implement transforms they can't perform.

### 10.4 · Encryption at rest

- **Target:** Every byte NEX stores on any provider's disk is encrypted at rest with keys NEX controls (or under a customer-managed key when a business demands it). For sensitive PII columns (contact email, phone, personal notes, business-secret payloads), column-level encryption on top of disk-level encryption.
- **Current:** Supabase encrypts the entire database at rest by default (AES-256, provider-managed keys). JSONL files on the workstation have no encryption. Column-level encryption is NOT applied to any `nex.*` column.
- **Design hook:** `pgcrypto` is already installed by `000_schema.sql`, so column-level encryption (`pgp_sym_encrypt(email, key)`) is a schema change away when the first business demands data-at-rest even against Supabase admins reading the DB. The Contract's per-collection metadata (`CollectionMeta`) is the natural place to declare "these columns are encrypted at rest" and route through pgcrypto helpers without changing caller code. For workstation JSONL, encryption is out of scope — JSONL is a dev/prod-legacy substrate and will not host sensitive production data long-term.

### 10.5 · Monitoring + alerts

- **Target:** Every storage operation is observable. Adapter health, dual-write secondary failure rate, per-collection write latency (p50/p95/p99), schema-drift detection (columns that exist in code but not in DB and vice versa) all surface to an alerting layer that can page an on-call human when thresholds trip.
- **Current:** `DualWriteStorage` already tracks `secondaryFailureCount` and rate-limits noisy warn logs (1st + every 100th failure). `isPostgresHealthy()` reports connectivity + presence of `nex.*` schema. No metrics endpoint yet, no external alerting.
- **Design hook:** `StorageBackend.stats(collection)` is already in the interface — every adapter must return `total_records · latest_write_at · size_bytes`. The natural next step is a `/api/nex/storage/health` endpoint composing `isPostgresHealthy()` + per-collection `stats()` + `DualWriteStorage.getSecondaryFailureCount()`, exposed as a JSON payload any external monitor (UptimeRobot · Better Uptime · Vercel Monitoring · Digital Guardian nightly scan) can watch. Cross-composes with the Digital Guardian doctrine and the Enterprise Event Bus so storage-health events flow into the same NEX-wide truth surface as everything else.

### 10.6 · Disaster recovery (region / provider outage)

- **Target:** Full NEX rebuild in a different region or a different Postgres provider inside **RTO ≤ 4 hours** with **RPO ≤ 15 minutes** of data loss. No application code changes required — only environment variables.
- **Current:** Portability guardrail already active: `PostgresStorage` reads `NEX_POSTGRES_URL` and connects — it is unaware of Supabase, Hetzner, RDS, or a bare VPS. Moving provider = change one env var. Combined with the idempotent `nex:apply-storage-schema` script, the DDL can be replayed against any empty Postgres in minutes. What's missing: automated snapshot export from the primary provider, and a rehearsed rebuild drill.
- **Design hook:** The apply-schema script IS the "declare state from scratch" primitive. Combined with `pg_dump | pg_restore` for data or the dual-write pattern to bootstrap a second provider, the recovery playbook is: (1) provision new Postgres · (2) `NEX_POSTGRES_URL=<new>` + `npm run nex:apply-storage-schema` · (3) restore data from latest snapshot · (4) update production env · (5) redeploy. Because reads and writes both flow through the abstraction, no service code changes. Rehearsal cadence (deferred): quarterly full-restore drill against a scratch provider, timed against the RTO target.

### Doctrine

- **Reversibility is a resilience story, not just a design principle.** The adapter pattern that lets us swap JSONL → Postgres is the same pattern that lets us swap Supabase → Hetzner during an outage. Never break it for short-term convenience.
- **Append-only is a resilience story, not just an audit story.** Every append-only collection is a logical time machine — accidental writes cannot destroy history, only add to it.
- **Idempotent schema-as-code is a resilience story, not just a devex story.** If the schema can be rebuilt in one command against any empty Postgres, region failover becomes an operational play, not an engineering scramble.
- **The Business OS "Backup" core engine** (`project_nex_business_os_engine_architecture_2026_08_05`) and the **Digital Guardian nightly monitoring pattern** (`project_nex_digital_identity_business_brain_2026_08_05`) describe the user-visible resilience story. §10 describes the engineering invariants that make them credible. Neither is enough alone.

---

## 11 · The Three Provider-Free Interfaces (Philip 2026-08-07)

NEX aims to expose exactly three infrastructure abstractions to
application code, and nothing else. Every other decision — record
shapes, event flow, business logic — sits above these.

```
                     NEX Application Layer
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
  StorageBackend        ObjectStorage           LLMProvider
      (§3)                  (§12)              (§13 · reserved)
       │                      │                      │
   Postgres,             ImageKit,              Claude, Groq,
   Supabase,             Cloudflare R2,         Gemini, Cerebras,
   SQLite, DuckDB,       S3, MinIO, local,      Anthropic,
   local JSONL           Supabase Storage       OpenRouter, ...
```

Each interface follows the same discipline:

- **Small.** Six or seven methods maximum. If a service needs more, propose a contract change with a written rationale — never sneak methods into a specific adapter.
- **Portable.** Adapters are connection-string driven (or config-block driven for AI). Zero application code changes when a provider swaps.
- **Registered.** A registry (`getStorage()`, `getObjectStorage()`, `getLLM()`) reads an env var to pick the active adapter. Callers never `import` a concrete implementation.
- **Migration-safe.** Every interface ships a `DualWrite` / `Dual` primitive so a swap can run both providers in parallel until parity is proven.
- **Verifiable.** Every interface ships a repeatable verify script that round-trips through the abstraction to prove the current adapter is healthy.

This is the operational form of §2 Principle 8. It is the reason NEX
survives vendor lock-in, regional outages, pricing changes, provider
acquisitions, and technology shifts across a decade.

## 12 · Object Storage Contract

Every binary blob NEX ever stores — inbox uploads, worker output files,
AI-generated images, rendered PDFs, CAD documents, profile pictures — is
addressed through a single ObjectStorage interface. The adapter behind
the interface may be a local filesystem in dev, Cloudflare R2 for
production images, an ImageKit account for member-facing thumbnails, an
S3 bucket for CAD archives, or a MinIO cluster for on-prem deployments —
the application never knows.

### 12.1 · The interface (7 methods · locked)

```typescript
interface ObjectStorage {
  readonly name: string;

  /** Upload bytes to `bucket/key`. Returns version_id + content_hash. */
  put(bucket: string, key: string, input: PutInput): Promise<PutResult>;

  /** Fetch the current (or specific) version. Null if key not found or is a delete marker. */
  get(bucket: string, key: string, versionId?: string): Promise<ReadResult | null>;

  /** Metadata only · no bytes downloaded. Cheap to call. */
  head(bucket: string, key: string, versionId?: string): Promise<ObjectMeta | null>;

  /** Presigned URL for direct browser upload/download. Adapter-native when available. */
  presign(bucket: string, key: string, options: PresignOptions): Promise<string>;

  /** Paginated listing under a key prefix · newest first by default. */
  list(bucket: string, prefix: string, options?: ListOptions): Promise<ListItem[]>;

  /** Soft delete by default (writes delete marker). {hard:true} removes bytes. */
  delete(bucket: string, key: string, options?: DeleteOptions): Promise<void>;

  /** Every version of a key · newest first · including delete markers. */
  listVersions(bucket: string, key: string): Promise<ListItem[]>;
}
```

Image-specific operations (thumbnails, format conversion, on-the-fly
resizing) live on a **companion `ImageOps` interface**, NOT here. Reasons:
non-image blobs (PDF, CAD, ZIP) can't implement transforms; adapters vary
wildly in native transform capability; keeping the core small preserves
adapter portability. `ImageOps` is reserved for a future contract section.

### 12.2 · Design principles (locked)

1. **Every object is content-addressed.** `content_hash` (SHA256 hex) is on every `put()` result — free deduplication, free integrity check on retrieval. A helper `contentHashKey(body)` returns a stable content-hash key when the caller wants immutable-by-content.
2. **Versioning is opt-out per bucket, not opt-in.** Default: every `put()` creates a new version, old versions preserved (Never-Disappear Law). Buckets can declare `versioning: "overwrite"` when history has no audit value.
3. **Deletes are soft by default.** `delete()` writes a delete marker; the bytes stay recoverable until an explicit `{hard: true}` call. Reinforces the append-only doctrine.
4. **Metadata always accompanies bytes.** Every stored object carries mime, size, content_hash, uploader, tenant, source_ref, uploaded_at. Adapters store what they can natively; the manifest table (§5.9) is the queryable index.
5. **Presign is best-effort.** Adapters with native presign (S3, R2, Supabase Storage, ImageKit) honor it. Filesystem returns a would-work URL to an endpoint that may not yet be routed — clearly documented as dev-only.
6. **The registry auto-writes the manifest.** Services call `getObjectStorage().put()` and a `nex.object_manifest` row lands automatically. No caller ever remembers to save metadata; forgetting is impossible.
7. **Tenancy lives in metadata, not the key.** `business_id` is a metadata field. This lets a business reorganize its keys freely without affecting tenant enforcement.

### 12.3 · Buckets (declared)

| Bucket | Owner | Versioning | Retention | Access |
|---|---|---|---|---|
| `uploads` | Knowledge Inbox | versioned | forever | private |
| `renders` | Renderer / KPE | versioned | forever | private + presign |
| `documents` | Report Composer | versioned | forever | private + presign |
| `avatars` | Identity | overwrite (latest wins) | forever | public-with-presign |

Add a bucket here before writing to it. Adapters may reject writes to
unregistered buckets.

### 12.4 · Registry pattern

Every service asks for the object store from the registry:

```typescript
import { getObjectStorage } from "@/lib/nex/storage/object-registry";

const objects = getObjectStorage();
const { key, content_hash } = await objects.put("uploads", "user123/photo.jpg", {
  body: buf,
  mime_type: "image/jpeg",
  business_id: businessId,
  source_ref: `job:${jobId}`,
});
```

The registry picks the active adapter from an env var:

- `NEX_OBJECT_BACKEND=filesystem` (default · shipped this turn)
- `NEX_OBJECT_BACKEND=supabase` (roadmap · wraps Supabase Storage)
- `NEX_OBJECT_BACKEND=r2` (roadmap · Cloudflare R2 via S3-compatible SDK)
- `NEX_OBJECT_BACKEND=imagekit` (roadmap · ImageKit — asset-first with native transforms)
- `NEX_OBJECT_BACKEND=s3` (roadmap · AWS S3 or S3-compatible)
- `NEX_OBJECT_BACKEND=minio` (roadmap · self-hosted, on-prem)
- `NEX_OBJECT_BACKEND=dual-write` (during migration · same pattern as §7 dual-write)

Zero code changes when the backend changes. The manifest row shape is
constant across every adapter.

### 12.5 · Migration sequence

Same pattern as §7. Reference adapter first, prove the abstraction, then
add real adapters one at a time. Never build multiple adapters before the
interface has been validated.

- **Now (2026-08-07):** FilesystemObjectStorage shipped + `nex.object_manifest` in schema + `nex:verify-objects` repeatable check.
- **Next:** Wire the first real caller (Knowledge Inbox uploads) to `getObjectStorage()`. Existing filesystem paths unchanged.
- **After that:** Second adapter — likely Cloudflare R2 or Supabase Storage depending on cost/latency at the target load. Enable dual-write. Parity checker mirrors §7.
- **After parity green for 5-7 days:** flip reads to the new adapter. Filesystem becomes archive.
- **Long-term:** ImageKit or Cloudflare Images fronts the `renders` and `avatars` buckets for on-the-fly transforms; R2 or S3 hosts the raw-blob buckets (`uploads`, `documents`) for durability + cost.

### 12.6 · What this contract prevents

- **`fs.writeFile` scattered through services.** All binary writes go through `getObjectStorage().put()`. Adapters swap; services don't.
- **Silent metadata loss.** Every put automatically writes a manifest row. Queries like "all uploads for business X in Q4" are Postgres queries, not filesystem scans.
- **Vendor lock-in.** No service imports the ImageKit SDK, the Cloudflare R2 client, or `@supabase/storage-js` directly. Only the adapter behind the interface does. Swapping providers = one env var + one adapter deploy.

---

## 13 · LLMProvider Interface (reserved)

Reserved for the future AI provider abstraction. When it lands it will
follow the same shape as §3 and §12: small typed interface (likely 6-7
methods around `complete` · `stream` · `embed` · `tools` · `usage` ·
`cancel`), reference adapter first, registry with env-driven backend
selection, dual-write / dual-completion migration primitive, verify
script, capability declarations per §14. Roadmap adapters likely
include: Claude (Anthropic direct) · Groq · Google Gemini · Cerebras ·
OpenRouter · Ollama · Together AI · Anthropic-via-Bedrock. See §14 for
the capability names LLMProvider adapters will declare.

## 14 · Capabilities Layer (Philip 2026-08-07)

The Capabilities Layer is how application code chooses adapters without
knowing their names. Every interface — `StorageBackend`, `ObjectStorage`,
and the future `LLMProvider` — carries a typed `capabilities` property.
Registries expose `select*` helpers that route based on those
declarations.

### 14.1 · Shape

```typescript
// Interface addition (same shape on every interface).
readonly capabilities: Readonly<Record<CapabilityName, boolean>>;
```

Capability names are typed per interface — typos become type errors.
Adapters MUST declare every known capability with an honest boolean.
Unknown / silently-missing capabilities default to `false` at the
registry level so callers never see `undefined`.

### 14.2 · Declared capability names

**StorageBackend** (Contract §3):

| Capability | Meaning |
|---|---|
| `efficientLatestPerKey` | Native DISTINCT ON vs O(N) Map collapse |
| `atomicMultiWrite` | Transactions / BEGIN-COMMIT available at adapter level |
| `jsonPathQueries` | Rich JSONB / json-path operators available |
| `fullTextSearch` | Full-text index queries available |
| `vectorSearch` | Embedding-similarity queries available |

**ObjectStorage** (Contract §12):

| Capability | Meaning |
|---|---|
| `nativePresign` | Real provider-signed URLs (R2/S3/Supabase/ImageKit) vs dev URL |
| `nativeVersioning` | Provider-side version history (S3) vs app-layer emulation |
| `imageTransforms` | Native thumbnails/resize/format-conversion (ImageKit, Cloudflare Images) |
| `multipartUpload` | Large-blob chunked upload (S3/R2/MinIO) |
| `presignPost` | Browser-direct POST upload (S3/R2 style forms) |
| `lifecycleRules` | Hot→warm→glacier tiering rules |
| `serverSideEncryption` | Provider-managed at-rest encryption |
| `publicUrls` | Shareable non-authed URLs |

**LLMProvider** (§13 reserved · capability names locked in advance):
`streaming` · `vision` · `reasoning` · `imageGeneration` · `embeddings` ·
`toolCalling` · `audio` · `structuredOutput` · `longContext` · `codeExecution`.

### 14.3 · Selection helpers

Registries expose capability-driven selection alongside the default
`get*()`:

```typescript
// Record storage
const store = selectStorage({ requires: ["efficientLatestPerKey"] });

// Object storage
const objects = selectObjectStorage({ requires: ["imageTransforms"] });

// Future: LLM (§13)
const llm = selectLLM({ requires: ["streaming", "vision"] });
```

**Today's behaviour** (single production adapter per interface): the
helper returns the default adapter if it satisfies the requirements,
throws with a clear message listing missing capabilities otherwise.

**Future behaviour** (multiple production adapters registered): the
registry chooses the first registered adapter that satisfies every
`requires` capability. Optional `prefers` array (e.g.
`{ requires: ["streaming"], prefers: ["longContext"] }`) breaks ties.
Application code doesn't change — only the registry gains options.

### 14.4 · Rules

- **Every adapter declares every known capability.** No `undefined`, no silent omission.
- **Wrappers pass capabilities through by default** (ManifestWritingObjectStorage → inner). Wrappers that alter semantics must document why.
- **Dual-write reports the intersection** of primary and secondary capabilities. That's the safest promise: a capability is claimed only if BOTH sides can honour it, so callers don't build reliance on features that vanish after cutover.
- **Capability names are additive-only.** Removing a capability name is a breaking API change; adding one is not.
- **Verify scripts assert declaration.** Every capability-enabled interface's verify script confirms every known capability is present as a boolean — catches missing declarations at CI time.

### 14.5 · Design intent

Principle 8 (§2) says application code never learns the provider. §14 is
what makes that enforceable — because as long as application code
routes on names (`if (backend === "postgres")`), the provider identity
leaks. Once routing is on capabilities, provider identity is no longer
information the application NEEDS. Swap R2 for Cloudflare Images for
ImageKit — application code that asked for `imageTransforms` still
finds a supporting adapter. The provider name never appears in a
service.

### 14.6 · Preferences (Philip 2026-08-07 · activates when multiple adapters register)

Capabilities answer *"which adapters CAN do this?"* Preferences answer
*"among the capable ones, which should we PREFER right now?"*

```typescript
selectLLM({
  requires: ["reasoning", "longContext"],
  prefer:   ["lowLatency", "lowCost"],
});

selectObjectStorage({
  requires: ["imageTransforms"],
  prefer:   ["lowCost"],
});
```

**Preference dimensions** (typed union · reserved names, additive-only):

| Name | Meaning |
|---|---|
| `lowLatency` | p50 response time is competitive on this adapter |
| `lowCost` | cost per operation is low |
| `highDurability` | data survives failure well (multi-region · PITR · long retention) |
| `highThroughput` | handles concurrent bursts well |
| `strongConsistency` | reads reflect writes immediately across regions |
| `globalReach` | low RTT from anywhere in the world |
| `lowMemory` | small client-side memory footprint |

**Adapter profile** (optional today · required when multiple adapters
register for the same interface):

```typescript
type Tier = 1 | 2 | 3 | 4 | 5;   // 5 = excellent · 1 = poor / not applicable

type AdapterProfile = {
  scores: Readonly<Record<PreferenceName, Tier>>;
  notes?: string;                 // human-readable context
};
```

**Selection algorithm**:
1. Filter adapters by `requires` (drop any that don't support every required capability)
2. If none remain → throw with missing-capability list
3. If one remains → return it
4. If multiple remain → sort by `prefer` array (each dimension descending by tier), first-declared preference is most significant · undeclared profiles get a neutral score of 3
5. Return the top-scoring adapter

**Rules**:
- Preferences are **soft** — a preference never excludes a capable adapter, only reorders. If you want to REQUIRE low latency, express it as a capability (`requires: ["lowLatency"]`), not a preference.
- Preference names are **additive-only** — never rename or remove.
- `DualWrite*` adapters take the MINIMUM tier of primary and secondary on each dimension (worst-case wins) — parallel to how capabilities are intersected.
- Profile declarations are **honest estimates**, not benchmarks. Update as real data emerges.

**Today's behaviour** (single adapter per interface): `prefer` is
accepted by `select*` but not acted on — there are no ties to break.
Application code that already writes `select*({ requires, prefer })`
starts sorting automatically the day a second adapter registers, with
no code change. That's the design intent.

### 14.7 · Policy Routing (Philip 2026-08-07 · reserved for the future)

Where capabilities FILTER and preferences RANK, policy CONSTRAINS.
Preferences are soft (never exclude, only reorder). Policy is hard: a
policy violation removes an adapter from consideration entirely,
regardless of capability. This is where business, legal, and compliance
rules enter the routing decision — the application still never learns
the provider, it only expresses business policy.

```typescript
selectLLM({
  requires: ["reasoning"],
  prefer:   ["lowCost"],
  policy:   {
    region:            "EU",
    dataResidency:     "UK",
    maxCostPerRequest: 0.01,
    compliance:        ["GDPR"],
    allowFallback:     true,
  },
});

selectObjectStorage({
  requires: ["serverSideEncryption"],
  prefer:   ["highDurability"],
  policy:   {
    retention:      "7 years",
    dataResidency:  "Australia",
    classification: "confidential",
  },
});
```

**Policy dimensions** (reserved names, additive-only):

| Name | Meaning |
|---|---|
| `region` | Geographic region the adapter must operate in (`"EU"`, `"US-east"`, ...) |
| `dataResidency` | Stricter than region — data must physically reside in named jurisdiction (`"UK"`, `"Australia"`, ...) |
| `maxCostPerRequest` | Numeric cap in cost unit (GBP typical) — adapters that exceed are excluded |
| `retention` | Retention policy (`"7 years"`, `"90 days"`, `"forever"`) — adapter must guarantee at least this |
| `allowFallback` | Whether the router may pick a non-preferred adapter if the top choice is unavailable (default `true`) |
| `compliance` | Required compliance regimes (`["GDPR"]`, `["HIPAA", "SOC2"]`, ...) — adapter must hold all |
| `classification` | Data classification (`"public" | "internal" | "confidential" | "restricted"`) — adapter must be approved to hold that class |

**Adapter side** (deferred to when the first policy-aware adapter
registers): adapters extend their profile with a `policies` declaration
naming the jurisdictions they operate in, compliance regimes they hold,
retention they can guarantee, and classifications they're approved for.
The router filters on both `requires` and `policy` before ranking by
`prefer`.

**Rules**:
- Policy is HARD — a violation excludes an adapter entirely (unlike preference which merely reorders). If no adapter satisfies `requires + policy`, the selector throws with a clear reason.
- Policy names are additive-only.
- `DualWrite*` under policy: both primary and secondary MUST satisfy every policy dimension independently — if only one does, dual-write is refused with a clear message (the whole point of policy is that no bytes may sit on a non-compliant store).
- `allowFallback: false` means "throw if the single best-matching adapter is unavailable" (strict single-provider mode, useful for regulated workloads).

**Design intent**: the application code shape at maturity is
`select*({ requires, prefer, policy })` — three dimensions of infrastructure
intent, all expressed as data, none of them naming a provider. Business
teams can adjust compliance policy by editing a config file; engineering
teams can register new adapters without touching business rules;
neither team ever writes provider names in service code. This is the
end state that Contract §2 principles 8-9 point at.

**Today's behaviour**: `policy` is accepted by `select*` signatures but
not acted on — same deferral pattern as `prefer`. Application code that
already writes `select*({ requires, prefer, policy })` starts enforcing
policy the day the router gains policy-filtering logic. Zero calling-
code change.

---

*Contract v1.5 · Week 1 pilot shipped 2026-08-07 · Week 2 Postgres code shipped 2026-08-07 · §10 Resilience + §2 principle 8 + §11 + §12 (ObjectStorage) + §2 principle 9 + §13 (reserved) + §14 (Capabilities Layer) added 2026-08-07 · §14.6 (Preferences) added 2026-08-07 with deferred activation · §14.7 (Policy Routing) reserved 2026-08-07 with deferred activation.*

---

*Contract v1.3 · Week 1 pilot shipped 2026-08-07 · Week 2 Postgres code shipped 2026-08-07 (deployment pending Supabase URL) · §10 Resilience doctrine added 2026-08-07 · §2 principle 8 + §11 + §12 (ObjectStorage) added 2026-08-07 · §2 principle 9 + §13 (reserved) + §14 (Capabilities Layer) added 2026-08-07.*

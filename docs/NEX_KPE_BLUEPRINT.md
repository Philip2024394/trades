# NEX Knowledge Processing Engine · Technical Blueprint

**Version 1.0 · 2026-08-07**
**Author: Chief Systems Architect, NEX**
**Status: Approved for implementation (skeleton v1 built same day)**

---

## 1 · Mission

The NEX Knowledge Processing Engine (KPE) sits between every Worker and every AI capability. Its job is to *decide* — for each unit of work — whether AI is actually needed, and if so, exactly which slice of the work to send. It exists to make external AI providers **optional, fungible, and used only when genuinely required.**

**The KPE is not an LLM. It is the software that decides when the LLM gets called.**

## 2 · Architectural principles (locked)

1. **Plugin-first.** Every stage of the pipeline is a plugin registered with the KPE registry. The default reference implementation ships in-tree. Better implementations (better classifier, better OCR, better local LLM) can replace defaults without touching pipeline code.
2. **One process today, N services when forced.** Twelve stages run inside one KPE service. When a specific stage becomes a scaling bottleneck, extract it — not before.
3. **Every stage is a pure function of its input.** Same input, same output. Testable in isolation. No hidden state.
4. **The Decision Engine has five tiers, not two.** `no_ai` · `rule_engine` · `local_llm` · `frontier_llm` · `human_review`. Cost and quality gradients matter, AND deterministic rule-based decisions are their own tier (not the same as "no AI needed"). The `rule_engine` tier composes with the existing Automation Engine — versioned rules, authority levels, audit trail all already exist.
5. **No worker talks to an LLM directly. Ever.** The AI Gateway is the ONLY component with LLM credentials. Workers call KPE; KPE calls the Gateway; the Gateway routes to the current implementation of the AI capability interface.
6. **Provenance follows every chunk.** Every knowledge fragment stored in the Brain carries its source document ID, source chunk ID, processing timestamps, decision-tier taken, and (if applicable) the AI provider that touched it.
7. **The KG grows even when AI is down.** Deterministic stages produce structured output on their own. Only "enrichment" stages fail-soft when AI is unavailable.

## 3 · Pipeline stages (12)

Each stage implements the `PipelineStage<Input, Output>` interface and is registered by name. Defaults ship in-tree at `src/lib/nex/kpe/plugins/default.ts`.

| # | Stage | Reference implementation | AI required? | Pluggable? |
|---|-------|--------------------------|:-:|:-:|
| 1 | **Intake** | Hash + ID assignment + queue enqueue | No | ✅ |
| 2 | **Cleaning** | HTML strip · whitespace collapse · encoding normalize · header/footer dedup | No | ✅ |
| 3 | **Normalisation** | Heading level unification · list unification · quotation marks · code blocks | No | ✅ |
| 4 | **Classifier** | Keyword scoring against configurable taxonomy | No (v1) · optional LLM (v2) | ✅ |
| 5 | **Metadata Extractor** | Regex + heuristics for date · author · version · URLs · language | No | ✅ |
| 6 | **Duplicate Detection** | SHA-256 exact + MinHash 5-gram shingles for near-dup | No | ✅ |
| 7 | **Chunking** | Heading-driven splits with adjacent-chunk context windows | No | ✅ |
| 8 | **Relationship Detection** | Reference extraction (URLs · doc IDs · named entities) → typed edges | No (v1) · optional LLM (v2) | ✅ |
| 9 | **Validation** | Schema + confidence-threshold gates | No | ✅ |
| 10 | **Decision Engine** | Per-chunk 4-tier routing based on features (length · classifier score · confidence · has-code · needs-reasoning) | No | ✅ |
| 11 | **AI Gateway** | Provider router (mock · groq · anthropic · gemini · local) with circuit breakers | N/A (this IS the AI boundary) | ✅ |
| 12 | **Brain Writer** | Persists to Memory System via existing `brain-router` | No | ✅ |

## 4 · Plugin architecture

The plugin registry is the load-bearing primitive.

```typescript
type StageName =
  | "intake" | "cleaning" | "normalisation" | "classifier"
  | "metadata" | "duplicate" | "chunking" | "relationships"
  | "validation" | "decision" | "ai_gateway" | "brain_writer";

interface PipelineStage<I, O> {
  name: StageName;
  version: string;
  run(input: I, ctx: StageContext): Promise<O>;
}

interface Registry {
  register<I, O>(stage: PipelineStage<I, O>): void;
  get<I, O>(name: StageName): PipelineStage<I, O>;
  listPlugins(): Array<{ name: StageName; version: string }>;
}
```

**Two rules for plugin authors:**
1. Never break the input/output contract for a stage. Contract changes = major version bump.
2. Every plugin must be replaceable with the reference implementation without data migration.

**Registry lookup is cheap** — happens once per pipeline run at boot, not per document.

## 5 · Decision Engine (the heart)

Given a chunk, produce a `DecisionRoute` from FIVE tiers:

```typescript
type DecisionRoute =
  | { tier: "no_ai";        reason: string; store_directly: true }
  | { tier: "rule_engine";  reason: string; ruleset: string; matched_rules: string[] }
  | { tier: "local_llm";    reason: string; capability: AICapability; prompt_slice: string }
  | { tier: "frontier_llm"; reason: string; capability: AICapability; prompt_slice: string }
  | { tier: "human_review"; reason: string; escalation_priority: "P1"|"P2"|"P3" }
  | { tier: "skip";         reason: string };
```

**Why the `rule_engine` tier is its own thing (not just "no AI"):**
`no_ai` = "there's no decision to make — store the chunk as-is." `rule_engine` = "there IS a decision to make, but it can be resolved deterministically by evaluating a set of versioned rules." Two very different modes, both AI-free. Keeping them separate lets the Rule Engine build up thousands of tenant-specific rules over time without polluting the "pass-through" path.

**v1 evaluation order (deterministic, feature-based):**

| Chunk feature | Route |
|---|---|
| Already in Brain (near-dup > 0.92) | `skip` |
| **Any Automation Engine rule matches this classifier + payload** | **`rule_engine`** |
| Structured data (tables · lists · specs) + high confidence | `no_ai` |
| Free-form prose + short (< 500 tokens) + high confidence classifier | `local_llm` |
| Free-form prose + long (500-4K tokens) + complex classification | `frontier_llm` |
| Contains contradictions or extraction confidence < 0.6 | `human_review` |
| Anything ambiguous | `frontier_llm` (fail-safe — spend a few pennies rather than store garbage) |

**Reuse of existing infrastructure:** the `rule_engine` tier does NOT introduce a new rule store. It calls into the Automation Engine (`src/lib/nex/automation/*`) built earlier this session — same rule schema, same authority levels (L1 suggestion · L2 prepared · L3 autonomous), same audit trail. This is the composability win: the KPE gets a battle-tested rule engine for free.

**v2 evolution (deferred, but designed for):** the Decision Engine becomes a small classifier trained on `(chunk_features, actual_outcome_quality)` pairs from historical processing. Once we have 10K+ processed chunks with quality labels, we can learn the routing rules instead of hand-writing them.

## 6 · Database schema (Postgres-ready, JSONL for MVP)

Storage lives at `data/nex-kpe/` in JSONL for the MVP. Postgres migration is a straight lift-and-shift once volume justifies (per the storage-migration plan on file).

```
documents.jsonl
  document_id · source · title · content_hash · byte_length ·
  ingested_at · classifier_label · classifier_confidence

chunks.jsonl
  chunk_id · document_id · order_index · heading_path ·
  content · content_hash · token_estimate · context_before · context_after

metadata.jsonl
  chunk_id · authors · dates · versions · urls · references ·
  language · keywords · extracted_entities

duplicates.jsonl
  chunk_id · matched_chunk_id · similarity · match_type (exact|near)

decisions.jsonl
  chunk_id · tier · reason · capability · provider_used · latency_ms · cost_estimate_gbp

processing_runs.jsonl
  run_id · document_id · started_at · finished_at · stages_completed ·
  errors · final_outcome
```

**All tables append-only. Latest-per-id wins on read.** Same pattern as every other NEX service this session.

## 7 · API design

Three endpoints. Everything else is internal to the pipeline.

```
POST /api/nex/kpe/process
  Body: { source, title?, content, metadata? }
  Returns: { run_id, document_id, chunks_created, decisions, brain_writes }

GET /api/nex/kpe/plugins
  Returns: { stages: [{ name, version, plugin_id }] }

GET /api/nex/kpe/runs?document_id=X
  Returns: full processing history for a document
```

The Automation Engine (built earlier this session) can trigger `POST /process` when a `knowledge_dumped` event fires — this closes the loop between "raw dump" and "processed knowledge in the correct brain" without human intervention.

## 8 · Worker communication protocol

Workers never touch the KPE internals. They speak one of two ways:

1. **Synchronous:** `POST /api/nex/kpe/process` → wait for response with the processing outcome. For UI-triggered dumps where the user is watching.

2. **Asynchronous (preferred):** enqueue a job with `source="quick-dump"`, let the manager cycle pick it up, KPE processes when there's capacity. Every stage transition emits an Intelligence Event so the Ops Centre can see progress.

**No worker calls the AI Gateway directly.** If a worker thinks it needs AI, it calls `POST /process` with the chunk in question and lets the Decision Engine decide.

## 9 · Knowledge graph design

The Relationship Detection stage produces typed edges. Edge types:

- `references(chunk_a → chunk_b)` — chunk A cites chunk B
- `supersedes(doc_a → doc_b)` — doc A is a newer version of doc B
- `derived_from(chunk → source_url)` — chunk originated from external URL
- `contradicts(chunk_a → chunk_b)` — chunks make contradictory claims
- `part_of(chunk → document)` — structural
- `authored_by(chunk → author)` — provenance
- `about(chunk → entity)` — extracted named entity

Edges stored in a graph adjacency list. Read-optimized via inverted indices. Same store powers the "related knowledge" queries that Workers use.

## 10 · Development roadmap (four phases)

### Phase 1 · MVP skeleton (built same day this doc is written)
- Types + Registry + Pipeline orchestrator
- All 12 stages with reference implementations
- POST `/process` endpoint with end-to-end verification
- Wired to existing Brain Router for storage
- **Success criteria:** one dumped document → routed → chunks stored in correct brain

### Phase 2 · Production hardening (next 2-3 weeks)
- Postgres migration for KPE storage
- Better classifier (train on real NEX traffic)
- Better duplicate detection (MinHash + LSH bucketing)
- Better chunking (semantic-aware, not just heading-driven)
- Metrics/dashboard endpoint

### Phase 3 · AI Gateway maturation (next 1-2 months)
- Real provider plugins (Groq · Anthropic · Gemini · Cerebras)
- Local LLM plugin (llama.cpp behind serverless-GPU rental first, owned hardware later per the Chief Systems Architect deployment plan)
- Cost budgets per tier
- Provider health tracking

### Phase 4 · Learning Decision Engine (deferred — 6+ months)
- Collect `(chunk_features, quality_outcome)` training data
- Replace hand-written rules with small learned classifier
- Only when we have >10K labeled chunks

## 11 · Third-party independence: what KPE eliminates

| Currently depends on | KPE eliminates via | Status |
|---|---|---|
| Direct LLM API calls from workers | AI Gateway with provider registry | ✅ v1 |
| One-provider lock-in for extraction | Fungible provider plugins behind capability interface | ✅ v1 |
| Full-document API calls (expensive) | Chunking + Decision Engine sends only needed slices | ✅ v1 |
| LLM for classification (expensive per-doc) | Deterministic keyword classifier | ✅ v1 |
| LLM for deduplication | SHA-256 + MinHash near-dup | ✅ v1 |
| LLM for structured extraction (dates, URLs) | Regex + heuristics metadata extractor | ✅ v1 |
| Cloud OCR for image text | Plugin slot for Tesseract/PaddleOCR | 🟡 v2 (plugin registered, impl external) |
| Cloud embeddings | Plugin slot for BGE-M3 local | 🟡 v2 |

**AI usage reduction estimate (vs "call Claude Haiku on every document"):**

| Workload | Before | After (KPE v1) | Reduction |
|---|---|---|---|
| Simple structured data (specs, tables) | 100% AI | 0% AI | **100%** |
| Documents with duplicates | 100% AI | 0% AI (skip) | **100%** |
| Documents with basic metadata needs | 100% AI | 0% AI | **100%** |
| Short prose chunks | 100% frontier | 100% local | **~95% cost reduction** |
| Long complex prose | 100% frontier | 100% frontier (unchanged) | 0% |
| Overall (typical NEX traffic mix) | 100% frontier | ~15% frontier + ~30% local + ~55% no AI | **~80% AI reduction** ✓ meets stated goal |

## 12 · Dashboard requirements (Phase 2 · not v1)

Ship the pipeline first. Dashboard is scoped for Phase 2 once we have real numbers to display. Panels planned:

- Active pipeline runs · queue depth
- Documents processed today / week / month
- Decision distribution (no_ai / local / frontier / human / skip)
- AI provider usage + spend
- Duplicate detection hit rate
- Confidence score distribution
- KG growth (nodes + edges over time)
- Stage latency histograms

## 13 · Success criteria

The KPE is successful when:

1. ✅ **Workers process as much information as possible without AI** — verified via decision distribution showing >50% `no_ai` routes on real traffic
2. ✅ **Only genuinely complex tasks reach an LLM** — verified by chunk-length + classifier-complexity gates
3. ✅ **External AI providers are interchangeable** — proven by running the same document through mock → Groq → Anthropic → local plugins without code changes
4. ✅ **NEX owns its processing pipeline** — the 11 non-AI stages have zero external dependencies
5. ✅ **The NEX Brain continues to grow if AI is unavailable** — deterministic stages still ingest + store structured knowledge from every document

---

## Appendix · Folder structure

```
src/lib/nex/kpe/
  types.ts                     ← shared types + interfaces
  registry.ts                  ← plugin registry (load-bearing)
  pipeline.ts                  ← orchestrator
  stages/
    intake.ts
    cleaning.ts
    normalisation.ts
    classifier.ts
    metadata.ts
    duplicate.ts
    chunking.ts
    relationships.ts
    validation.ts
    decision.ts
    ai-gateway.ts
    brain-writer.ts
  plugins/
    default.ts                 ← default plugin registrations
    ai-providers/
      mock.ts
      (future: groq.ts, anthropic.ts, local-llama.ts, ...)
  storage/
    fs-store.ts                ← JSONL persistence (v1)
    (future: postgres.ts)

src/app/api/nex/kpe/
  process/route.ts             ← POST · run pipeline on a document
  plugins/route.ts             ← GET · list registered plugins
  runs/route.ts                ← GET · processing history

data/nex-kpe/                  ← runtime storage
  documents.jsonl
  chunks.jsonl
  metadata.jsonl
  duplicates.jsonl
  decisions.jsonl
  processing_runs.jsonl
```

*End of Blueprint v1.0. Implementation begins immediately after this document is filed.*

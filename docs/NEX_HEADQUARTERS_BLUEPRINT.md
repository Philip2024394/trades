# NEX Headquarters Technical Blueprint

**Version 1.0 · 2026-08-07**
**Author: Master AI Engineer, NEX**
**Scope: What NEX must own to survive the disappearance of every third-party AI provider.**

---

## Executive Summary

The NEX worker ecosystem is smaller and more self-sufficient than assumed. After auditing every worker in the codebase, three findings dominate every decision that follows:

1. **75% of workers do not call an LLM.** Of 11 identifiable workers, only 3 hard-depend on external language models. The rest (context retrievers, feedback scorers, memory guardians, importers, recovery managers) are traditional software that happens to run in the same pipeline.

2. **Only 2 external AI dependencies are load-bearing.** All 9 LLM providers (Groq, Gemini, Anthropic, OpenRouter, SambaNova, Cerebras, Mistral, Cloudflare, HuggingFace) exist to service two workers: `knowledge-extractor` (text authoring) and `image-analyst` (vision). Every other "AI-adjacent" service is deterministic logic wearing an AI badge.

3. **NEX can own everything except final LLM inference — and even that can move in-house on modest hardware.** A single mid-tier PC with 32 GB RAM and a used RTX 3090 (24 GB VRAM) can serve Llama 3.1 8B for text and LLaVA 1.6 for vision at throughput sufficient for the current job volume. The strategic question is not whether NEX *can* self-host; it is whether the free-tier ecosystem remains cheaper than the marginal electricity cost.

**The objective:** design the infrastructure that lets every non-LLM worker continue processing indefinitely offline, and that lets the LLM-dependent workers fail over to a locally-hosted model when providers vanish.

---

## Section 1 · Worker Inventory

Every worker in the current codebase. Grouped by category. Each row answers the 12 required data points.

### 1.1 · Knowledge Processing Workers (LLM-fueled pipeline)

#### Worker 1 · `knowledge-context`
- **File:** `src/lib/nex/brain/workers/knowledge-context.ts`
- **Purpose:** Retrieves 5–10 related existing records via keyword scoring before any authoring begins. Prevents the extractor from re-inventing knowledge NEX already has.
- **Inputs:** Inbox item (text/URL/metadata); existing knowledge graph.
- **Outputs:** `context_bundle` (scored related records + candidate edges); enqueues `voice-context` job.
- **External dependencies:** None.
- **LLM required?** **No.** Pure retrieval.
- **Replacement without LLM:** Already implemented as keyword scoring. Future upgrade → local embedding + pgvector (still no LLM).
- **CPU/RAM/GPU/Storage:** 1 vCPU · 512 MB RAM · no GPU · ~50 MB per 10K records.
- **Offline capable?** **Yes.**
- **Internet-dependent?** No.

#### Worker 2 · `voice-context`
- **File:** `src/lib/nex/brain/workers/voice-context.ts`
- **Purpose:** Assembles brand terminology (NexString™, NexRail™, etc.), audience type (homeowner / manufacturer / trade), and tone rules for the topic.
- **Inputs:** Context bundle; brand terminology registry (`src/lib/nex/branding/terminology.ts`).
- **Outputs:** `voice_guide` object with applicable brand terms + tone rules; enqueues `learning-context`.
- **External dependencies:** None.
- **LLM required?** **No.** Lookup + heuristic classification.
- **Replacement without LLM:** Already deterministic.
- **CPU/RAM/GPU/Storage:** 1 vCPU · 256 MB RAM · no GPU · <10 MB.
- **Offline capable?** **Yes.**

#### Worker 3 · `learning-context`
- **File:** `src/lib/nex/brain/workers/learning-context.ts`
- **Purpose:** Retrieves past human feedback (approvals, rejections, corrections, edits) with age-decay weighting to feed the extractor as few-shot examples.
- **Inputs:** Prior bundles; `knowledge_feedback` table.
- **Outputs:** `learning_bundle` (top-N scored feedback rows); enqueues `knowledge-extractor`.
- **External dependencies:** None.
- **LLM required?** **No.** Age-decay scoring + keyword overlap.
- **Replacement without LLM:** Already deterministic.
- **CPU/RAM/GPU/Storage:** 1 vCPU · 512 MB RAM · no GPU · ~200 MB per 100K feedback rows.
- **Offline capable?** **Yes.**

#### Worker 4 · `knowledge-extractor`  ★ LLM-CRITICAL
- **File:** `src/lib/nex/brain/workers/knowledge-extractor.ts`
- **Purpose:** Authors new structured KnowledgeRecord drafts from ingested text using the three context bundles as scaffolding.
- **Inputs:** All three bundles; inbox text content.
- **Outputs:** N KnowledgeRecord drafts (status=DRAFT); typed graph edges; confidence scores; enqueues `quality-checker`.
- **External dependencies:** **Groq (primary), Gemini, Anthropic, OpenRouter, SambaNova, Mistral, Cerebras, Cloudflare, HuggingFace, mock (dev only).**
- **LLM required?** **Yes.** Core authoring function — this is what an LLM is genuinely for.
- **Replacement without LLM:** Only if scope narrows to templated authoring (e.g., "FAQ from CSV"). General-purpose knowledge authoring needs a language model.
- **CPU/RAM/GPU/Storage:** Client side: 1 vCPU · 1 GB RAM · no GPU (calls remote LLM). Self-hosted LLM would need 16+ GB VRAM (Llama 3.1 8B FP16) or 8 GB VRAM (Q4 quantized).
- **Offline capable?** **Only if a local LLM is available.**
- **Internet-dependent?** Yes, unless self-hosted.

#### Worker 5 · `image-analyst`  ★ LLM-CRITICAL
- **File:** `src/lib/nex/brain/workers/image-analyst.ts`
- **Purpose:** Extracts structured knowledge from photographs (staircase design, kitchen layout, door specification) via multimodal LLM.
- **Inputs:** Image inbox items (base64 or Supabase Storage URL); all three context bundles.
- **Outputs:** Same shape as `knowledge-extractor` — KnowledgeRecord drafts + edges + confidence scores.
- **External dependencies:** **Gemini 1.5 Flash (primary, vision), Anthropic Claude Haiku (vision fallback).**
- **LLM required?** **Yes.** Vision LLM is the only realistic path to "what does this image mean architecturally."
- **Replacement without LLM:** Partial only — traditional CV can do object detection + colour extraction, but semantic understanding ("this is a floating cantilever tread with concealed steel spine") requires vision-language models.
- **CPU/RAM/GPU/Storage:** Client: 1 vCPU · 1 GB RAM. Self-hosted LLaVA 1.6 34B: 24 GB VRAM. Self-hosted LLaVA 1.6 13B Q4: 10 GB VRAM.
- **Offline capable?** **Only with local vision LLM.**

#### Worker 6 · `quality-checker`  ★ PARTIAL LLM
- **File:** `src/lib/nex/brain/workers/quality-checker.ts`
- **Purpose:** Gates DRAFT records against the 8-clause NEX Record Constitution. Produces `overall_confidence`. Promotes to AUTHORITATIVE (≥0.85), UNDER_REVIEW (0.70–0.84), or REJECTED (<0.70).
- **Inputs:** DRAFT record; schema + graph + audit logs.
- **Outputs:** Promoted/reviewed/rejected records; confidence rows.
- **External dependencies:** Gemini or Anthropic (soft-clause editorial LLM check — optional).
- **LLM required?** **Partial.** Part A (schema completeness, evidence tier, provenance) is deterministic. Part B (editorial judgment: "does this claim actually match the source?") is optional and uses LLM when available.
- **Replacement without LLM:** Part A runs standalone. Part B degrades to human-review queue instead of automated pass — slower but not broken.
- **CPU/RAM/GPU/Storage:** 1 vCPU · 512 MB RAM · no GPU (unless local LLM). Storage negligible.
- **Offline capable?** **Yes (Part A only).**

#### Worker 7 · `llm-retry`
- **File:** `src/lib/nex/brain/workers/llm-retry.ts`
- **Purpose:** Reclaims work that failed when all providers were exhausted; auto-retries with exponential backoff.
- **Inputs:** `llm_retry_queue` rows with original call metadata.
- **Outputs:** Retry outcomes; marks succeeded/exhausted; surfaces to dashboard.
- **External dependencies:** Same provider chain as the calling worker.
- **LLM required?** **Yes** (definitionally — it retries LLM calls).
- **Replacement without LLM:** Not applicable — this worker exists only to buffer LLM outages.
- **CPU/RAM/GPU/Storage:** 1 vCPU · 512 MB RAM.
- **Offline capable?** No.

#### Worker 8 · `memory-guardian`
- **File:** `src/lib/nex/brain/workers/memory-guardian.ts`
- **Purpose:** Batch auditor. Surfaces duplicate records, under-connected records, confidence rot (memories not touched in 90+ days), broken edges, gap markers.
- **Inputs:** Full corpus (records, edges, confidence scores, audit logs).
- **Outputs:** Findings, contradictions, audit entries.
- **External dependencies:** None.
- **LLM required?** **No.** Pure corpus analysis.
- **Replacement without LLM:** Already deterministic.
- **CPU/RAM/GPU/Storage:** 2 vCPU · 2 GB RAM (loads corpus into memory) · no GPU · ~500 MB per 100K records.
- **Offline capable?** **Yes.**

### 1.2 · Auxiliary Workers

#### Worker 9 · `background-removal` (browser Web Worker)
- **File:** `src/lib/backgroundRemoval/worker.ts`
- **Purpose:** Removes background from product images using RMBG-1.4 ONNX model in the browser.
- **Inputs:** Image pixels (`Uint8ClampedArray`) + dimensions.
- **Outputs:** Transparent PNG with alpha mask.
- **External dependencies:** ONNX Runtime Web (bundled model file); optional WebGPU acceleration or WASM SIMD fallback.
- **LLM required?** **No.** ONNX inference only.
- **Replacement without LLM:** Already ONNX — no LLM in the loop.
- **CPU/RAM/GPU/Storage:** Client browser. Server-side variant would need 2 vCPU · 1 GB RAM · GPU optional (10x speedup with WebGPU).
- **Offline capable?** **Yes** (browser-local).

### 1.3 · Ingest & Recovery Workers

#### Worker 10 · `importer`
- **File:** `src/lib/nex/brain/importer.ts`
- **Purpose:** One-shot seeder. Walks `data/knowledge/records/**/*.md` and materialises existing knowledge into brain tables.
- **Inputs:** Markdown files with YAML frontmatter.
- **Outputs:** Records, edges, confidence scores.
- **External dependencies:** None.
- **LLM required?** **No.** YAML/Markdown parsing.
- **CPU/RAM/GPU/Storage:** 1 vCPU · 1 GB RAM · no GPU.
- **Offline capable?** **Yes.**

#### Worker 11 · `recovery-manager`
- **File:** `src/lib/nex/recovery/manager.ts`
- **Purpose:** Assessor. Evaluates blocked jobs and executes the 5-level escalation ladder (retry → switch provider → restart → reassign → escalate to Philip).
- **Inputs:** Job state snapshots; provider health; timeline.
- **Outputs:** Recovery attempts (JSONL); intelligence events; escalation recommendations.
- **External dependencies:** None.
- **LLM required?** **No.** State machine.
- **CPU/RAM/GPU/Storage:** 1 vCPU · 512 MB RAM · negligible storage.
- **Offline capable?** **Yes.**

### 1.4 · Summary Table

| Worker | LLM required? | External deps | Offline capable | CPU | RAM | GPU |
|--------|:-:|---|:-:|:-:|:-:|:-:|
| knowledge-context | No | — | ✅ | 1 | 512M | — |
| voice-context | No | — | ✅ | 1 | 256M | — |
| learning-context | No | — | ✅ | 1 | 512M | — |
| **knowledge-extractor** | **Yes** | 9 LLM providers | ⚠︎ local LLM | 1 | 1G | 16G VRAM* |
| **image-analyst** | **Yes** | Gemini/Anthropic vision | ⚠︎ local vision LLM | 1 | 1G | 24G VRAM* |
| quality-checker | Partial | LLM optional | ✅ Part A | 1 | 512M | — |
| llm-retry | Yes | Provider chain | ✗ | 1 | 512M | — |
| memory-guardian | No | — | ✅ | 2 | 2G | — |
| background-removal | No | ONNX bundled | ✅ | 2 | 1G | optional |
| importer | No | — | ✅ | 1 | 1G | — |
| recovery-manager | No | — | ✅ | 1 | 512M | — |

\* GPU requirements are for a self-hosted local model. Zero GPU required if calling remote provider.

### 1.5 · Duplicate / Overlapping Workers

**None found.** Each worker occupies a distinct pipeline stage. The closest pair is `knowledge-extractor` and `image-analyst`, but they process different input modalities (text vs. image) and share no code path.

**Consolidation opportunity:** the three context workers (`knowledge-context`, `voice-context`, `learning-context`) could theoretically merge into one "context assembler" service. Rejected — the separation exists so each stage can retry independently and the pipeline can pause between stages for human review. Keep separate.

### 1.6 · More Efficient Architecture (Recommended Consolidations)

1. **Merge `llm-retry` into the LLM provider chain itself.** The retry buffer is a concern of the provider abstraction, not a separate worker. The current split creates two audit trails for the same event.

2. **Split `image-analyst` into two stages:** deterministic OCR + colour + object detection first (no LLM), then LLM synthesis on the structured output. This lets the deterministic first pass run offline and only forwards to the LLM the cases where synthesis is genuinely needed.

3. **Introduce a Batch Aggregator** in front of `knowledge-extractor`. Multiple short dumps could be batched into one LLM call, cutting provider spend/quota consumption by 5–10×.

---

## Section 2 · NEX Headquarters Architecture

Sixteen services. Every worker plugs into these — nothing else.

```
                              ┌─────────────────────────┐
                              │   MONITORING DASHBOARD  │
                              │   (Ops Centre UI)       │
                              └───────────┬─────────────┘
                                          │
                       ┌──────────────────┴──────────────────┐
                       │       ENTERPRISE EVENT BUS          │
                       │   (JSONL append-only · pub/sub)     │
                       └──┬──────────┬────────────┬──────────┘
                          │          │            │
        ┌─────────────────┼──────────┼────────────┼─────────────────────┐
        │                 │          │            │                     │
┌───────▼──────┐   ┌──────▼─────┐  ┌─▼──────┐   ┌─▼──────────┐  ┌──────▼─────┐
│  WORKER MGR  │   │ JOB QUEUE  │  │SCHEDULER│  │ AUTOMATION │  │  LOGGING   │
│  (heartbeats │   │(SKIP LOCK) │  │ (cron)  │  │  ENGINE    │  │  (audit)   │
│   +recovery) │   │            │  │         │  │  L1/L2/L3  │  │            │
└──────┬───────┘   └──────┬─────┘  └────┬────┘  └─────┬──────┘  └────────────┘
       │                  │             │             │
       └──────────────────┼─────────────┴─────────────┘
                          │
      ┌───────────────────┼─────────────────────────────────┐
      │                   │                                 │
┌─────▼──────┐  ┌─────────▼──────┐  ┌─────────────┐  ┌────▼──────────┐
│    OCR     │  │   EMBEDDING    │  │  KNOWLEDGE  │  │  MEMORY SYS   │
│  SERVICE   │  │    SERVICE     │  │    GRAPH    │  │  (per-brain)  │
│ (Tesseract)│  │  (BGE / GTE)   │  │             │  │               │
└────────────┘  └───────┬────────┘  └──────┬──────┘  └───────────────┘
                        │                  │
                  ┌─────▼──────┐    ┌──────▼───────┐
                  │  VECTOR DB │    │ SEARCH ENGINE│
                  │  (Qdrant / │    │ (Meilisearch │
                  │  pgvector) │    │  / SQLite FTS│
                  └─────┬──────┘    └──────────────┘
                        │
                  ┌─────▼─────────────────┐        ┌──────────────────┐
                  │  LOCAL LLM SERVICE    │        │  FILE PROCESSING │
                  │  (llama.cpp / vLLM)   │        │  (PDF/DOCX/TXT)  │
                  │  OPTIONAL             │        └──────────────────┘
                  └───────────────────────┘        ┌──────────────────┐
                                                   │ IMAGE PROCESSING │
                  ┌───────────────────────┐        │  (sharp/RMBG)    │
                  │  AUTHENTICATION       │        └──────────────────┘
                  │  (Supabase Auth /     │
                  │  self-hosted Ory)     │        ┌──────────────────┐
                  └───────────────────────┘        │  BACKUP SYSTEM   │
                                                   │  (restic → S3)   │
                                                   └──────────────────┘
```

### 2.1 · Service Definitions

| # | Service | Purpose | Current impl | Ownable? | Notes |
|---|---------|---------|--------------|:-:|-------|
| 1 | **Worker Manager** | Tracks worker heartbeats, dispatches recovery attempts | `src/lib/nex/recovery/manager.ts` | ✅ | Already NEX-owned |
| 2 | **Job Queue** | Persistent queue with claim/release/retry | `src/lib/nex/jobs/fs-store.ts` + Supabase | ✅ | Filesystem now, Supabase upgrade wired |
| 3 | **Scheduler** | Cron dispatch of periodic work | `/api/nex/brain/cron-tick` + external cron | ✅ | Vercel Cron, GitHub Actions, or systemd timer |
| 4 | **OCR Service** | Extract text from image/PDF | **NOT BUILT** | ✅ | Recommend: Tesseract 5 or PaddleOCR |
| 5 | **Embedding Service** | Turn text into vectors | **NOT BUILT** | ✅ | Recommend: BGE-small-en (100MB, CPU-viable) |
| 6 | **Knowledge Graph** | Typed edges between records | `src/lib/nex/intelligence/graph.ts` | ✅ | Already NEX-owned |
| 7 | **Memory System** | Per-brain memory stores | `src/lib/nex/brain/router.ts` | ✅ | Already NEX-owned (this session) |
| 8 | **Vector Database** | Similarity search over embeddings | **NOT BUILT** | ✅ | Recommend: Qdrant (embedded) or pgvector |
| 9 | **Search Engine** | Full-text keyword search | Basic keyword scoring | ✅ | Recommend: Meilisearch or SQLite FTS5 |
| 10 | **Local LLM Service** | Fallback authoring/vision when providers fail | **NOT BUILT (optional)** | ✅ (with GPU) | Recommend: llama.cpp or vLLM |
| 11 | **File Processing** | Parse PDF/DOCX/TXT | Basic text ingestion | ✅ | Recommend: pdf.js + mammoth |
| 12 | **Image Processing** | Resize/optimize/mask | `sharp` (Node) + browser RMBG | ✅ | Already NEX-owned |
| 13 | **Monitoring Dashboard** | Ops Centre visibility | `src/app/nex-app/nex-brain/operations-centre/` | ✅ | Already NEX-owned |
| 14 | **Logging** | Audit trail | `src/lib/nex/events/fs-store.ts` + audit log | ✅ | Already NEX-owned |
| 15 | **Authentication** | User + service identity | Supabase Auth | ⚠︎ | Self-hostable via Ory Kratos / Keycloak |
| 16 | **Backup System** | Nightly snapshot + restore | **NOT BUILT** | ✅ | Recommend: restic → S3-compatible (any provider) |

### 2.2 · Worker → Service Communication

Every worker communicates through the **Event Bus** for observability and the **Job Queue** for coordination. No direct worker-to-worker calls — the whole system is queue-mediated.

| Worker | Reads from | Writes to | LLM channel |
|--------|-----------|-----------|-------------|
| knowledge-context | Knowledge Graph, Memory System | Job Queue (enqueue voice-context), Event Bus | — |
| voice-context | Brand terminology registry | Job Queue, Event Bus | — |
| learning-context | Feedback table via Search Engine | Job Queue, Event Bus | — |
| knowledge-extractor | Job Queue, all three bundles | Memory System, Knowledge Graph, Event Bus | Local LLM or provider chain |
| image-analyst | Job Queue, OCR Service (deterministic first pass), Image Processing | Memory System, Knowledge Graph, Event Bus | Local vision LLM or provider chain |
| quality-checker | Draft records, Knowledge Graph, audit logs | Memory System (promote/reject), Event Bus | Local LLM (Part B only, optional) |
| llm-retry | LLM retry queue | Event Bus | Provider chain |
| memory-guardian | Full corpus via Search Engine | Findings table, Event Bus | — |
| background-removal | (browser) | Image Processing | — |
| importer | Filesystem `data/knowledge/records/**` | Memory System, Knowledge Graph | — |
| recovery-manager | Worker Manager heartbeats, Job Queue | Recovery attempts log, Event Bus | — |

**Communication rules:**
1. Every message on the Event Bus has an `event_id` and is idempotent.
2. Job Queue claims use `SKIP LOCKED` (Supabase) or file-lock (filesystem) — never optimistic.
3. Automation Engine listens to the Event Bus and fires rules per authority level — no worker knows about the Automation Engine.
4. Monitoring Dashboard reads from Event Bus + Job Queue + Memory System — never mutates.

---

## Section 3 · Dependency Analysis

Every external dependency currently in the stack.

### 3.1 · LLM Providers (9 total)

| Provider | Why needed | Replaceable? | Open-source alternative | Hardware to replace | CPU or GPU | Pros | Cons |
|----------|-----------|:-:|-------------------------|---------------------|:-:|------|------|
| **Groq** | Primary text LLM (Llama 3.3 70B, fast) | ✅ | Same weights via llama.cpp / vLLM | 48 GB VRAM (2× RTX 3090 or A6000) | GPU | Free tier ~1K calls/day; 300 tok/s | Rate-limited; account-tied |
| **Gemini 1.5 Flash** | Vision primary + text fallback | ✅ | LLaVA 1.6 34B (vision) / Llama 3.1 8B (text) | 24 GB VRAM (RTX 3090) | GPU | Free tier generous; multimodal | Google account risk; ToS shifts |
| **Anthropic Claude Haiku** | Vision fallback + high-quality text | ⚠︎ | Same weights unavailable; closest is Qwen2-VL 72B | 80 GB VRAM (H100 or 2× A100) | GPU | Best editorial quality; long context | Paid only; API can be revoked |
| **OpenRouter** | Aggregator w/ Nemotron 550B free tier | ✅ | Direct provider access | N/A (routing only) | — | Access to many models; free tier | Adds a middleman; can vanish |
| **SambaNova** | Fast Llama 3.3 70B | ✅ | Same weights local | 48 GB VRAM | GPU | ~300 calls/day free; 200 tok/s | Small quota |
| **Mistral** | Small model + vision (medium) | ✅ | Mistral 7B weights on HuggingFace | 8 GB VRAM (Q4) or 16 GB (FP16) | GPU | Open weights! | Free tier limited |
| **Cerebras** | Fastest inference | ✅ | Same weights on slower local hardware | 48 GB VRAM | GPU | 2000+ tok/s | Free tier ~900/day; account risk |
| **Cloudflare Workers AI** | Edge inference (small models) | ✅ | Local small models | 4 GB VRAM (Llama 3.2 3B) | GPU or CPU | Free tier 10K neurons/day | Small models only |
| **HuggingFace Router** | Unified endpoint | ✅ | Direct model downloads + local inference | Depends on model | — | Discovery layer | Router itself can rate-limit |

**Verdict:** every LLM provider is replaceable if NEX invests in local GPU. The financial question is whether local hardware amortises against the free-tier quota that already exists.

### 3.2 · Infrastructure Providers

| Provider | Why needed | Replaceable? | Open-source alternative | Hardware to replace | Pros of replacing | Cons of replacing |
|----------|-----------|:-:|-------------------------|---------------------|-------------------|-------------------|
| **Supabase** | Postgres + Auth + Storage + Realtime | ✅ | Postgres + Ory Kratos + MinIO + centrifugo | 1 server, 8 GB RAM | Full ownership; no ToS risk | Lose managed backups + point-in-time recovery unless configured manually |
| **Fly.io** | Worker container hosting | ✅ | Docker on bare metal / Hetzner / self-hosted k3s | 1 server or Raspberry Pi 5 cluster | 10-100× cheaper at scale | Lose global anycast; must operate hosts |
| **ImageKit** | Image CDN + transformations | ✅ | Sharp + Cloudflare R2 + Bunny CDN | Any origin server | Transformations local | Lose global CDN edge |
| **Vercel** | Next.js hosting + Edge functions | ✅ | Self-hosted Next.js + Nginx | 1 server, 4 GB RAM | Full control | Lose preview URLs + edge network |
| **cron-job.org / Vercel Cron** | Scheduled invocation | ✅ | systemd timers / cronie | Any Linux host | Runs offline | Not visible from a dashboard unless self-instrumented |

### 3.3 · The Two Genuinely Hard Dependencies

Only **Anthropic Claude Haiku** and **the concept of a vision LLM** are difficult to fully own:

1. **Anthropic Haiku's editorial quality** is currently unmatched in the open-weights world for structured knowledge authoring. The closest replacement is Llama 3.1 70B FP16 (~140 GB VRAM) or Qwen2 72B — both require serious hardware (2× A100 or H100). Practical compromise: fall back to Llama 3.1 8B locally for degraded-but-continuous operation.

2. **Vision LLMs** are moving fast, but LLaVA 1.6 34B (24 GB VRAM) is the smallest realistic option for the current image-analyst workload. Below that, quality drops sharply for architectural imagery.

Everything else can be owned tomorrow with a checkbook.

---

## Section 4 · Cost Analysis

Three deployment scenarios. Numbers are 2026 spot prices in GBP and estimates for a UK/EU home installation.

### 4.1 · Option A · Home PC (Solo Founder Mode)

**Purpose:** Prove NEX can survive without any provider. Sole developer + demo traffic.

| Component | Spec | One-off cost | Notes |
|-----------|------|-------------:|-------|
| CPU | Ryzen 7 7700X (8c/16t) | £280 | Idles under load; enough for 5–10 concurrent workers |
| RAM | 64 GB DDR5 5600 | £180 | Room for Postgres + Qdrant + Node + Llama 8B Q4 |
| GPU | Used RTX 3090 (24 GB VRAM) | £600 | Runs LLaVA 1.6 13B Q4 for vision + Llama 3.1 8B FP16 for text simultaneously |
| Storage | 2× 2 TB NVMe (RAID 1) | £220 | ~100K knowledge records = ~5 GB; the rest is images |
| PSU + case + cooling | Corsair 850W + Fractal Meshify | £220 | 24/7 duty cycle |
| **Hardware total** | | **£1,500** | One-off |
| **Electricity** | 350 W avg × 24 × 365 × £0.30/kWh | **£920/yr** | Assumes UK domestic tariff |
| **ISP** | Existing home broadband | £0 marginal | Static IP add-on £5/mo if needed |
| **Expected throughput** | | | 5,000 knowledge dumps/day · ~100 image analyses/day |

**When to choose Option A:** you want to prove the ownership thesis, run offline demos, or self-host for a founder + <10 pilot merchants.

**Limits:** single point of failure. No high availability. Backup is only as good as the last restic snapshot.

### 4.2 · Option B · Dedicated Server (Production Mode)

**Purpose:** Serve 1,000–5,000 active merchants. 99.5% uptime.

| Component | Spec | Cost | Notes |
|-----------|------|-----:|-------|
| Hetzner AX102 (Ryzen 9 7950X3D + 128 GB + 2× 2 TB NVMe) | Bare-metal dedicated | **£140/mo** | Runs everything except heavy LLM |
| Hetzner GEX44 (RTX 4000 SFF Ada, 20 GB VRAM) | GPU dedicated | **£195/mo** | LLaVA 1.6 13B + Llama 3.1 8B for local fallback |
| Cloudflare R2 (image storage) | 500 GB + egress | **£8/mo** | Replaces ImageKit for storage |
| Backup S3 (Backblaze B2) | 200 GB restic snapshots | **£1.20/mo** | Nightly + 30-day retention |
| Domain + email | | **£15/yr** | |
| **Monthly total** | | **~£345/mo** | ~£4,140/yr |
| **Compared to** | Vercel Pro + Supabase Pro + Fly.io team + LLM spend | ~£800/mo typical | ≥ 50% saving at this scale |
| **Expected throughput** | | | 50,000 knowledge dumps/day · 2,000 image analyses/day · 10K concurrent web requests |

**When to choose Option B:** first paying customers, production reliability required, LLM spend already >£200/mo, need to control data residency.

**Limits:** still single-region. Requires ops discipline (patching, monitoring, backup verification).

### 4.3 · Option C · Scale to Hundreds of Workers

**Purpose:** 50K+ merchants, sub-second SLAs, multi-region.

**Topology:**
- 3-node Postgres cluster (Patroni or CloudNativePG) — 1 primary + 2 replicas across 2 regions
- 2-node Qdrant cluster (sharded)
- 8× worker nodes (each 32 vCPU / 128 GB / no GPU) running Node containers — 8 workers per node = 64 workers total, extensible
- 4× GPU nodes (2× A100 80 GB each) for local LLM inference behind a routing layer — sustained 40K tokens/sec/node
- Object storage: Cloudflare R2 or self-hosted MinIO cluster
- CDN: Bunny.net or Cloudflare
- Monitoring: Prometheus + Grafana + Loki
- Load balancer: HAProxy or Envoy

| Cost line | Monthly | Notes |
|-----------|--------:|-------|
| 8× worker nodes (Hetzner AX102) | £1,120 | Handles the CPU-heavy 75% of workers |
| 4× GPU nodes (A100 80 GB rented) | £4,800 | Or one-off buy £96K amortised |
| 3× Postgres nodes | £180 | Or managed £600 |
| 2× Qdrant nodes | £120 | |
| R2 storage (5 TB) | £60 | |
| Bandwidth (10 TB/mo egress) | £90 | R2 = free egress; upstream ISP applies |
| Monitoring stack (self-hosted) | £30 | 1 small node |
| Backup S3 (Backblaze B2) | £15 | |
| **Total** | **£6,415/mo** | ~£77K/yr |
| **Compared to** | Full managed stack (Vercel Enterprise + Anthropic bulk + AWS RDS) | typically £15–30K/mo at this scale |

**Expected throughput:** 5M knowledge dumps/day · 200K image analyses/day · 100K concurrent web requests.

**When to choose Option C:** you have paying revenue that dwarfs the £77K/yr line item. Every previous option should be exhausted first.

### 4.4 · Cost Comparison at a Glance

| Metric | Option A (Home) | Option B (Server) | Option C (Cluster) |
|--------|:-:|:-:|:-:|
| Setup cost | £1,500 one-off | ~£0 | ~£10K + 1 week ops |
| Monthly cost | £77 (electricity) | £345 | £6,415 |
| Merchants supported | <10 pilot | 1K–5K | 50K+ |
| GPU capacity | 24 GB VRAM | 20 GB VRAM | 640 GB VRAM |
| Throughput ceiling | 5K dumps/day | 50K dumps/day | 5M dumps/day |
| Uptime | Best-effort | 99.5% | 99.95% |
| Ops effort | 1 hr/week | 4 hr/week | 40 hr/week (1 SRE) |

---

## Section 5 · Final Categorisation

### 5.1 · Services That REQUIRE AI

Only three, and only one is critical:

| Service | Why | Falls back to |
|---------|-----|---------------|
| **knowledge-extractor** | Language generation | Human authoring queue if LLM totally unavailable |
| **image-analyst** | Vision-language synthesis | Human review queue |
| **quality-checker (Part B only)** | Editorial judgment | Human review queue (Part A always runs) |

### 5.2 · Services That DO NOT Require AI

Everything else. Explicitly:

- knowledge-context · voice-context · learning-context · llm-retry (retry mechanics only)
- memory-guardian · background-removal · importer · recovery-manager
- Worker Manager · Job Queue · Scheduler · OCR · Embedding · Knowledge Graph · Memory System
- Vector DB · Search Engine · File Processing · Image Processing · Monitoring · Logging
- Authentication · Backup

**11 of 11 auxiliary services and 8 of 11 workers are AI-free.**

### 5.3 · Services That Can Run COMPLETELY OFFLINE

Every service listed in 5.2 plus:

- OCR (Tesseract 5) · Embedding (BGE-small local) · Vector DB (Qdrant embedded) · Search (Meilisearch)
- Local LLM Service (llama.cpp) when configured
- Even `knowledge-extractor` and `image-analyst` can run offline **if** Local LLM Service is configured

**In practice:** the entire NEX Headquarters can run air-gapped on Option A hardware, degraded only by whichever LLM model fits the local GPU.

### 5.4 · Services That Currently Depend on Third Parties

- **Hard dependencies:** Anthropic Claude Haiku (best-in-class editorial), Gemini vision (primary path)
- **Convenience dependencies:** Groq, SambaNova, Cerebras, OpenRouter, Mistral, Cloudflare AI, HuggingFace (fallback breadth)
- **Infrastructure dependencies:** Supabase, Fly.io, ImageKit, Vercel, cron-job.org

Every one of these has a replacement path documented in §3.

### 5.5 · Services That NEX Could Realistically Own Tomorrow

| Now (already NEX-owned) | Owned with £1.5K hardware (Option A) | Owned with £4K/yr operational (Option B) |
|-------------------------|--------------------------------------|--------------------------------------------|
| Worker Manager | + Local LLM (small models) | + Local LLM (mid models) |
| Job Queue | + Vector DB (Qdrant) | + Multi-region replication |
| Recovery Manager | + Embedding service | + Full observability stack |
| Memory System | + Search Engine | + Backup verified restores |
| Knowledge Graph | + OCR | + Point-in-time DB recovery |
| Event Bus | + Authentication (Kratos) | |
| Automation Engine | + Backup System (restic) | |
| Contacts, Tracking, Attribution, Analytics | + File Processing | |

---

## Section 6 · Recommended Path Forward

### Phase 1 · Own the Foundation (this month, £0)
1. Ship **OCR** (Tesseract via `node-tesseract-ocr`), **Embedding Service** (BGE-small via `transformers.js`), and **Vector DB** (Qdrant embedded).
2. Wire `knowledge-context` to use embeddings for semantic retrieval; keep keyword scoring as fallback.
3. Ship **Backup System** (nightly restic to Backblaze B2, £1.20/mo).

### Phase 2 · Prove Offline Operation (next month, £1.5K)
1. Assemble Option A hardware.
2. Install `llama.cpp` + Llama 3.1 8B Q4 + LLaVA 1.6 13B Q4.
3. Extend the LLM provider chain to include `local` as a provider (routed based on `require_capability` = vision).
4. Demonstrate: pull the internet cable and process a full knowledge dump end-to-end.

### Phase 3 · Migrate Production (when >£200/mo LLM spend, £345/mo)
1. Provision Option B servers (Hetzner AX102 + GEX44).
2. Migrate Supabase → self-hosted Postgres + Kratos + MinIO.
3. Cut over ImageKit → R2 + Bunny.
4. Keep Anthropic + Gemini as premium fallback for the 5% of jobs where local model quality is insufficient.

### Phase 4 · Scale (only when revenue justifies, ~£77K/yr)
1. Cluster expansion per §4.3.
2. Hire SRE.
3. Local LLM cluster becomes primary; external providers become quality-boost fallback for premium jobs only.

---

## Appendix · Guiding Principles for HQ Design

1. **Every worker is queue-mediated.** No direct calls. This is why swapping any implementation (filesystem → Supabase, remote LLM → local LLM) is a config change, not a rewrite.
2. **LLM is a plugin, not a foundation.** The provider chain is one dependency injected into two workers. The rest of the system does not know or care that LLMs exist.
3. **Deterministic first, LLM second.** Every LLM call should be preceded by traditional software that reduces the input space and follows by traditional software that validates the output.
4. **Own the audit trail unconditionally.** No third party ever holds NEX's audit log. The Event Bus, the Memory System, and the Knowledge Graph must survive the disappearance of every external provider on the same day.
5. **Choose ownership boundaries by cost of failure, not cost of ownership.** Losing Anthropic's API for a week hurts. Losing NEX's own knowledge graph for an hour is existential. Ownership follows the second.

---

*End of Blueprint. Version 1.0. Every recommendation is testable with concrete hardware SKUs and can be procured within one billing cycle.*

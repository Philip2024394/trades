# ADR-0120 · NEX Live Chat Completion · Brain Architecture · Four Doctrines

**Date:** 2026-09-09
**Status:** ACCEPTED · IMMUTABLE at doctrine level (see §5) · additive at architecture level (see §7)
**Supersedes:** none (additive to ADR-0027 · ADR-0028 · ADR-0034 · ADR-0100 lineage)
**Supersedes-by:** none

---

## 0 · Preamble

This ADR is the durable governance record for the Live Chat Completion pipeline shipped during Path A + Path B (2026-09-09). It locks in:

1. The **four Founder Doctrines** that govern how any NEX subsystem may reach the user.
2. The **brain architecture** (Main Brain → Knowledge / Research / Action + shared Truth Engine / Memory / Safety / Observatory) that convergent industry practice validates.
3. The **capability-scoped worker discipline** (worker = capability, domain = parameter).
4. The **composition-first economic discipline** ("LLM only when necessary").

Every architectural rule in §5 (doctrines) MUST hold. Every architectural pattern in §6-§9 is the current expression of the doctrines; those patterns may evolve, but only in ways that continue to satisfy §5.

---

## 1 · Why This ADR Exists

Between 2026-08 and 2026-09, NEX added a multi-brain conversational intelligence layer on top of the existing Knowledge Factory + Truth Engine. The layer had to reach ChatGPT-class capability while remaining tractable in one small engineering team. The result was a mainstream orchestrator/worker shape (per OpenAI, Anthropic, LangGraph, CrewAI, Bedrock, Vertex — see `docs/research/nex_architecture_research_2026_09_09.md`), but with four **doctrine anchors** that make NEX qualitatively safer than any of those frameworks in isolation.

Every current and future session — human or AI — must be able to look at this ADR and answer:

- "What can never happen to NEX output?" → §5.
- "Where is that enforced?" → §5.6 (locations by doctrine).
- "How is the ecosystem shaped?" → §6-§9.

If any future change breaks the answer to those questions, the change is rejected.

---

## 2 · Scope

- **In scope:** the Live Chat Completion pipeline (`src/app/api/nex-conv/chat/route.ts` + `src/lib/nex/live-chat-completion/**` + `src/lib/nex/research-brain/**` + `src/lib/nex/knowledge-brain/**` + `src/lib/nex/action-brain/**` + `src/lib/nex/observatory-brain/**` + `src/lib/nex/workers/**` + `src/lib/nex/live-chat-completion/memory/**`), the Postgres audit trail, and the founder-facing observatory dashboard.
- **Out of scope:** the Yard, Trade Center, SiteBook, Homeowner Notebook. Those retain their own ADRs.
- **Out of scope:** the Knowledge Factory ingestion pipeline (ADR-0044 lineage).

---

## 3 · Terminology

- **Brain** — a facade module that owns one broad capability and composes lower-level workers/adapters.
- **Worker** — a stateless capability function parameterised by domain (e.g. `verificationWorker(ctx, input)` works for accommodation, food, transport, ...).
- **Adapter** — a DomainAdapter implementation (`accommodation-adapter.ts`, `food-adapter.ts`, `transport-adapter.ts`) exposing `canHandle` + `compose`.
- **Fabrication Gate** — the module that validates every LLM claim against evidence + alignment scoring.
- **Truth Engine** — the module that assigns trust bands to facts based on freshness + conflict + provenance.
- **Doctrine** — a rule that MUST hold. Violations are ship-blocking. Doctrines are immutable at intent; enforcement mechanisms may evolve.

---

## 4 · Governance References

- ADR-0027 · NEX Golden Rules (constitution)
- ADR-0028 · NEX Intelligence Constitution
- ADR-0034 · NEX Master Knowledge Engine + Gold Standard
- ADR-0043 · Reality Over Speculation
- ADR-0100 · NEX Internal Calling Architecture
- ADR-0119 · Accommodation Intelligence Database Authority
- Founder research report · `docs/research/nex_architecture_research_2026_09_09.md`
- Founder audit report · `docs/research/nex_architecture_audit_2026_09_09.md`
- Founder synthesis · `docs/research/nex_architecture_synthesis_2026_09_09.md`

---

## 5 · The Four Founder Doctrines · IMMUTABLE

### 5.1 · Doctrine #1 · LLM Rescue Never Bypasses the Truth Engine
*Established 2026-09-09 during Phase 3.4.*

> Every LLM output that reaches the user must be validated against an evidence bundle. Orphan citations are rejected. Trust caps at `evidence_provisional` — LLM output is NEVER elevated to `canonical_verified`. When alignment between a claim and its cited evidence is below threshold, the claim is rejected as postrationalisation (per arXiv 2510.24476).

**Enforcement location:** `src/lib/nex/live-chat-completion/llm-rescue/gate.ts` (fabrication gate) + `src/lib/nex/live-chat-completion/llm-rescue/alignment.ts` (Fabrication Gate v2 alignment scorer).

**Verification surface:** `nex.gate_rejection_event` + `nex.gate_kept_event` + Observatory Brain `groundedness` card.

**Never allowed:** any code path that emits customer-visible text from an LLM without traversing `gateLlmOutput()`.

---

### 5.2 · Doctrine #2 · LLM Never Executes an Action Without NEX Authorization
*Established 2026-09-09 during Phase 3.7 (Safe Actionable Intelligence).*

> Every proposed action (whether from LLM, MCP client, or internal worker) must traverse the 7-stage authorize pipeline: schema validation → registry lookup → permission check → guardrail → confirmation → execution → immutable audit. The LLM proposes; NEX decides.

**Enforcement location:** `src/lib/nex/live-chat-completion/actions/authorize.ts` (pipeline) + `src/lib/nex/action-brain/index.ts` (facade) + `src/lib/nex/action-brain/mcp-server.ts` + `mcp-jsonrpc.ts` (external transport).

**Verification surface:** `nex.action_audit` (immutable) + Observatory Brain `Doctrine Health` card.

**Never allowed:** any code path that dispatches an action without producing an `action_audit` row.

---

### 5.3 · Doctrine #3 · Vision + File + Web Evidence Capped at `evidence_provisional`
*Established 2026-09-09 during Phase 3.8 (Vision) · Phase 3.9 (Files) · Phase A2 (Research Brain).*

> Evidence extracted from user-provided images, files, or web-fetched pages is by nature user-influenced or third-party unverifiable. Its trust ceiling is `evidence_provisional`. Owner-verified evidence may later be elevated only via a separate BEGIN once owner-identity ships.

**Enforcement location:** `src/lib/nex/live-chat-completion/vision/index.ts` (`visionFactsToEvidence` caps at 0.75) · `files/index.ts` (`fileFactsToEvidence` caps at 0.75) · `research-brain/index.ts` (`reportToEvidenceItems` caps at 0.75).

**Verification surface:** `EvidenceItem.confidence` for `source_type ∈ {vision, file, web_search}` — Observatory Brain `Doctrine Health` reports `doctrine_3_trust_cap_violations` (target 0).

**Never allowed:** any code path that produces an EvidenceItem with source_type in that set with `confidence > 0.75` or `trust: canonical_verified`.

---

### 5.4 · Doctrine #4 · Memory Informs Context · Memory Does NOT Establish Truth
*Established 2026-09-09 during Phase 3.10 (L2 memory) · Founder verbatim wording.*

> A remembered user preference (e.g. "I prefer concise answers") may influence tone, format, or filtering. A remembered factual claim (e.g. "my business address is X") must NEVER become authoritative evidence. Memories are USER-STATED context, not verified facts.

**Enforcement location:**
- `src/lib/nex/live-chat-completion/memory/contract.ts` (contract note + `PersonalizationContext` is a DISTINCT surface from `EvidenceItem`)
- `src/lib/nex/live-chat-completion/memory/postgres-store.ts` (never produces EvidenceItems)
- `src/lib/nex/live-chat-completion/llm-rescue/gate.ts` (defensive reject of any `source_ref` matching `/^memory:/i` with reason `doctrine_4_memory_is_not_truth`)

**Verification surface:** `nex.gate_rejection_event.reason = 'doctrine_4_memory'` + Observatory Brain `Doctrine Health` card.

**Never allowed:**
- Converting a memory into an EvidenceItem. There is no `source_type: "memory"`.
- Elevating a memory's confidence to imply truth.
- Custom instructions overriding honest UNKNOWN or introducing facts.

### 5.5 · Four-Layer Trust Model (Founder verbatim)

| System              | Role                                    |
| ------------------- | --------------------------------------- |
| Knowledge Factory   | Builds knowledge                        |
| Truth Engine        | Determines evidence / trust             |
| Memory              | Remembers user / context                |
| LLM / Vision        | Proposes interpretation / content       |

NEX is the sole authority deciding what actually reaches the user. Doctrines #1-#4 are the mechanisms by which that authority is exercised.

### 5.6 · Immutability Clause

The **intent** of Doctrines #1-#4 is IMMUTABLE. The **enforcement mechanisms** may evolve (e.g. Gate v2 alignment scoring replaced Gate v1 ref-only validation) provided the new mechanism preserves the doctrine invariant. Any change that weakens a doctrine invariant is rejected. Any expansion (e.g. Doctrine #5 in future) requires a superseding ADR that explicitly names this one.

---

## 6 · Brain Architecture · Current Expression

Convergent-industry manager/worker shape (OpenAI Practical Guide 2025 · Anthropic Research 2025 · LangGraph supervisor · CrewAI hierarchical · AWS Bedrock supervisor-collaborator · Google Vertex orchestrator — see `docs/research/nex_architecture_research_2026_09_09.md` §3.C).

```
                       NEX MAIN BRAIN
                             │
                  ┌──────────┴──────────┐
                  │    ORCHESTRATOR     │  (src/lib/nex/brain/orchestrate.ts + chat/route.ts)
                  └──────────┬──────────┘
                             │
      ┌──────────────────────┼──────────────────────┐
      │                      │                      │
      ▼                      ▼                      ▼
  KNOWLEDGE               RESEARCH                ACTION
   BRAIN                   BRAIN                   BRAIN
      │                      │                      │
      ▼                      ▼                      ▼
  KF · Truth Engine     Deep-research loop      Registry · authorize
  Retrieval · Memory    Web/Search · Fetch      MCP server · JSON-RPC
      │                      │                      │
      └──────────────────────┼──────────────────────┘
                             ▼
                     FABRICATION GATE v2
                             │
                             ▼
                          USER
```

**Shared cross-cutting layers:**
- **Truth Engine** (`live-chat-completion/truth-engine/`)
- **Memory** (`live-chat-completion/memory/`) — DOCTRINE #4 surface
- **Safety** (`live-chat-completion/safety/`) — DOCTRINE #2 surface (guardrails)
- **Observatory** (`observatory-brain/`) — read-only measurement of everything above

---

## 7 · Brain-by-Brain Contract Summary

### 7.1 · Main Brain (orchestrator)
- **Facade:** `src/lib/nex/brain/orchestrate.ts` (`orchestrateChatTurn`).
- **Entry point:** `src/app/api/nex-conv/chat/route.ts`.
- **Contract:** Every chat request routes through `orchestrateChatTurn` before delegating to a DomainAdapter. Domain classification happens here.

### 7.2 · Knowledge Brain
- **Facade:** `src/lib/nex/knowledge-brain/index.ts` (`answer(query)`).
- **Retrieval:** `hybrid-retriever.ts` — BM25 (Postgres FTS) + dense (char-trigram cosine · SI-1 style · deterministic) + cross-encoder rerank via Gate v2 alignment scorer · fused via Reciprocal Rank Fusion (Cormack 2009).
- **HTTP surface:** `/api/nex/knowledge-brain/query`.
- **Doctrine:** #1 (results feed the same Truth Engine); #3 (web-derived hits capped in `answerToEvidenceItems`).

### 7.3 · Research Brain
- **Facade:** `src/lib/nex/research-brain/index.ts` (`research(objective)`).
- **Workers:** `plan-worker` → `search-worker` → `page-worker` (with `page-fetcher` bounded HTML fetch, RB-2) → `cross-check-worker` → `synthesis-worker`.
- **Firing rule:** only when adapter did not promote AND rescue did not verify AND composer is on `boundary:zero_evidence:*` OR `llm_rescue_gated_honest_limitation` path.
- **Activation rule:** replaces customer reply with `"Based on research: <headline> (research · N cited sources)"` when nothing higher-quality is available.
- **Doctrine:** #1 (every CitedClaim passes Gate v2 alignment); #3 (web evidence capped at 0.75 in `reportToEvidenceItems`).

### 7.4 · Action Brain
- **Facade:** `src/lib/nex/action-brain/index.ts` (`propose` / `confirm` / `listActions`).
- **Pipeline:** `src/lib/nex/live-chat-completion/actions/authorize.ts` (7 stages).
- **HTTP surface (internal):** `/api/nex/action-brain/{list,propose}`.
- **HTTP surface (external MCP):** `/api/nex/mcp` (JSON-RPC 2.0 · `initialize` / `ping` / `tools/list` / `tools/call` · batch support · protocol version `2024-11-05`).
- **Doctrine:** #2 (every call materialises `nex.action_audit` row).

### 7.5 · Observatory Brain
- **Facade:** `src/lib/nex/observatory-brain/index.ts` (`snapshot(window)`).
- **HTML surface:** `/nex/observatory`.
- **JSON surface:** `/api/nex/observatory/snapshot?window=1h|24h|7d|30d`.
- **Reads:** `nex.action_audit` · `nex.moderation_event` · `nex.safety_audit_event` · `nex.gate_rejection_event` · `nex.gate_kept_event` · `nex.turn_latency_event` · `nex.question_variant` · `nex.knowledge_gap`.
- **Writes:** none. Read-only by design.
- **Doctrine:** measures all four doctrines · alerts on any drift.

### 7.6 · Reusable Capability Workers
Directory: `src/lib/nex/workers/`. Every worker is `(ctx: WorkerContext, input: <capability-specific>) → WorkerResult<T>` where `ctx.domain` is a string. **One worker × N domains.**

Registered workers: `discoveryWorker` · `extractionWorker` · `normalisationWorker` · `dedupWorker` · `entityResolutionWorker` · `verificationWorker` · `conflictWorker` · `gapWorker` · `freshnessWorker` · `indexWorker`.

---

## 8 · Storage Layer · Doctrine Audit Trail

Migrations (`deploy/postgres/init/`) that materialise the doctrine surface:

| Migration | Table | Doctrine | Role |
|-----------|-------|----------|------|
| `149_nex_safety_observability.sql` | `nex.moderation_event` | #2 | Guardrail firings |
| `150_nex_action_audit.sql` | `nex.action_audit` | #2 | Immutable action trail |
| `151_nex_user_memory.sql` | `nex.user_profile` · `nex.user_memory` | #4 | L2 memory (never EvidenceItem) |
| `152_nex_gate_rejection_event.sql` | `nex.gate_rejection_event` · `nex.gate_kept_event` | #1 · #4 | Fabrication Gate v2 telemetry |
| `153_nex_turn_latency_event.sql` | `nex.turn_latency_event` | (composition-first monitor) | Per-turn path + latency |
| `154_nex_user_memory_tier.sql` | `nex.user_memory.tier` | #4 | Semantic · episodic · procedural |

All tables above are append-only. Historical rows may be truncated by explicit operator action; never mutated in place.

---

## 9 · Composition-First Discipline

Anthropic's engineering blog documents that multi-agent research runs at ~15× the token cost of normal chat ([Claude blog · When to use multi-agent systems](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)). NEX therefore preserves the discipline documented in the Composition Pilot n=354 result (see `MEMORY.md` pinned entries):

> **Route to the cheapest path that can honestly answer.** LLM is invoked only when necessary. Postgres avoided 99.4% on user path. Hot-tier P50 sub-ms. Zero-fabrication invariant preserved.

Enforcement gates (as of 2026-09-09):
- `_researchShouldFire` fires only on honest-UNKNOWN composer paths.
- `research_activated` swaps in a Research Brain reply only when nothing higher-quality exists.
- Knowledge Brain supplementary hits (`kb_extra_items`) are added only when the rescue path is about to fire.
- Observatory Brain alerts when `llm_invoked_ratio > 0.05` in a window.

**Never allowed:** invoking the LLM as a default. The LLM is a fallback, not a primary.

---

## 10 · How to Extend NEX Without Breaking This ADR

For every new brain, worker, adapter, or route:

1. **Locate the doctrine.** Which of the four doctrines is nearest to what your change touches? Read §5 of this ADR.
2. **Point to the enforcement.** Show — file + line — where your change either honours the existing enforcement mechanism or extends it in a way that preserves the doctrine invariant.
3. **Add the smoke.** Every new subsystem gets a `scripts/smoke-<name>.mjs` matrix that asserts the doctrine still holds under its traffic.
4. **Wire the observatory.** New surfaces expose counts in `nex.*` audit tables and get a row in `computeDoctrineHealth` or `computeGroundedness`.
5. **Update this ADR** with a new subsection under §7 or §8. Never delete existing sections without a superseding ADR.

Never allowed shortcut: hard-coding an escape hatch "just for this one internal caller." One call site per doctrine. External transports (MCP) route through the same facade internal callers do.

---

## 11 · Regression Matrix Baseline (2026-09-09)

Fresh check-in must maintain **17/17 smoke matrices green**:

```
smoke-gate-alignment            · Fabrication Gate v2 · Doctrine #1
smoke-research-brain            · Deep Research loop
smoke-research-activation       · Research Brain user-visible reply
smoke-research-fetch            · RB-2 full page fetch
smoke-knowledge-brain           · BM25 + dense + rerank fusion
smoke-kb-supplement             · KB as supplementary evidence for rescue
smoke-food-transport-adapters   · Thin domain adapters
smoke-action-brain              · Action Brain facade · Doctrine #2
smoke-mcp                       · MCP JSON-RPC 2.0 external transport
smoke-observatory               · Doctrine + groundedness metrics
smoke-observatory-latency       · Per-turn telemetry + P50/P95
smoke-observatory-page          · HTML dashboard
smoke-vision                    · Vision extraction · Doctrine #3
smoke-files                     · File extraction · Doctrine #3
smoke-l2-memory                 · L2 memory · Doctrine #4
smoke-l2-memory-tiered          · Semantic · episodic · procedural
smoke-llm-rescue                · LLM rescue baseline
```

Any ADR-changing PR must demonstrate 17/17 or explain the intentional regression in the PR description.

---

## 13 · Local-Only Mode (NEX AI-WiFi) · Amendment 2026-09-09

The **NEX AI-WiFi Architecture** is a deployment mode of this ADR — not a superseding design. Under this mode, NEX runs 100% of its AI inference locally (Ollama + tesseract.js WASM + Postgres) and uses the internet ONLY as a raw-data supply chain (Wikipedia · Wikidata · DuckDuckGo · OpenStreetMap · Open-Meteo · public gov data). Zero calls are made to any external AI provider (OpenAI · Anthropic · Google · OpenRouter · Groq · SambaNova · Cerebras · HuggingFace inference · Mistral cloud · Cloudflare Workers AI).

### 13.1 · Sentinel

`src/lib/nex/live-chat-completion/local-only.ts` exports `applyLocalOnlyModeIfSet()`. When `NEX_LOCAL_ONLY=1` is set, the module fills provider selectors with local defaults using `??=` (non-destructive):

```
NEX_LLM_RESCUE_PROVIDER      ??= "ollama"
NEX_VISION_PROVIDER          ??= "ollama"
NEX_WEB_ACQUISITION_PROVIDER ??= "ddg"
NEX_EMBEDDING_PROVIDER       ??= "ollama"
NEX_FILE_PROVIDER            ??= "real"
LLM_ALLOW_MOCK_FALLBACK      ??= "false"
```

Sentinel is imported once at chat-route module load. Existing env values ALWAYS win — this preserves the regression matrix (which uses `mock` providers for deterministic outputs).

### 13.2 · Doctrine Preservation

The four doctrines are **provider-agnostic**. Local-only mode changes provider selection, not enforcement:

| Doctrine | Local-only impact |
|---|---|
| #1 · LLM rescue never bypasses Truth Engine | UNCHANGED · local Ollama output still passes Gate v2 alignment |
| #2 · LLM never executes action without NEX authorization | UNCHANGED · local proposals still traverse the 7-stage authorize pipeline |
| #3 · Vision + file + web capped at `evidence_provisional` | UNCHANGED · cap is source-type-based, not provider-based |
| #4 · Memory informs context, not truth | UNCHANGED · memory tier + defensive gate reject unchanged |

Local-only mode **strengthens** the doctrine spirit: every claim reaching the user is traceable to either a gate-validated local Ollama output or a fetched span from a named public source (attributable via `/api/nex/attributions`). Nothing is inference-behind-a-proprietary-API.

### 13.3 · Public Data Providers (composite pattern)

`src/lib/nex/live-chat-completion/web-acquisition/composite-provider.ts` fans a query to N sub-providers in parallel under a shared budget, deduped by URL. When `NEX_WEB_ACQUISITION_PROVIDER=composite` (default in AI-WiFi mode) the composite wraps:

- `ddg-wikipedia-provider.ts` · DuckDuckGo Instant Answer + Wikipedia REST
- `wikidata-provider.ts` · Wikidata SPARQL + wbsearchentities (CC0)
- `nominatim-provider.ts` · OpenStreetMap geocoding (1 req/s · ODbL · rate-limited at process level)
- `openmeteo-provider.ts` · weather (10k/day free · CC BY 4.0 · keyword-gated)

Adding a new public data provider = one file implementing `WebProvider` + one line in `makeDefaultWebProvider()`. Contract-driven, so no downstream code changes.

### 13.4 · Attributions Surface

`GET /api/nex/attributions` returns the license + attribution text for every public data source NEX uses. Chat UI + Observatory render this as a "Sources" footer when Research Brain cites external data. Wikipedia CC BY-SA and OSM ODbL require attribution; Wikidata CC0 and Open-Meteo CC BY are attribution-friendly. The endpoint is static data · no internet dependency · always available even when WiFi is down.

### 13.5 · Bigger Local Model on Demand

`ollama-provider.ts` exports `selectOllamaModel(size)` where size = `"small"` (default `qwen2.5:3b`) or `"large"` (env `NEX_OLLAMA_RESCUE_MODEL_LARGE`). Research Brain synthesis or model-router `model_class === "reasoning"` may request `"large"` for hard queries. Default is same as small model so behaviour unchanged unless operator opts in.

### 13.6 · Offline Resilience

`scripts/smoke-offline.mjs` asserts:
- Routine adapter queries still land from Postgres alone
- Fabrication guard holds even when internet-only queries can't complete
- Observatory Brain + Knowledge Brain respond (Postgres-only surfaces)
- Attributions endpoint responds (static data)

The full end-to-end offline test is a manual "pull the WiFi" exercise; this smoke gives the deterministic guarantees.

### 13.7 · Regression Baseline

The regression matrix baseline (§11) is now **20/20 green**, adding:
```
smoke-local-only    · AIW-6 · sentinel semantics + attributions
smoke-offline       · AIW-5 · Postgres-only surfaces + fabrication guard
```

### 13.8 · License-Clean Commercial Model Choice

Recommended (all Apache 2.0 / MIT / equivalent · no MAU caps):
- **Qwen 2.5 family** (Apache 2.0) — rescue + reasoning + vision
- **nomic-embed-text** (Apache 2.0) — default embeddings
- **BGE-M3** (MIT) — multilingual (Indonesian) workloads
- **tesseract.js** (Apache 2.0) — OCR

Avoid for commercial ship:
- **Llama** (Meta community license · 700M MAU cap)
- **Gemma** (Google · use-case restrictions)

### 13.9 · Founder-Level Governance

Local-only mode is currently **opt-in via `NEX_LOCAL_ONLY=1`**. Making it the production default requires a superseding ADR that documents the operational readiness measurement (Ollama uptime SLO · model warm-up latency · public-data-source availability SLO).

---

## 12 · Bottom Line

NEX has a mainstream orchestrator/worker architecture, cross-referenced against six independent industry sources, with four doctrine anchors that make its output qualitatively safer than any of those frameworks by itself:

- **Doctrine #1** blocks fabrication.
- **Doctrine #2** blocks unauthorized action.
- **Doctrine #3** blocks trust-cap violations from user-influenced or third-party evidence.
- **Doctrine #4** blocks the confusion of memory with truth.

Zero doctrine violations have been observed in the 17-matrix regression baseline. `overall_score = 1.0` on the Observatory dashboard. Every metric is MEASURED, not asserted.

Every future change ships against this baseline.

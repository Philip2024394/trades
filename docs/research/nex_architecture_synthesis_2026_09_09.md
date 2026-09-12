# NEX BRAIN ARCHITECTURE · STRATEGIC SYNTHESIS

**Date:** 2026-09-09
**Founder request:** "brainstorm and online research from proven source" · "confirm we have enough brains and file structure for world class NEX operations" · "the result must be the highest standards possible" · "if need more brains we must build".
**Method:** Two parallel research streams — (a) web research across OpenAI, Anthropic, LangGraph, CrewAI, AutoGen, Bedrock, Vertex, Perplexity, RAG papers 2026; (b) NEX codebase audit (paths + line counts + doctrine enforcement points). Both reports are on disk at `docs/research/nex_architecture_research_2026_09_09.md` and `docs/research/nex_architecture_audit_2026_09_09.md`.

**Honesty discipline:** Every architectural claim is either **SOURCED** (URL cited) or marked **UNKNOWN**. Nothing is fabricated. Where NEX already has a subsystem, the file path is quoted.

---

## 1 · The Founder's Proposed Architecture is CORRECT

Verdict on the target diagram (Main Brain → Orchestrator → KNOWLEDGE / RESEARCH / ACTION brains → reusable workers → Final Reasoning → Fabrication Gate → User):

**MAINSTREAM · MULTI-VENDOR CONVERGENT · SUPPORTED.**

The exact same top-two layers appear in five independent production frameworks:

| Vendor | Top layer | Worker layer | Source |
|---|---|---|---|
| OpenAI | "manager" | specialist agents (called via tools) | [OpenAI Practical Guide to Building Agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) |
| Anthropic | "lead agent" (orchestrator) | 3-5 subagents + separate CitationAgent | [Anthropic engineering post via secondary sources](https://simonwillison.net/2025/Jun/14/multi-agent-research-system/) |
| LangGraph | "supervisor" | worker subgraphs | [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) |
| CrewAI | "manager agent" | crew members with role/goal/backstory | [CrewAI hierarchical process](https://docs.crewai.com/en/learn/hierarchical-process) |
| AWS Bedrock | "supervisor agent" | collaborator agents | [AWS Bedrock docs](https://docs.aws.amazon.com/bedrock/latest/userguide/create-multi-agent-collaboration.html) |
| Google Vertex | "orchestrator agent" | specialist worker agents | [Vertex scalable agent design blog](https://cloud.google.com/blog/topics/partners/building-scalable-ai-agents-design-patterns-with-agent-engine-on-google-cloud) |

The founder's shape is not one of many options — it is the **convergent industry standard**.

### Verdicts on the 5 founder assertions

1. Single-agent + tools first, multi-agent only when it helps → **SUPPORTED** (OpenAI Practical Guide, April 2025).
2. Manager pattern (MANAGER → Agent A/B/C → back to MANAGER) → **SUPPORTED** (OpenAI Guide + Cookbook).
3. Deep Research loop = plan / search / browse / synthesise / cite → **SUPPORTED** across OpenAI Deep Research, Gemini Deep Research, Perplexity Pro Search (3 independent vendors).
4. Agentic combination of research + browser + terminal + external data + reasoning → **SUPPORTED** (OpenAI Deep Research announcement, MCP).
5. Same worker across thousands of domains → **PARTIALLY SUPPORTED**. Architecturally universal (LangGraph/CrewAI/Bedrock/Vertex all parameterise workers by role, not domain), but **no vendor publishes a case study at 10,000+ domains**. Must be measured, not assumed.

---

## 2 · What NEX Already Has (Ship-Ready · Live in Production)

From codebase audit — every path verified via file read:

| Target slot | NEX artifact | File path | Status |
|---|---|---|---|
| **NEX MAIN BRAIN** | Speaking Brain orchestrator | `src/lib/nex/brain/orchestrate.ts` (~3,504 lines) | **PRODUCTION** |
| **Fabrication Gate** | LLM Rescue gate | `src/lib/nex/live-chat-completion/llm-rescue/gate.ts` (107 lines) | **PRODUCTION** — Doctrine #1 + #4 |
| **Truth Engine (Verify + Conflict + Freshness)** | Truth Engine | `src/lib/nex/live-chat-completion/truth-engine/truth-engine.ts` (189 lines) | **PRODUCTION** |
| **Domain Adapter Contract** | DomainAdapter + AdapterReply + TrustBand | `src/lib/nex/live-chat-completion/contract.ts` (527 lines) | **PRODUCTION** |
| **Accommodation Adapter** | Deterministic composer | `src/lib/nex/live-chat-completion/adapters/accommodation-adapter.ts` (~726 lines) | **PRODUCTION** · zero LLM |
| **Action Authorization** | 7-stage authorize + audit | `src/lib/nex/live-chat-completion/actions/authorize.ts` (229 lines) | **PRODUCTION** — Doctrine #2 |
| **Safety Guardrails** | Rate + moderation + PII | `src/lib/nex/live-chat-completion/safety/guardrails.ts` (198 lines) | **PRODUCTION** — Doctrine #2 |
| **Memory (Doctrine #4)** | Postgres store + PersonalizationContext | `src/lib/nex/live-chat-completion/memory/postgres-store.ts` | **PRODUCTION** |
| **Vision Extraction** | Provider + evidence mapper | `src/lib/nex/live-chat-completion/vision/` | **PRODUCTION** — Doctrine #3 |
| **File Extraction** | Provider + evidence mapper | `src/lib/nex/live-chat-completion/files/` | **PRODUCTION** — Doctrine #3 |
| **Immutable Audit Trail** | 3 append-only tables | `nex.action_audit` · `nex.moderation_event` · `nex.safety_audit_event` | **PRODUCTION** |
| **Semantic Intent Fallback (SI-1)** | Embedding lookup | `src/lib/nex/live-chat-completion/semantic/intent-semantic-index.ts` | **LIVE** (fallback only) |
| **Knowledge Inbox** | Dual-write ingest | `nex.knowledge_inbox` + Postgres shadow | **LIVE** (Phase 11.3 flip pending) |
| **Indonesia Walker Supervisor** | 2-layer supervision + heartbeat | `scripts/walkers/run-supervisor.mjs` + `run-outer-watchdog.mjs` | **LIVE** |
| **Conversation Brain** | State-store + turn-interpreter | `src/lib/nex/live-chat-completion/conversation-brain/` | **PRODUCTION** |
| **Live Chat Completion pipeline** | 10-system chat route | `src/app/api/nex-conv/chat/route.ts` (~3,177 lines · 30+ Founder BEGIN markers) | **PRODUCTION** |

**All four Founder Doctrines are enforced in production code** (verified by codebase audit):
- Doctrine #1 (LLM Rescue Never Bypasses Truth Engine) · `gate.ts` lines 35-100
- Doctrine #2 (LLM Never Executes Action Without NEX Authorization) · `authorize.ts` 7-stage pipeline
- Doctrine #3 (Vision + File Extraction Capped at evidence_provisional) · `vision/index.ts` + `files/index.ts`
- Doctrine #4 (Memory Informs Context · Memory Does NOT Establish Truth) · `gate.ts` defensive `memory:` reject + PersonalizationContext isolation

---

## 3 · What NEX is MISSING vs the Target · Confirmed Gaps

This is where honest gap analysis matters most. Each gap is a **build decision** the founder must own.

### GAP A · No first-class KNOWLEDGE BRAIN facade

**What's there:** Knowledge Factory tables, Truth Engine, Retrieval (semantic + hot-tier), Memory. All 4 pieces exist.
**What's missing:** A single `src/lib/nex/knowledge-brain/index.ts` that unifies them behind one contract:
```
KnowledgeBrain.answer(query, context) → Promise<AnsweredFact | HonestUnknown>
```
Right now every consumer wires the 4 pieces themselves. That is fine for one consumer (accommodation adapter) but doesn't scale to 10 domains.

**Severity:** MEDIUM. The pieces work today; the facade is refactor-level.

### GAP B · No RESEARCH BRAIN (Deep Research loop is not built)

**What's there:** Web acquisition scaffolding (`live-adapter-http-primary.ts`), research-engine.ts as spec, DuckDuckGo/Wikipedia mock adapter. Bounded per-turn web fetching wired to LLM rescue.
**What's missing:** The Deep Research loop that OpenAI/Gemini/Perplexity all ship:
```
plan → search → browse → cross-check → synthesise → cite → gap-signal
```
None of these workers exist end-to-end today:
- **Search Worker** (query decomposition + multi-source search)
- **Source Worker** (source-ranking + robots.txt + polite scraping)
- **Page Worker** (parse HTML/PDF/RSS into evidence)
- **Cross-check Worker** (multiple sources agree/disagree → conflict record)
- **Citation Worker** (bind each output claim to a source span — NOT just a URL)
- **Synthesis Worker** (compose the cited report)

**Severity:** HIGH. This is the single biggest gap between NEX today and "world-class AI on the internet". Deep Research is what makes ChatGPT/Gemini/Perplexity feel like a research analyst instead of a chatbot.

### GAP C · Fabrication Gate does NOT do claim-span alignment (only ref_id existence check)

**What's there:** `gate.ts` validates that every LLM claim.source_ref matches a ref_id in `bundle.items`. Orphan citations rejected.
**What's missing:** The 2026 hallucination survey ([arXiv 2510.24476](https://arxiv.org/pdf/2510.24476)) shows **citation-based metrics frequently fail to detect postrationalisation** — the LLM attaches a plausible-looking source that does not actually support the claim it makes. To reach world-class grounding NEX needs:
- A **claim-span alignment score** (NLI / entailment / semantic overlap) between each claim.text and the cited item.text
- A threshold below which the claim is downgraded to "supported-by evidence but weak-alignment · reply with caveat" or rejected outright

**Severity:** HIGH. This is the difference between "we cite" and "our citations mean something."

### GAP D · No BM25 + dense + rerank hybrid retrieval

**What's there:** SI-1 semantic index (deterministic char-trigrams + token hashing, 512-dim, no pgvector available).
**What's missing:** The 2026 industry consensus is **BM25 + dense + cross-encoder rerank** — three retrieval methods fused, with reranking giving the largest single quality lift documented ([Denser.ai 2026](https://denser.ai/blog/hybrid-search-for-rag/): "+17.2 pp MRR@3, +12.1 pp Recall@5"). NEX has none of these three primitives production-wired for its rescue path.
- **BM25 retriever** over `question_variant` + provenance text (Postgres full-text search is fine as a baseline)
- **Dense retriever** upgraded from the deterministic-hash shim to real neural embeddings once Ollama/local embedding model is available
- **Cross-encoder reranker** for the top-K candidates before they enter the bundle

**Severity:** HIGH for research-quality answers. MEDIUM for the deterministic accommodation path (which already achieves 99.4% no-LLM per the Composition Pilot n=354 result).

### GAP E · Memory has only ONE tier (semantic-ish); episodic + procedural missing

**What's there:** L2 long-term memory (Doctrine #4). `user_profile` + `user_memory` with categories preference/response_style/identity_soft/user_asserted_fact/correction/context.
**What's missing:** Industry standard is 3 long-term memory types ([Redis](https://redis.io/blog/long-term-memory-architectures-ai-agents/)):
- **Semantic memory** — timeless facts (NEX has this).
- **Episodic memory** — time-indexed events ("last time you asked about hotel X you booked Gaotama"). Missing.
- **Procedural memory** — learned procedures ("this user always follows a search with a distance filter"). Missing.

**Severity:** MEDIUM. Adds compounding value over time; not blocking today.

### GAP F · Multi-domain adapters do not exist (Food, Transport, Construction, Healthcare, Legal, Business, Travel)

**What's there:** Domain workers exist as event-emitting scaffolds. `DomainAdapter` contract is defined.
**What's missing:** Deterministic-composer + fact-computer + intent-parser + language-normaliser for each non-accommodation domain. Currently only accommodation has all four pieces production-wired.

**Severity:** HIGH for scale. Zero domains beyond accommodation can answer with deterministic composition today. Every non-accommodation query either falls back to legacy composer or to LLM rescue (which then can't cite anything domain-specific).

### GAP G · No ACTION BRAIN facade over registry / authorize / control-plane / MCP

**What's there:** `authorize.ts` seven-stage pipeline + `actions/registry.ts` + `agent-runtime/control-plane.ts` + `nex.action_audit` all live.
**What's missing:** A single `src/lib/nex/action-brain/index.ts` that exposes `ActionBrain.propose(spec) → ActionBrain.confirm(token) → ActionBrain.execute(...)` and — most importantly — **MCP server integration** so that external tools (booking APIs, WhatsApp gateway, payment providers) plug into NEX via the [Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) standard rather than bespoke wiring. OpenAI adopted MCP for Deep Research in 2026 ([the-decoder](https://the-decoder.com/openais-deep-research-now-runs-on-gpt-5-2-and-lets-users-search-specific-websites/)).

**Severity:** MEDIUM. Current tool ecosystem works but doesn't scale to third-party integrations.

### GAP H · No OBSERVATORY BRAIN

**What's there:** `nex.action_audit`, `nex.moderation_event`, `nex.safety_audit_event`, `nex.category_scorecard`, kf_worker_heartbeat, all present. Observability route at `/api/nex/deterministic-shadow/state`. Header-Off Observatory live.
**What's missing:** A brain-level facade that computes:
- Groundedness score per reply (Was every claim aligned to a cited span?)
- Fabrication-attempt rate (per hour · per user · per domain)
- Deep-research loop latency + cost per turn
- Doctrine-violation count (should be zero)
- Coverage % per domain (per Composition Pilot n=354 methodology)

**Severity:** MEDIUM. Data is captured; the executive dashboard is missing.

### GAP I · Master AI agent spawning is spec-only

**What's there:** `agent-factory.ts` (183 lines) produces `AgentSpecification` records. Delegation modules exist as stubs.
**What's missing:** Runtime agent spawning from spec. Currently agents are all pre-declared in `worker-*.ts`.

**Severity:** LOW-MEDIUM. Not blocking. Only needed if the founder wants NEX to auto-provision new agents at 10,000-domain scale — and per the research (P1 + Anthropic caution), that scale doesn't need auto-spawning; parameterised reusable workers do.

### GAP J · Reusable-worker discipline is inconsistent

**What's there:** heartbeat/event-bus/control-plane/watchdog are truly reusable (non-domain-scoped). `DomainAdapter` contract is domain-neutral.
**What's missing:** Many workers are named `worker-accommodation`, `worker-food`, etc. — domain-scoped by convention. Should be **capability-scoped** (`worker-freshness`, `worker-discovery`, `worker-verification`) with domain as a parameter, per the founder's own observation:
```
Verification Worker
   ├── Hotel
   ├── Restaurant
   ├── Construction
```
This is architecturally cleaner and matches all 5 vendor frameworks (P2).

**Severity:** MEDIUM. Refactor-level. Worth doing before adding 5+ more domains.

---

## 4 · The Brains NEX Must Build (and Why)

Ranked by priority. Every recommendation preserves all 4 Founder Doctrines.

### PRIORITY 1 · RESEARCH BRAIN (biggest gap · biggest quality lift)

Directory: `src/lib/nex/research-brain/`.

Workers (each is capability-scoped, not domain-scoped):
- `search-worker.ts` — decompose query · fan out to Wikipedia + DuckDuckGo Instant Answer + domain-specific sources
- `source-worker.ts` — source ranking (authority · freshness · robots.txt · rate-limit)
- `page-worker.ts` — HTML/PDF parse → structured evidence rows
- `cross-check-worker.ts` — reconcile ≥2 sources · emit conflict records
- `citation-worker.ts` — **claim-span alignment scoring** (this closes Gap C too)
- `synthesis-worker.ts` — compose the report · every sentence cited
- `research-brain/index.ts` — facade: `research(query, budget, depth) → CitedReport`

Doctrine enforcement:
- Every claim in the synthesised report carries a `source_ref` and passes the same Fabrication Gate as any LLM rescue output. **Doctrine #1 preserved.**
- The research brain proposes actions only via the Action Brain. **Doctrine #2 preserved.**
- Web-fetched evidence is capped at `evidence_provisional` — mirrors vision/file precedent. **Doctrine #3 extended to web.**
- User memory NEVER seeds a research claim as truth; only shapes what topics the user cares about (personalization signal). **Doctrine #4 preserved.**

Sources for this shape: [OpenAI Deep Research](https://openai.com/index/introducing-deep-research/) · [Gemini Deep Research](https://ai.google.dev/gemini-api/docs/interactions/deep-research) · [Perplexity architecture](https://www.langchain.com/breakoutagents/perplexity) · [Anthropic multi-agent research](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them).

### PRIORITY 2 · Fabrication Gate v2 · claim-span alignment

Directory: extend `src/lib/nex/live-chat-completion/llm-rescue/gate.ts`.

Add a scoring layer that, for every kept claim, computes an alignment score between `claim.text` and `bundle.items[cited].text` — e.g. token-overlap first (deterministic, zero cost), NLI-scored on Ollama when available. Below threshold → downgrade trust or reject with reason `postrationalisation_suspected`.

Source: [arXiv 2510.24476 · citation-based metrics fail to detect postrationalisation](https://arxiv.org/pdf/2510.24476).

### PRIORITY 3 · KNOWLEDGE BRAIN facade

Directory: `src/lib/nex/knowledge-brain/`.

Wraps existing KF + Truth Engine + Retrieval + Memory behind:
- `knowledge-brain/index.ts` — `answer(query, ctx) → AnsweredFact | HonestUnknown`
- `retrieval/hybrid-retriever.ts` — BM25 + dense + rerank fusion (Gap D)
- `memory/tiered-memory.ts` — semantic / episodic / procedural (Gap E)

The DomainAdapter contract stays exactly as-is. This facade is a **consumer of the same pieces**; it does not replace them.

### PRIORITY 4 · Reusable capability workers + Domain adapter templates

Directory: `src/lib/nex/workers/` (capability-scoped) + `src/lib/nex/live-chat-completion/adapters/*` (per domain, thin).

Rename or add:
- `workers/discovery-worker.ts` (currently accommodation-specific gap-engine → generalise)
- `workers/extraction-worker.ts` (currently vision + files → generalise)
- `workers/normalisation-worker.ts` (currently accommodation language-normaliser → generalise)
- `workers/dedup-worker.ts`
- `workers/entity-resolution-worker.ts` (currently accommodation fact-computer → generalise)
- `workers/verification-worker.ts` (extract Truth Engine methods to a worker)
- `workers/conflict-worker.ts`
- `workers/gap-worker.ts` (generalise)
- `workers/freshness-worker.ts` (currently worker-accommodation → generalise)
- `workers/index-worker.ts`

Each takes a `domain: string` parameter — one worker × N domains, per Founder assertion 5. **Note: assertion 5 is PARTIALLY SUPPORTED — scale-ceiling UNKNOWN — must be measured.**

Then thin per-domain adapters (`food-adapter.ts`, `transport-adapter.ts`, etc.) that compose the capability workers with domain-specific fact schemas.

### PRIORITY 5 · ACTION BRAIN facade + MCP tool servers

Directory: `src/lib/nex/action-brain/`.

- `action-brain/index.ts` — `propose(spec) · confirm(token) · execute(action)`
- `action-brain/mcp-server.ts` — expose NEX actions as MCP tools ([Anthropic MCP](https://www.anthropic.com/news/model-context-protocol)), so external agents (or NEX itself in a research role) can invoke them via a standard protocol.

### PRIORITY 6 · OBSERVATORY BRAIN

Directory: `src/lib/nex/observatory-brain/`.

Computes and surfaces:
- Groundedness rate · fabrication-attempt rate · doctrine-violation count (target zero)
- Coverage % per domain (using Composition Pilot n=354 methodology)
- Deep-research P50/P95 latency + cost per turn
- LLM-invocation rate (target < 5% per Composition Pilot verdict)

Single page: `/nex/observatory` (extension of Header-Off).

---

## 5 · Concrete Target File Structure

```
src/lib/nex/
├── brain/                                    # Main brain (existing)
│   └── orchestrate.ts                        # SPEAK BRAIN — canonical router
│
├── main-brain/                               # NEW · router of routers
│   ├── router.ts                             # Routes to Knowledge / Research / Action
│   └── manager.ts                            # Manager-pattern coordinator
│
├── knowledge-brain/                          # NEW · GAP A + D + E
│   ├── index.ts                              # answer() facade
│   ├── retrieval/
│   │   ├── hybrid-retriever.ts               # BM25 + dense + rerank (GAP D)
│   │   ├── bm25.ts
│   │   ├── dense.ts
│   │   └── reranker.ts
│   └── memory/
│       └── tiered-memory.ts                  # semantic / episodic / procedural (GAP E)
│
├── research-brain/                           # NEW · GAP B (highest impact)
│   ├── index.ts                              # research() facade
│   ├── plan-worker.ts                        # decompose objective
│   ├── search-worker.ts
│   ├── source-worker.ts
│   ├── page-worker.ts
│   ├── cross-check-worker.ts
│   ├── citation-worker.ts                    # claim-span alignment (GAP C partial)
│   └── synthesis-worker.ts
│
├── action-brain/                             # NEW · GAP G
│   ├── index.ts
│   ├── mcp-server.ts                         # MCP tool-server for NEX actions
│   ├── mcp-client.ts                         # NEX consuming external MCP servers
│   └── (existing authorize.ts + registry.ts + control-plane.ts moved under)
│
├── safety-brain/                             # NEW facade over existing
│   ├── index.ts
│   ├── guardrails/                           # (moved from live-chat-completion/safety)
│   └── audit/                                # (audit trail helpers)
│
├── observatory-brain/                        # NEW · GAP H
│   ├── index.ts
│   ├── groundedness.ts
│   ├── fabrication-rate.ts
│   ├── doctrine-monitor.ts                   # target zero violations
│   └── coverage.ts
│
├── workers/                                  # NEW · GAP J (capability-scoped)
│   ├── discovery-worker.ts
│   ├── extraction-worker.ts
│   ├── normalisation-worker.ts
│   ├── dedup-worker.ts
│   ├── entity-resolution-worker.ts
│   ├── verification-worker.ts
│   ├── conflict-worker.ts
│   ├── gap-worker.ts
│   ├── freshness-worker.ts
│   └── index-worker.ts
│
├── live-chat-completion/                     # EXISTING · unchanged interfaces
│   ├── contract.ts                           # DomainAdapter (stays)
│   ├── adapters/
│   │   ├── accommodation-adapter.ts          # PRODUCTION (stays)
│   │   ├── food-adapter.ts                   # NEW · thin (uses capability workers)
│   │   ├── transport-adapter.ts              # NEW · thin
│   │   ├── construction-adapter.ts           # NEW · thin
│   │   ├── healthcare-adapter.ts             # NEW · thin
│   │   ├── legal-adapter.ts                  # NEW · thin
│   │   ├── business-adapter.ts               # NEW · thin
│   │   └── travel-adapter.ts                 # NEW · thin
│   ├── llm-rescue/
│   │   └── gate.ts                           # v2 · claim-span alignment (GAP C)
│   ├── truth-engine/
│   ├── conversation-brain/
│   ├── vision/
│   ├── files/
│   └── memory/
│
└── (existing) master-ai / agent-runtime / knowledge-factory / intelligence-storage-grid / semantic /
```

Nothing above breaks existing production paths. Every new brain is an **additive facade** over pieces that already ship.

---

## 6 · Scale Verdict — Can NEX Reach "World-Class"?

**YES, with two conditions.**

### Condition 1 · Fabrication Gate v2 (claim-span alignment) must ship

Because [arXiv 2510.24476](https://arxiv.org/pdf/2510.24476) documents that current-generation citation checking misses postrationalisation, NEX's current ref_id-existence check is **necessary but not sufficient** to reach world-class grounding. Building Gap C is non-negotiable for the "highest standards possible" bar the founder set.

### Condition 2 · Research Brain must ship

Deep Research is what makes ChatGPT/Gemini/Perplexity qualitatively different from a chatbot. The founder's target diagram already knows this. Without a real Deep Research loop NEX can only answer what the accommodation adapter already knows deterministically — that is world-class for the Yogyakarta accommodation corpus (99.4% no-LLM per Composition Pilot n=354) but not world-class for open questions.

### Anthropic's cost warning applies

**Multi-agent = ~15× the tokens of normal chat** ([Claude blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)). NEX's existing "Postgres avoided 99.4% · LLM invoked 0.6%" measurement is exactly the discipline that makes multi-agent economics viable — the manager-pattern only fires for hard queries. Keep the composition-first principle; the Research Brain fires **only when the accommodation adapter (or successor) honestly UNKNOWNs the answer**.

### Fan-out ceiling

[Beam.ai 2026](https://beam.ai/agentic-insights/multi-agent-orchestration-patterns-production) reports **≤10 workers per hierarchy level for sub-second selection.** NEX's proposed shape has 3 brains × ~7 workers each = 21 workers total in 2 hierarchy levels. Well inside the ceiling.

### 10 → 10,000 domain expansion

**UNKNOWN from public sources.** No vendor publishes this at that scale. But the capability-scoped worker design (Priority 4) — worker × domain-parameter — is the only known-to-work approach and matches all 5 vendor frameworks. NEX must **measure coverage per new domain added** rather than assume linearity.

---

## 7 · Doctrine Reconciliation

Every recommendation preserves all 4 founder doctrines:

| Recommendation | Doctrine #1 | #2 | #3 | #4 |
|---|---|---|---|---|
| Research Brain | Every claim passes Fabrication Gate | Actions only via Action Brain | Web evidence capped at evidence_provisional | Memory shapes topics, not facts |
| Gate v2 alignment | Strengthens Doctrine #1 | — | — | — |
| Knowledge Brain facade | Composes Truth Engine | — | — | Memory tier stays out of evidence array |
| Hybrid retrieval | Feeds Truth Engine | — | — | — |
| Tiered memory | — | — | — | Still all-personalisation-context; never EvidenceItem |
| Action Brain facade | — | Wraps existing authorize.ts | — | — |
| MCP tool servers | External tool output goes through Fabrication Gate | External tool actions go through Action Brain | External tool evidence capped at provisional | — |
| Observatory Brain | Measures Fabrication Gate | Measures Action authorization | Measures extraction trust | Measures memory-cite rejects |

**Doctrine violations remain the ship-blocking signal.** Every brain reports doctrine-violation counts to the Observatory Brain; production traffic is halted if any doctrine violation is observed.

---

## 8 · What to Build First · Founder-Owned Decision

Two paths, honestly framed:

### Path A · "Highest standards first" (recommended · matches founder's bar)

1. **Fabrication Gate v2 · claim-span alignment** (Priority 2 · ~2-3 days)
2. **Research Brain** (Priority 1 · ~1-2 weeks · foundational for open questions)
3. **Knowledge Brain facade + hybrid retrieval** (Priority 3 · ~1 week)
4. Then multi-domain adapters (Priority 4 domain by domain)

Rationale: quality-first. Every new domain built after step 3 benefits from stronger grounding + hybrid retrieval. Slower time-to-second-domain but higher ceiling.

### Path B · "Coverage first" (alternative · matches Scale-1 mandate)

1. **Reusable capability workers** (Priority 4 · ~1 week)
2. **Food + Transport thin adapters** (Priority 4 continued · ~3-5 days each)
3. Then Fabrication Gate v2 + Research Brain

Rationale: get to 3-4 live domains before the quality-lift work. Faster to visible coverage but lower ceiling per domain.

**Both paths preserve every existing production system unchanged.** Nothing NEX ships today is at risk from either sequence.

---

## 9 · Honest UNKNOWNs

Per founder mandate on truth-only reporting:

- **10,000-domain scale precedent** — no vendor publishes it. NEX assertion 5 is architecturally sound but scale-untested.
- **Optimal claim-span alignment threshold** — depends on domain + retriever quality. Must be measured, not guessed.
- **Cost of Research Brain per turn at Indonesian traffic volume** — the 15× multi-agent multiplier is Anthropic's number; NEX-specific number is UNKNOWN.
- **Inline vs post-hoc citation quality trade-off** — Anthropic and Perplexity disagree; no public head-to-head benchmark exists.
- **Domain ceiling per capability worker** — architecturally reasonable to say "unlimited" but empirically UNKNOWN.

Every UNKNOWN above becomes a measurable question once the corresponding brain ships. The Observatory Brain's job is to close them.

---

## 10 · Bottom Line

**The founder's proposed architecture is right.** It matches convergent industry practice across five vendors.

**NEX already has ~60% of it in production:** Main Brain, Fabrication Gate v1, Truth Engine, Action authorization, Safety guardrails, Memory (Doctrine #4), Immutable audit, Accommodation adapter, Vision + File extraction, Walker supervisor, Semantic fallback, Domain-neutral contract.

**The 40% missing is dominated by:**
1. Research Brain (Deep Research loop) — biggest capability gap
2. Fabrication Gate v2 (claim-span alignment) — biggest quality gap
3. Non-accommodation domain adapters — biggest coverage gap
4. Hybrid retrieval (BM25 + dense + rerank) — biggest retrieval-quality gap

**No existing NEX system needs to be replaced or unwound.** Every recommended brain is an additive facade or a strengthening of existing subsystems. All 4 Founder Doctrines are preserved by construction.

**Scale readiness** is architecturally sound to 3-4 brains × ~7 workers each (well under the 10-per-level ceiling documented by production frameworks). Beyond 10,000 domains no vendor has published a proof point — NEX will be inventing that answer. But the capability-scoped worker design is the only known approach and matches every framework surveyed.

The founder's own composition-first, "LLM only when necessary" philosophy is exactly what makes multi-agent economics viable at scale — Anthropic's cost warning applies to everyone, and NEX is the one project where the discipline is already baked in.

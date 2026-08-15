# ADR-0044 · Conversational Learning Pipeline

**Status:** Accepted · Immutable
**Date:** 2026-08-15
**Author:** Philip O'Farrell (brief) · Claude (drafting)
**Type:** System architecture (defines how NEX scales the conversational-intelligence layer across large datasets)
**Extends:** ADR-0027 · ADR-0028 · ADR-0029 · ADR-0030 · ADR-0033 · ADR-0034
**Referenced by:** `data/nex-reference-brains/staircase-preparation/conversational-intelligence/`

---

## The rule (HARD LAW)

> **NEX does not learn by blindly generating new knowledge from conversations. It learns by measuring which existing knowledge relationships, conversational transitions, retrieval paths and responses produce successful outcomes.**

> **The graphs store relationships. The conversation state determines which relationships matter right now.**

Every ingested relationship carries a confidence score. Every conversation transition carries an evidence count. Every response is evaluated against an outcome signal. Nothing enters the live conversation graph without passing the quality gate (ADR-0033).

---

## Why this ADR exists

The Conversational Intelligence layer at `data/nex-reference-brains/staircase-preparation/conversational-intelligence/` (README manifesto + 21 supporting docs) defines **what a good NEX conversation looks like** — progressive understanding, three confidence tiers, six-step reasoning hierarchy, per-session state model, intent taxonomy, follow-up patterns, uncertainty language.

Those docs describe the reasoning layer. They do not describe:

- **How** knowledge gets ingested from large volumes of Q&A + conversation data.
- **How** questions link to their likely follow-ups, clarifications and corrections.
- **How** NEX retrieves the right knowledge in <100ms without loading the whole dataset.
- **How** conversation outcomes feed back into ranking so NEX gets better over time.
- **How** we measure whether it *is* getting better.

Without this ADR, the conversational-intelligence layer sits on top of an unspecified data substrate, which risks two failure modes:

1. **Silent divergence:** each new brain builds its own bespoke retrieval + state store, and cross-brain reasoning becomes impossible.
2. **Amplifying error:** a bad conversation gets ingested as knowledge, retrieved in a future conversation, produces more bad conversations, and the feedback loop reinforces the error. Philip's phrasing: *"bad conversation → ingested as knowledge → used in future conversation → more bad conversations → feedback loop amplifies the error."*

This ADR closes both. It defines the scaling engine underneath the reasoning layer, and it names the guarantees that stop the amplification failure.

---

## The decision (LOCKED)

NEX ships a single conversational-learning pipeline with the following properties:

### 1 · Storage
- **Postgres + pgvector** on the NEX Supabase project.
- Seven tables prefixed `nex_conv_*`: `knowledge_items` · `entities` · `intents` · `edges` · `states` · `turns` · `outcomes` · `feedback` (schema is authoritative in migration `050_nex_conv_learning_pipeline_schema.sql`).
- All access via `supabaseNexAdmin` per the Supabase Client Routing rule.

### 2 · Two graphs, cross-linked
- **Brain Knowledge Graph** — domain ontology (Staircase → Oak / Walnut / Balusters / Handrails / Building Regs / Installation / Pricing / Delivery). Curated, authoritative, slow-changing.
- **Conversation Graph** — how customers actually move through the ontology. Twelve typed edges (`answers`, `clarifies`, `follows_from`, `corrects`, `contradicts`, `elaborates`, `alternative_of`, `comparison_to`, `prices`, `requires`, `recommends`, `related_to`). Learned from observed conversations, weighted by outcome.
- **Cross-link** — every knowledge-item entity is a key into the Brain Knowledge Graph. Customer journeys become walks over the domain ontology.

### 3 · Local-first embedding + hybrid retrieval
- **Local embedding model** — `bge-small-en-v1.5` (384-dim) via `@xenova/transformers`. Zero API, zero quota. Per Core-Dependency Rule.
- **Hybrid retrieval** — semantic (pgvector) + entity-array (GIN) + graph-walk (recursive CTE). Merged, reranked, top-K=8. Retrieval budget 60ms.

### 4 · State-driven inference
- Per-session `nex_conv_states` row holds structured JSON (topic stack, established facts with provenance, requirements, decisions, entities in focus, unresolved ambiguities, overall confidence, stage). Extends `conversation-intelligence/conversation-state-model.md` into a stored row.
- Every turn NEX reads state → retrieves → generates → updates state. Full transcripts never re-enter the prompt.
- Corrections REPLACE facts and preserve the old value in audit columns. Never silently overwrite.

### 5 · Quality gates (mirror ADR-0033)
- Item confidence ≥0.85 → auto-surface · 0.70-0.84 → surface hedged · 0.50-0.69 → draft-only · <0.50 → reject.
- Edge weight ≥0.85 → strong · 0.70-0.84 → candidate · <0.70 → graph link only.
- Every ingestion pass runs dry-run first, produces a before/after report, requires owner sign-off before promoting to live.

### 6 · Feedback → re-ranking, not knowledge generation
- Signals collected per turn (explicit thumbs, implicit repeat-question, end-of-conversation outcome).
- Nightly job re-computes edge weights: `new_weight = old_weight * 0.9 + 0.1 * outcome_lift`.
- Edges consistently followed by corrections or abandonment decay. Edges consistently followed by resolved outcomes reinforce.
- **CRITICAL:** feedback re-ranks EXISTING knowledge. It does NOT auto-generate new knowledge into the graph. New knowledge only enters via the ingestion pipeline with quality gates.

### 7 · Brain isolation preserved (ADR-0033 rule #4)
- Every knowledge item has exactly one `brain` value.
- Edges do not cross brains without explicit admin review.
- Staircase-brain items never enter kitchen-brain retrieval.

### 8 · Measurement
- 10 KPIs on rolling 7-day windows: task-completion rate · clarification ratio · repeat-question rate · correction rate · context-drop rate · follow-up naturalness (sample audit) · retrieval precision@8 · average confidence · abandonment rate · escalation rate.
- Observed numbers only — never predicted from small samples (Data-Identity + No-Hardcoded-Counts rule).
- Owner-visible subset surfaces in NEX Assist: Context retention · Follow-up relevance · Retrieval confidence · Conversation completion · Correction rate · Repeated-question rate · Knowledge growth.
- Admin-only engineering diagnostics: graph edges · embedding diagnostics · ingestion errors · reranking data · edge weight distributions.

---

## The full architecture (Philip's diagram · locked)

```
                    RAW DATA
                       │
                       ▼
                 INGESTION
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
       KNOWLEDGE GRAPH     CONVERSATION GRAPH
             │                   │
             └─────────┬─────────┘
                       ▼
                RETRIEVAL ENGINE
                       │
                       ▼
                CONVERSATION STATE
                       │
                       ▼
                   NEX BRAIN
                       │
                       ▼
                  USER RESPONSE
                       │
                       ▼
                    OUTCOME
                       │
                       ▼
                  FEEDBACK LOOP
                       │
                       ▼
              RE-SCORE / VALIDATE
                       │
                       ▼
                 DRAFT → LIVE
```

Full stage detail lives in the proposal at `data/nex-reference-brains/staircase-preparation/conversational-intelligence/nex-conversation-learning-pipeline-architecture-2026-08-15.md`.

---

## Pilot scope (LOCKED)

- **Pilot brain:** staircase brain only. Same laboratory Philip used for the conversational-intelligence pilot. Once the engine proves out on staircase, the same infrastructure serves every future brain (kitchen · bathroom · doors · flooring · etc.).
- **MVP dataset:** existing 22 conversational-intelligence docs + staircase brain reference batches (including the 2026-08-15 string-types batch and the multi-batch analysed set) + real NEX staircase conversations where available.
- **NOT in MVP:** external Q&A imports. Later ingestion source once the closed-dataset pipeline is proven.

---

## Timing (LOCKED)

- **Now:** ADR-0044 (this doc), schema migration `050_nex_conv_learning_pipeline_schema.sql`, refined architecture proposal doc, cross-reference from conversational-intelligence README. Architecture is frozen.
- **Queued behind MT-1:** ingestion code · live inference wiring · admin review UI · owner-visible metrics panel. Do not start until the Master Template 1 landing-page lock releases (`project_nex_mt1_landing_only_lock_2026_08_14.md`).
- **After MT-1 releases:** MVP (weeks 1-2) → v1 (weeks 3-6) → v2 later. Each phase Philip-gated.

---

## The relationship between the docs (LOCKED)

| Layer                                                                             | Purpose                                                                              |
|-----------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| **Conversational Intelligence docs** (`conversational-intelligence/`)             | Define what NEX believes a good conversation IS.                                     |
| **ADR-0044** (this doc)                                                           | Define HOW NEX scales that intelligence across large amounts of data.                |
| **Architecture proposal** (`nex-conversation-learning-pipeline-architecture-*`)   | Concrete implementation detail: DDL, formulas, pipeline stages, live inference loop. |
| **Migration `050_nex_conv_*`**                                                    | Physical schema — the frozen storage substrate.                                      |
| **Conversation Graph + Brain Knowledge Graph**                                    | The runtime infrastructure that the above layers depend on.                          |

Reasoning layer + scaling layer + infrastructure layer. One source of truth per layer. No competing definitions.

---

## Consequences

### Positive

- Conversational-intelligence work now has a durable data substrate — no more per-brain bespoke stores.
- Every claim NEX makes is traceable to a scored knowledge item with provenance.
- Feedback flows back into ranking automatically; the system gets better as owners use it.
- Millions of records ingestible without touching the model context size.
- Cross-brain reasoning becomes possible in v2 without redesign.

### Negative / accepted trade-offs

- Pgvector on a shared Postgres has a soft ceiling around tens of millions of rows before an index rebuild is needed. Acceptable for the horizon of the pilot and v1; v2 revisits if warranted by observed volume.
- Local embedding model (bge-small) trades off ~2-3% retrieval quality vs a hosted large model. Aligns with Core-Dependency Rule; if observed retrieval precision drops below the KPI floor, contrastive fine-tune (also local) is the escape hatch.
- Owner-facing metrics create a support surface — owners will ask why numbers moved. Documentation and telemetry are v1 deliverables not optional.

### What this ADR PREVENTS

- The amplifying-error failure mode (bad conversation → ingested → reinforced). Prevented by: quality gate, draft-only tier, feedback re-ranks EXISTING knowledge only, ingestion is the ONLY path for new knowledge.
- Per-brain silo of retrieval + state. Prevented by: one canonical schema, one canonical inference pipeline.
- Silent state overwrites. Prevented by: corrections REPLACE facts and preserve old values in audit columns.
- Cross-brain contamination. Prevented by: mandatory `brain` field on every item + admin gate on any cross-brain edge.
- Fabricated relationships. Prevented by: every edge has evidence_count ≥1, edges below threshold get graph-linked but not surfaced.

---

## What this ADR must not become

- A licence to skip the quality gate on ingestion.
- A shortcut around brain isolation (ADR-0033 rule #4).
- A justification for a hosted-SaaS shortcut anywhere in the pipeline path (Core-Dependency Rule).
- A reason to defer MT-1 work. Implementation is queued behind MT-1 for a reason.
- A parallel feature that destabilises the landing-page lock.

---

## Cross-references

- **Full architecture proposal:** `data/nex-reference-brains/staircase-preparation/conversational-intelligence/nex-conversation-learning-pipeline-architecture-2026-08-15.md`
- **Schema migration:** `deploy/postgres/init/050_nex_conv_learning_pipeline_schema.sql`
- **Reasoning layer manifesto:** `data/nex-reference-brains/staircase-preparation/conversational-intelligence/README.md`
- **Related ADRs:** ADR-0027 (golden rules) · ADR-0028 (intelligence constitution) · ADR-0029 (tagger directive) · ADR-0030 (intelligence layers before admin) · ADR-0033 (quality-over-quantity + brain isolation) · ADR-0034 (knowledge engine + gold standard)
- **Related standing memories:** Core Dependency Rule · Brain Confidence Rule · Data Identity + No-Hardcoded-Counts · Supabase Client Routing · Storage Boundary Rule · Master Template 1 Landing-Only Lock

---

*End of ADR-0044.*

---
title: NEX Conversation-Learning Pipeline · Concrete Architecture Proposal
provenance: philip-brief-2026-08-15 · claude-drafted-2026-08-15 · philip-approved-2026-08-15
brain: staircase_brain (pilot · engine generalises to future brains)
status: ACCEPTED as ADR-0044 · implementation queued behind MT-1 landing-page lock
canonical_decision: docs/DECISIONS/0044-conversational-learning-pipeline.md
schema_migration: deploy/postgres/init/050_nex_conv_learning_pipeline_schema.sql
supersedes: nothing (extends existing conversational-intelligence layer)
relationship:
  extends:
    - conversational-intelligence/README.md (framework manifesto v1.0-pilot)
    - conversational-intelligence/conversation-state-model.md (per-session state object)
    - conversational-intelligence/intent-patterns.md (intent taxonomy)
    - conversational-intelligence/follow-up-questions.md
  enforces:
    - CLAUDE.md · NEX Intelligence Constitution (ADR-0028)
    - CLAUDE.md · Quality-Over-Quantity + Brain Isolation (ADR-0033)
    - project_nex_core_dependency_rule_2026_08_14.md (local-first, no external QA SaaS)
    - project_nex_brain_confidence_rule_2026_08_13.md (80-point auto-review gate)
principle_summary:
  - Local-first · Postgres + pgvector · no third-party hosted AI in the pipeline path
  - Ingest transforms independent knowledge into CONVERSATIONAL EXPERIENCE — never a giant prompt
  - Every relationship carries a confidence score · low-confidence goes to review not to inference
  - Brain isolation preserved · edges do not cross brains without explicit review
  - Millions of records processable without ever loading all of them into a model context
---

# NEX Conversation-Learning Pipeline · Architecture

Philip's brief (2026-08-15): design a pipeline that turns very large volumes of Q&A + conversation data into structured *conversational experience* — so NEX responds naturally across turns like a human assistant. Not concatenate. Not a giant prompt.

Philip's refined objective (2026-08-15):

> **NEX does not learn by blindly generating new knowledge from conversations. It learns by measuring which existing knowledge relationships, conversational transitions, retrieval paths and responses produce successful outcomes.**

That precision matters. It protects against the amplifying-error failure mode: *bad conversation → ingested as knowledge → used in future conversation → more bad conversations → feedback loop amplifies the error.* Feedback in this system RE-RANKS existing knowledge. It does NOT auto-generate new knowledge. New knowledge only enters via the ingestion pipeline, gated by ADR-0033.

Philip's core architectural rule (2026-08-15):

> **The graphs store relationships. The conversation state determines which relationships matter right now.**

That rule is what stops NEX from becoming a giant database search engine and starts making it behave like a system that understands where the conversation currently is.

---

## Full-system architecture (Philip's diagram · locked)

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

- **Raw data → Ingestion:** §6.
- **Knowledge Graph + Conversation Graph:** §11 explains the two-graph model. Storage in §2.
- **Retrieval Engine:** §4. Hybrid semantic + entity + graph-walk.
- **Conversation State:** §5. Structured JSON per session; read every turn, updated every turn.
- **NEX Brain → User Response:** §7 live inference loop.
- **Outcome → Feedback Loop → Re-score → Draft-→-Live:** §9. Feedback re-ranks existing knowledge; ingestion is the only new-knowledge path.

This doc is the concrete implementation detail behind the decision. The decision itself is ADR-0044.

---

## 0 · What already exists (so this extends and does not duplicate)

The **NEX Conversational Intelligence layer** (v1.0-pilot at `data/nex-reference-brains/staircase-preparation/conversational-intelligence/`) already covers:

| Existing artefact                              | What it defines                                                                 |
|-----------------------------------------------|---------------------------------------------------------------------------------|
| `README.md` (manifesto)                        | Progressive understanding pipeline · three confidence tiers · six-step reasoning |
| `conversation-state-model.md`                  | Per-session state object (topic stack · established facts · pending questions) |
| `intent-patterns.md` (772 lines)               | Intent taxonomy · Clear / Likely / Ambiguous classification                     |
| `follow-up-questions.md`                       | Common follow-up shapes                                                          |
| `linguistic-doors.md`                          | Customer language → domain concept mapping                                       |
| `cross-topic-intent-recognition.md`            | When intents span multiple topics                                                |
| `compound-request-decomposition.md`            | Breaking one message into multiple intents                                       |
| `frustration-recovery-patterns.md`             | What to do when the customer is frustrated                                      |
| `customer-says-it-wrong.md`                    | Handling incorrect terminology                                                  |
| `knowledge-gap-register.md`                    | What NEX admits it doesn't know                                                 |
| `recommendation-voice.md` / `uncertainty-language.md` | Tone rules                                                             |

Those docs describe **how NEX reasons and speaks**. What they do NOT describe is:

- The **data layer** that stores the knowledge those docs consume.
- The **graph** that links questions to their likely follow-ups, corrections and elaborations.
- The **retrieval** system that returns the right knowledge in <100ms.
- The **ingestion pipeline** that turns raw Q&A records into that graph.
- The **feedback loop** that lets NEX get better at conversation over time.
- The **measurement framework** that lets us tell whether it is getting better.

This document specifies all of the above.

---

## 1 · Design principles (LOCKED before we build anything)

1. **Local-first.** All processing (embedding, classification, retrieval, ranking) runs on NEX-owned infrastructure. No third-party hosted AI or QA SaaS in the pipeline path. Aligns with `project_nex_core_dependency_rule_2026_08_14.md`. External LLMs may be called for the *final response generation* but never for pipeline-level data enrichment.
2. **Never a giant prompt.** The trained artefact is a queryable graph + vector index. At inference time NEX retrieves a small relevant subset — never loads the whole dataset.
3. **Every relationship scored, gated, and auditable.** Threshold ≥85 auto-link; 70-84 draft; <70 review. Mirrors the existing 80-point rule for brain rows (Confidence Rule 2026-08-13) and the Quality-Over-Quantity ADR-0033.
4. **Brain isolation preserved.** Edges do not cross brains (`staircase_brain` ↔ `kitchen_brain`) without explicit human sign-off. ADR-0033 rule #4.
5. **Never fabricate.** Missing stays missing. A conversation transition that cannot be sourced from observed data does not exist in the graph. ADR-0028 rule #6.
6. **State-driven, not history-driven.** NEX reads and updates a structured state object each turn. It does not stuff the whole transcript back into the model.
7. **Every ingestion pass is reproducible.** Dry-run first, before/after report, per-record log, admin sign-off. Aligns with `project_nex_record_state_model_2026_08_14.md`.
8. **Growth-friendly.** The architecture must survive scaling from 1,000 to 5,000,000 records without redesign.

---

## 2 · Storage layer (Postgres + pgvector · runs inside NEX Storage)

All tables prefixed `nex_conv_`. All queries flow through `supabaseNexAdmin` per the Supabase Client Routing rule (`project_nex_supabase_client_routing_2026_08_13.md`).

### 2.1 · Core tables (DDL)

```sql
-- Enable pgvector on the NEX project once
CREATE EXTENSION IF NOT EXISTS vector;

-- A KNOWLEDGE ITEM is one atomic Q+A (or an authoritative statement).
-- One item = one node in the conversation graph.
CREATE TABLE nex_conv_knowledge_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brain             TEXT NOT NULL,               -- e.g. 'staircase_brain' · brain isolation
    source_batch      TEXT NOT NULL,               -- provenance
    source_ref        TEXT,                        -- URL / file / conversation id
    kind              TEXT NOT NULL CHECK (kind IN
                        ('qa_pair','statement','clarification','correction','recommendation')),
    question_text     TEXT,
    answer_text       TEXT,
    canonical_intent  TEXT NOT NULL,               -- FK to nex_conv_intents.slug
    entities          TEXT[] NOT NULL DEFAULT '{}',-- normalised entity slugs
    topics            TEXT[] NOT NULL DEFAULT '{}',-- normalised topic slugs
    confidence        NUMERIC(4,3) NOT NULL,       -- 0.000 - 1.000
    draft_only        BOOLEAN NOT NULL DEFAULT false, -- ADR-0033 gate
    embedding         VECTOR(384),                 -- local model (see §4)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON nex_conv_knowledge_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);
CREATE INDEX ON nex_conv_knowledge_items (brain);
CREATE INDEX ON nex_conv_knowledge_items USING gin (entities);
CREATE INDEX ON nex_conv_knowledge_items USING gin (topics);
CREATE INDEX ON nex_conv_knowledge_items (canonical_intent);

-- ENTITIES = the atoms the conversation graph nav-hops across.
-- e.g. "oak", "glass_balustrade", "installation", "planning_permission"
CREATE TABLE nex_conv_entities (
    slug              TEXT PRIMARY KEY,
    display_name      TEXT NOT NULL,
    brain             TEXT NOT NULL,               -- brain isolation
    entity_class      TEXT NOT NULL CHECK (entity_class IN
                        ('material','component','style','regulation','service',
                         'price_dimension','person','company','process','location','other')),
    aliases           TEXT[] NOT NULL DEFAULT '{}',
    embedding         VECTOR(384)
);
CREATE INDEX ON nex_conv_entities (brain);

-- INTENTS = canonical user goals. See intent-patterns.md for the taxonomy.
CREATE TABLE nex_conv_intents (
    slug              TEXT PRIMARY KEY,
    display_name      TEXT NOT NULL,
    class             TEXT NOT NULL CHECK (class IN
                        ('discover','specify','compare','price','decide','clarify',
                         'correct','object','confirm','revisit','close')),
    example_phrases   TEXT[] NOT NULL DEFAULT '{}'
);

-- EDGES = the conversation graph itself. Typed transitions.
CREATE TABLE nex_conv_edges (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_item         UUID NOT NULL REFERENCES nex_conv_knowledge_items(id) ON DELETE CASCADE,
    to_item           UUID NOT NULL REFERENCES nex_conv_knowledge_items(id) ON DELETE CASCADE,
    edge_type         TEXT NOT NULL CHECK (edge_type IN
                        ('answers','clarifies','follows_from','corrects','contradicts',
                         'elaborates','alternative_of','comparison_to','prices',
                         'requires','recommends','warns_about','related_to')),
    weight            NUMERIC(4,3) NOT NULL,       -- 0.000 - 1.000
    evidence_count    INTEGER NOT NULL DEFAULT 1,  -- observed occurrences
    last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (from_item, to_item, edge_type)
);
CREATE INDEX ON nex_conv_edges (from_item, edge_type);
CREATE INDEX ON nex_conv_edges (to_item, edge_type);

-- CONVERSATION STATE = per-session snapshot NEX reads/writes each turn.
-- Extends conversation-state-model.md into a real row.
CREATE TABLE nex_conv_states (
    conversation_id   UUID PRIMARY KEY,
    business_id       UUID,                        -- Customer/Owner Standard scope
    brain             TEXT NOT NULL,
    state             JSONB NOT NULL,              -- see §6 for schema
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON nex_conv_states USING gin (state jsonb_path_ops);

-- TURNS = append-only log of every user + NEX message.
CREATE TABLE nex_conv_turns (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id   UUID NOT NULL,
    turn_index        INTEGER NOT NULL,
    speaker           TEXT NOT NULL CHECK (speaker IN ('customer','owner','nex')),
    text              TEXT NOT NULL,
    detected_intent   TEXT,                        -- FK slug
    detected_entities TEXT[] NOT NULL DEFAULT '{}',
    used_item_ids     UUID[] NOT NULL DEFAULT '{}',-- knowledge items retrieved
    walked_edge_ids   UUID[] NOT NULL DEFAULT '{}',-- edges traversed
    latency_ms        INTEGER,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, turn_index)
);
CREATE INDEX ON nex_conv_turns (conversation_id, turn_index);

-- OUTCOMES = did this conversation reach a good end?
CREATE TABLE nex_conv_outcomes (
    conversation_id   UUID PRIMARY KEY,
    outcome           TEXT NOT NULL CHECK (outcome IN
                        ('resolved','clarification_completed','correction_received',
                         'user_abandoned','repeated_question','escalated','pending')),
    outcome_note      TEXT,
    labelled_by       TEXT NOT NULL CHECK (labelled_by IN ('auto','owner','admin')),
    labelled_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FEEDBACK SIGNALS = fine-grained per-turn signals that feed the learning loop.
CREATE TABLE nex_conv_feedback (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turn_id           UUID NOT NULL REFERENCES nex_conv_turns(id) ON DELETE CASCADE,
    signal            TEXT NOT NULL CHECK (signal IN
                        ('helpful','not_helpful','irrelevant','wrong','clarified','corrected',
                         'gave_up','followed_recommendation','asked_same_again')),
    source            TEXT NOT NULL CHECK (source IN ('explicit','implicit_next_turn','labelled')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON nex_conv_feedback (turn_id);
```

### 2.2 · Why Postgres + pgvector rather than a separate vector DB

- **Local-first.** Runs in NEX Storage (Postgres) — no Pinecone/Weaviate/Qdrant SaaS dependency. Reinforces `project_nex_core_dependency_rule_2026_08_14.md`.
- **Transactional joins.** Retrieval combines semantic (vector), entity (GIN array), and graph-walk (recursive CTE) in one query. Separate vector DBs force distributed joins.
- **One backup domain.** Everything is on the NEX Supabase project already governed by the Supabase Client Routing rule.
- **Proven at scale.** pgvector handles tens of millions of rows on standard Postgres hardware with ivfflat indexing.

---

## 3 · Conversation graph structure

Nodes are `nex_conv_knowledge_items`. Edges are `nex_conv_edges`. Twelve typed edges cover the observed conversational moves:

| edge_type       | Meaning                                                                       | Typical trigger during extraction                                    |
|-----------------|-------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| `answers`       | Item B is a direct answer to item A's question                                | Same source conversation, A is question turn, B is next NEX turn      |
| `clarifies`     | B is a clarification NEX asked in response to A's ambiguous message           | B is a `clarification` kind and follows A within one turn             |
| `follows_from`  | Users commonly move from A to B within a conversation                         | Co-occurrence ≥3 in observed conversations, same session              |
| `corrects`      | B is a correction of A ("no, I meant walnut")                                 | Explicit negation cues + entity swap                                  |
| `contradicts`   | A and B give incompatible answers to the same question                        | Two `answers` edges to the same question with divergent entities      |
| `elaborates`    | B goes deeper on the same topic A introduced                                  | Same topic slugs, B has more entities than A                          |
| `alternative_of`| B is an alternative option to A ("or you could go glass instead")             | Same category, mutually exclusive entities                            |
| `comparison_to` | B compares A to another option                                                | Presence of comparison intent + two entity references                 |
| `prices`        | B provides pricing for A                                                      | Intent `price` targeting A's entities                                 |
| `requires`      | A requires B (e.g. installation requires access measurements)                 | Domain rule extraction                                                |
| `recommends`    | B is what NEX commonly recommends when A is discussed                         | Positive-outcome co-occurrence                                        |
| `related_to`    | Catch-all weak relatedness                                                    | Semantic similarity ≥0.7 but no stronger relationship                 |

**Edge weight formula:**

```
weight = 0.40 * semantic_similarity
       + 0.25 * entity_overlap_jaccard
       + 0.20 * intent_compatibility
       + 0.10 * evidence_count_normalised
       + 0.05 * outcome_bias    (see §10 · positive outcomes boost weight)
```

Weight range 0.000–1.000. Weight ≥0.85 = strong (auto-surfaced). 0.70–0.84 = candidate (surfaced but hedged). <0.70 = graph link only, not surfaced.

---

## 4 · Embedding + retrieval strategy

### 4.1 · Local embedding model

- **Primary:** `bge-small-en-v1.5` (384-dim, ~130MB, MIT-licence). Run via `@xenova/transformers` inside a Node worker — zero API cost, zero external dependency, runs on CPU comfortably at ~10ms per sentence.
- **Fallback:** `all-MiniLM-L6-v2` (same dimension, slightly older, well-tested).
- **Fine-tuning:** none in v1. If NEX-specific staircase vocabulary loses recall, we adapt via a small contrastive-fine-tune batch (Philip approval gated).

Both stay inside the Core-Dependency rule: local, open-source, no quota.

### 4.2 · Hybrid retrieval (per user message)

Retrieval runs in three stages, then merges:

```
1. SEMANTIC  · SELECT id FROM nex_conv_knowledge_items
              WHERE brain = $brain
              ORDER BY embedding <=> $query_embedding
              LIMIT 25;

2. ENTITY    · SELECT id FROM nex_conv_knowledge_items
              WHERE brain = $brain
              AND entities && $extracted_entities   -- GIN array overlap
              LIMIT 25;

3. GRAPH     · WITH RECURSIVE walk AS (
                SELECT id, 0 AS hop FROM nex_conv_knowledge_items
                WHERE id = ANY($state.entities_in_focus_item_ids)
                UNION ALL
                SELECT e.to_item, w.hop + 1
                FROM walk w JOIN nex_conv_edges e ON e.from_item = w.id
                WHERE w.hop < 2 AND e.weight >= 0.70
              ) SELECT DISTINCT id FROM walk;
```

Merge = union with per-source score. Rerank by:

```
final_score = 0.35 * semantic_rank_score
            + 0.25 * entity_rank_score
            + 0.20 * graph_hop_bonus (1 hop > 2 hops)
            + 0.10 * intent_compatibility
            + 0.10 * topic_continuity_with_state
```

Top-K = 8 for the LLM context. Retrieval budget = 60ms total.

### 4.3 · Chunking strategy (turn-context chunks, not paragraph chunks)

Traditional RAG chunks paragraphs. That loses conversational nature. Instead:

- **One chunk = one `nex_conv_knowledge_items` row.**
- Each row's `question_text` + `answer_text` is the natural unit.
- For a multi-turn source: each turn becomes its own row, with `follows_from` edges chaining them.
- Longer statements (>1500 chars) get split at natural boundaries and joined by `elaborates` edges so retrieval finds the salient chunk without losing the whole.

No fixed-size sliding windows. Never.

---

## 5 · Conversation-state schema (extends conversation-state-model.md)

The existing doc defines the *what*. This defines the *stored JSON shape*.

```jsonc
{
  "schema_version": "1.0",
  "conversation_id": "uuid",
  "business_id": "uuid | null",
  "brain": "staircase_brain",
  "started_at": "iso timestamp",
  "last_turn_at": "iso timestamp",
  "turn_count": 7,

  // Topic and intent tracking
  "topic_stack": ["balusters", "starting_step", "pricing"],
  "current_topic": "balusters",
  "current_intent": {
    "slug": "compare",
    "class": "compare",
    "confidence": 0.88
  },

  // What we know about the customer / project
  "established_facts": {
    "construction_type": { "value": "wall_fixed", "turn_established": 2, "confidence": 0.9 },
    "style_intent": { "value": "contemporary", "turn_established": 1, "confidence": 0.7 },
    "material_primary": { "value": "oak", "turn_established": 3, "confidence": 0.95 },
    "budget_band": { "value": null, "turn_established": null, "confidence": 0 }
  },
  "requirements": ["under_stair_storage", "led_step_lighting"],
  "constraints": ["installed_by_march_2026"],
  "decisions_made": [
    { "topic": "riser_type", "value": "closed_riser", "turn_index": 4 }
  ],

  // Focus and pending
  "entities_in_focus": ["oak", "closed_string", "black_metal_baluster"],
  "entities_in_focus_item_ids": ["uuid", "uuid", "uuid"],
  "unresolved_ambiguities": [
    { "id": "amb_bottom_step_meaning",
      "detected_turn": 5,
      "candidate_meanings": ["bullnose_starting_step","curtail","boxed_bottom"] }
  ],
  "pending_questions_from_nex": ["Do you want a full replacement or a refacing?"],
  "unresolved_from_customer": [],

  // Confidence and stage
  "overall_confidence": 0.82,
  "stage": "specification",   // discover · specification · compare · decide · close

  // Retrieval memory
  "recently_used_item_ids": ["uuid","uuid","uuid"],
  "recent_turn_summaries": [
    { "turn_index": 4, "summary": "Customer chose oak treads + closed riser.", "entities": ["oak","closed_riser"] }
  ]
}
```

Rules:

- **Every field the LLM consumes has provenance** (which turn, what confidence).
- The full state is <8KB — cheap to read and write on every turn.
- Turn summaries (not full transcripts) are what get carried forward. Full transcripts live in `nex_conv_turns` and are only fetched when explicitly needed.
- Correction flow: on a `correct` intent, the affected `established_fact` is replaced (not appended) and the old value is preserved in an audit column.

---

## 6 · Ingestion pipeline (offline · batch)

```
RAW SOURCE
  ↓  (1)  Ingest
NORMALIZED RECORDS
  ↓  (2)  Deduplicate
CANONICAL RECORDS
  ↓  (3)  Classify (kind + intent + brain assignment)
CLASSIFIED RECORDS
  ↓  (4)  Extract (entities, topics, requirements, constraints)
ENRICHED RECORDS
  ↓  (5)  Embed
EMBEDDED RECORDS
  ↓  (6)  Link (build typed edges between rows)
LINKED GRAPH FRAGMENT
  ↓  (7)  Score (edge weights + item confidence)
SCORED GRAPH
  ↓  (8)  Validate (§8 checks)
GATED GRAPH
  ↓  (9)  Store (write to nex_conv_*)
LIVE-READABLE KNOWLEDGE
```

### 6.1 · Stage detail

1. **Ingest** — Accept JSON, JSONL, CSV, or existing image-batch style manifests. Idempotent by `source_ref` hash.
2. **Deduplicate** — Two levels: exact-text dedupe (SHA of normalised text), semantic dedupe (cosine ≥0.97 → merged into one row, `evidence_count` incremented).
3. **Classify** — Rule-based first (Philip's linguistic-doors mappings), LLM-second for low-confidence residuals. Never LLM-only; every classification carries a rule trace or is flagged for review.
4. **Extract** — Entity recognition via alias lookup against `nex_conv_entities` + LLM residual pass. Intent via `intent-patterns.md` taxonomy.
5. **Embed** — Batched through the local model.
6. **Link** — For each new item, candidate edges are proposed to every top-50 semantically-nearest item AND every item sharing ≥2 entities. Edge type derived from surface-cue rules + intent compatibility.
7. **Score** — Edge weight formula from §3. Item confidence = min(classification_confidence, extraction_confidence, embedding_neighbourhood_density).
8. **Validate** — §8.
9. **Store** — Wrapped in a single transaction per batch. On failure the whole batch rolls back. Emits a per-record audit log.

### 6.2 · Idempotency and safety

- Every ingest run produces a `nex_conv_batch_report` row (added later) with counts: read · normalised · deduped · classified · extracted · embedded · linked · scored · stored · rejected · flagged. Numbers are OBSERVED not projected (per Data-Identity + No-Hardcoded-Counts rule).
- Dry-run mode writes to a shadow schema `nex_conv_dryrun_*` for inspection before real merge.
- Owner sign-off is required to promote a dry-run into the live tables.

---

## 7 · Live inference pipeline (per user message · budget 800ms total)

```
USER MESSAGE
  ↓  (a) Fast intent + entity extraction         · 30ms  · local
  ↓  (b) Read conversation state                 ·  5ms  · Postgres
  ↓  (c) Hybrid retrieval (§4)                   · 60ms  · Postgres + pgvector
  ↓  (d) Graph walk 1-2 hops                     · 20ms  · Postgres CTE
  ↓  (e) Rerank                                  · 10ms  · Node
  ↓  (f) Predict next-likely-intents             ·  5ms  · in-memory transition table
  ↓  (g) Build response context                  ·  5ms  · Node
  ↓  (h) LLM generate response                   · ~600ms · external LLM call OK here
  ↓  (i) Post-process (entity extraction of NEX's own response)  · 30ms
  ↓  (j) State update                            ·  5ms  · Postgres
  ↓  (k) Log turn + candidate feedback signals   · 10ms  · Postgres
RESPONSE OUT
```

### 7.1 · Response context (what actually goes to the LLM)

Never the full graph. Never the full transcript. Only:

- The current turn message
- Turn summaries (from state) — at most 6 most-recent
- Top-K retrieved items (K=8)
- Established facts and requirements from state
- Two-line NEX voice guidance (from `recommendation-voice.md`)
- Optional: one next-likely-intent hint if intent-prediction is high-confidence

Estimated prompt size: 3-5KB. Independent of dataset size.

### 7.2 · Next-intent prediction

Maintain an in-memory transition table `intent_A → { intent_B: p_B, intent_C: p_C, ... }` derived from observed conversations. On each turn, given `current_intent`, expose top-3 likely `next_intents` to the response generator so it can pre-emptively address them (or leave a natural door open).

---

## 8 · Validation pipeline (before any batch commits)

Checks and hard gates:

| Check                                          | Threshold                | Fail action        |
|------------------------------------------------|--------------------------|--------------------|
| Item confidence <0.50                          | any                       | REJECT             |
| Item confidence 0.50-0.69                      | any                       | DRAFT ONLY         |
| Item `brain` is null                           | any                       | REJECT             |
| Edge weight <0.50                              | any                       | REJECT             |
| Edge crosses brains                            | any                       | REVIEW (admin)     |
| Two `answers` edges with contradictory entities to same question | >0            | REVIEW             |
| Duplicate `alternative_of` cycles              | any                       | COLLAPSE + REVIEW  |
| Batch dedupe rate <2% or >80%                  | anomaly                   | REVIEW batch input |
| Fabricated entity (not in `nex_conv_entities`) | any                       | REJECT             |
| Answer text >2000 chars                        | any                       | SPLIT              |

Everything flagged goes to the admin review queue (existing tagger pattern) — never silently dropped, never silently promoted.

---

## 9 · Feedback / learning loop

### 9.1 · Signal collection

Signals collected per turn (append to `nex_conv_feedback`):

- **Explicit:** owner thumbs-up / thumbs-down · customer "yes that helped" · customer "no I meant …"
- **Implicit next-turn:** repeat-of-same-question · abrupt topic change after NEX response · explicit correction phrase · owner escalation
- **End-of-conversation:** outcome label (`resolved` / `abandoned` / `escalated` / `pending`) auto or human

### 9.2 · Re-scoring cadence

Nightly job re-computes edge weights using accumulated feedback:

```
new_weight = old_weight * 0.9
           + 0.1 * outcome_lift
outcome_lift = (positive_outcomes - negative_outcomes) / total_outcomes_traversing_edge
```

Edges consistently followed by `corrected` or `user_abandoned` decay. Edges followed by `resolved` outcomes reinforce. All changes logged so decay is auditable.

### 9.3 · New item promotion

`draft_only` items that consistently retrieve well AND get positive feedback across ≥5 conversations get auto-promoted (subject to admin review queue). Poor performers get flagged for correction.

---

## 10 · Measurement framework

The rule: **NEX getting better** means measurable improvement on multi-turn coherence, not just volume. Metrics run on a rolling 7-day window and are surfaced in the NEX Brain Vitals dashboard as a new panel `Conversation Quality` (extends the existing four vitals — SIZE / ENRICHMENT / ACTIVE BRAINS / TOTAL KNOWLEDGE ASSETS).

| Metric                            | Definition                                                                                         | Target trend      |
|-----------------------------------|----------------------------------------------------------------------------------------------------|-------------------|
| **Task-completion rate**          | % of conversations labelled `resolved` or `clarification_completed`                                 | ↑ over time       |
| **Clarification-to-answer ratio** | Avg number of clarifications NEX asks before giving a substantive answer per conversation           | ↓ (fewer needed)  |
| **Repeat-question rate**          | % of conversations where the customer asks the same thing twice                                    | ↓                 |
| **Correction rate**               | % of turns receiving an explicit `correction_received` signal                                       | ↓                 |
| **Context-drop rate**             | % of turns where NEX response references facts already established (measured against state)         | ↑ (higher = better retention) |
| **Follow-up naturalness**         | Sample audit (weekly · 30 convos) rated 1-5 for naturalness of NEX's follow-ups                    | ↑                 |
| **Retrieval precision@8**         | Human-labelled % of top-8 retrieved items judged relevant                                          | ↑                 |
| **Average confidence**            | Weighted average of `overall_confidence` in `nex_conv_states` at conversation end                   | ↑                 |
| **Abandonment rate**              | % `user_abandoned`                                                                                  | ↓                 |
| **Escalation rate**               | % `escalated` (owner intervention needed)                                                          | context-dependent |

**Observed numbers only.** Never predict from small samples. Values dated in the dashboard.

---

## 11 · Brain Knowledge Graph + Conversation Graph overlay (Philip's addition)

Two graphs, cross-linked:

- **Brain Knowledge Graph** — domain ontology. Nodes = entities (Staircase → Oak / Walnut / Balusters / Newels / Handrails / Building Regs / Installation / Pricing / Delivery). Edges = domain relationships (`is_a`, `part_of`, `used_with`, `depends_on`). Curated · authoritative · slow-changing.
- **Conversation Graph** — how customers actually move through the ontology. Nodes = knowledge items. Edges = observed transitions weighted by outcome.

Cross-link: every `nex_conv_knowledge_items.entities[]` value is a key into the Brain Knowledge Graph. Every conversation traversal is a walk over knowledge-item nodes whose entities belong to brain-graph nodes. Over time we can plot **customer journeys as brain-graph walks** and detect where journeys stall or divert.

Storage: brain-graph lives in `nex_conv_entities` (nodes) + a companion `nex_conv_entity_edges` table (added when v2 promotes this). No new tech.

---

## 12 · Implementation phasing

### MVP (weeks 1-2)

- DDL for the 7 core tables.
- Local embedding worker (bge-small-en-v1.5 via `@xenova/transformers`).
- Ingest script for the existing conversational-intelligence pilot files (~22 docs) — proves the pipeline against known-good content.
- Read-only conversation-state store (writes stubbed).
- Query API: `POST /api/nex/conversation/retrieve` returning top-K items and one-hop graph walk.
- Bench: retrieval P95 <100ms on 10k items.

### v1 (weeks 3-6)

- Full live inference loop wired into the NEX Assist owner chat.
- Feedback signal collection.
- Nightly re-scoring job.
- Admin review queue for flagged items and edges.
- Conversation-quality dashboard panel.

### v2 (later · Philip-approved)

- Brain Knowledge Graph curation UI.
- Cross-brain edge review workflow.
- Optional contrastive fine-tune of the embedding model on NEX-specific vocabulary.
- Customer-facing conversation flows once owner-side proves out.

Each phase is Philip-gated. No auto-scaling to v2 without explicit approval.

---

## 13 · What this pipeline must NEVER do

1. **Never load the whole dataset into a model prompt.** Retrieval-only, state-only.
2. **Never create a cross-brain edge without admin review.** Staircase-brain items do not link to kitchen-brain items automatically.
3. **Never promote a draft-only item to live without admin review.** ADR-0033 gate.
4. **Never fabricate an entity, an edge, or a next-intent prediction.** Every node and edge has a source; every edge has evidence_count ≥1.
5. **Never silently overwrite state.** Corrections replace facts BUT the old value is preserved in an audit column.
6. **Never predict counts.** Observed numbers only in every dashboard and log.
7. **Never depend on a hosted third-party service in the pipeline path.** Final response LLM call is OK; enrichment / classification / embedding runs locally.
8. **Never chunk on fixed sliding windows.** Chunks are semantic units — a Q+A pair, a statement, a clarification.

---

## 14 · Success definition (Philip's original framing)

> The system should learn how conversations WORK, not merely memorize conversations. The objective is Q&A DATA → CONVERSATIONAL KNOWLEDGE, not Q&A DATA → GIANT PROMPT.

**Concrete success:** every metric in §10 trends in the right direction over rolling 30-day windows AND millions of records can be ingested without the model context growing.

**Concrete failure:** more data + no measurable improvement · retrieval precision <60% · repeat-question rate climbing · owner escalation rate climbing · state ignored by the response generator.

---

## 15 · Locked decisions (Philip · 2026-08-15)

All five open questions from the draft resolved:

| # | Decision area           | Locked answer                                                                                                     |
|---|-------------------------|-------------------------------------------------------------------------------------------------------------------|
| 1 | Pilot scope             | **Staircase brain only.** Same laboratory used for the conv-intel pilot. Engine generalises to other brains later.|
| 2 | MVP data sources        | Existing 22 conversational-intelligence docs + staircase brain reference batches + real NEX staircase conversations where available. External Q&A imports are a later ingestion source. |
| 3 | Owner-visible metrics   | Owner-visible in NEX Assist (Context retention · Follow-up relevance · Retrieval confidence · Conversation completion · Correction rate · Repeated-question rate · Knowledge growth). Deeper engineering diagnostics (graph edges · embedding · ingestion errors · reranking · edge weight distributions) admin-only. |
| 4 | Timing                  | Architecture / ADR / schema shipped now. **Ingestion implementation queued until MT-1 landing-page lock releases.** No parallel-feature drift permitted. |
| 5 | Canonical location      | **ADR-0044** at `docs/DECISIONS/0044-conversational-learning-pipeline.md` is the canonical decision record. This proposal doc is the concrete implementation-detail companion. Cross-reference added from `conversational-intelligence/README.md`. |

## 16 · Locked doc relationships

| Layer                                                                             | Purpose                                                                              |
|-----------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| `conversational-intelligence/README.md` + 21 topic docs                            | What NEX believes a good conversation IS.                                            |
| **ADR-0044** (canonical decision)                                                  | How NEX scales that intelligence across large amounts of data.                       |
| This proposal doc                                                                  | Concrete implementation detail (DDL, formulas, pipeline stages, live inference loop).|
| `deploy/postgres/init/050_nex_conv_learning_pipeline_schema.sql`                   | Frozen storage substrate.                                                            |
| Conversation Graph + Brain Knowledge Graph (runtime)                               | Infrastructure the reasoning layer depends on.                                       |

---

*End of proposal. Architecture accepted as ADR-0044. Ingestion implementation queued behind MT-1 landing-page lock; do not start early.*

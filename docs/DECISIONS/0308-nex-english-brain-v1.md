# 0308 · NEX English Brain v1

**Status:** Proposed · design doc for founder review · migration held pending `APPLY MIGRATION`
**Founder:** Phillip · directive delivered 2026-09-10
**Superseded rules:** Reframes previous per-agent language modules (`src/lib/nex-agent/language/*`) as misfiled

---

## Context

NEX Chat and NEX1 have been developing as if they were two AIs. They are not. They are two specialist **roles** of one NEX intelligence system:

- **NEX Chat** · conversation + knowledge role · answers "what is a migration?"
- **NEX1** · software-engineering role · executes "create a PostgreSQL migration adding user preferences"

Both must resolve the same underlying concept `migration` from the same canonical knowledge substrate. NEX1 then applies programming doctrine ON TOP of the shared concept. It does not own the concept.

Claude is temporary teaching muscle · never the runtime brain.

## Decision

Build **one canonical NEX English knowledge substrate** at `nex.*` in Postgres, consumed by both NEX Chat and NEX1 through a shared resolver. Follow these architectural rules · immutable:

1. `nex.concepts` represents the canonical concept.
2. `nex.concept_senses` represents distinct meanings of the same concept.
3. `sense_key` is a **stable canonical identifier** · not just a label. Example: `migration.database_schema_change` (not "database migration").
4. Evidence / provenance attaches to the **sense**, not the concept.
5. NEX Chat and NEX1 use the same `resolveConcept(surface, context)` API.
6. NEX1 never creates a private programming definition of a shared concept.
7. Programming-specific knowledge belongs in **domain knowledge / doctrine layered ON TOP** of the shared concept.
8. JSONB may be used for genuinely flexible metadata / examples. NOT as the canonical meaning store.
9. PostgreSQL is authoritative. In-memory language structures are hot tier / cache only.
10. Every knowledge write passes through Guardian → Truth Engine before becoming authoritative.
11. `nex.*` = what NEX knows. `nex_agent.*` = what NEX1 has proven it can do. Never mixed.

## Schema · SQL DDL (proposed · migration NOT yet created)

```sql
-- ── nex.concepts ──────────────────────────────────────────────────
CREATE TABLE nex.concepts (
  concept_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key    text NOT NULL UNIQUE,        -- "migration" · "charge" · "route" · lower_snake_case
  display_name     text NOT NULL,               -- "Migration" · human-readable label
  layer            smallint NOT NULL DEFAULT 1  -- 1..5 · L1 core → L5 programming
                   CHECK (layer BETWEEN 1 AND 5),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'guardian_ok', 'truth_engine_ok', 'authoritative', 'deprecated')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX concepts_layer_status_idx ON nex.concepts (layer, status);

-- ── nex.concept_senses ────────────────────────────────────────────
-- One row per (concept, distinct meaning). Provenance attaches here.
CREATE TABLE nex.concept_senses (
  sense_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id       uuid NOT NULL REFERENCES nex.concepts(concept_id) ON DELETE CASCADE,
  sense_key        text NOT NULL,               -- stable canonical id · "database_schema_change"
  description      text NOT NULL,               -- one-line canonical description
  domain_hint      text[] NOT NULL DEFAULT '{}',-- {"programming","postgres"} · guides context resolution
  examples         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- OK to use JSONB for examples · NOT for meaning
  confidence       numeric(4,3) NOT NULL DEFAULT 0.500 CHECK (confidence BETWEEN 0 AND 1),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'guardian_ok', 'truth_engine_ok', 'authoritative', 'deprecated', 'contradicted')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concept_id, sense_key)
);
CREATE INDEX concept_senses_concept_id_idx ON nex.concept_senses (concept_id);
CREATE INDEX concept_senses_domain_gin ON nex.concept_senses USING gin (domain_hint);

-- ── nex.contexts ──────────────────────────────────────────────────
-- Deterministic context signals: given a surface phrase + surrounding tokens,
-- which sense wins? Rows are hand/agent-curated. Guardian dedupes.
CREATE TABLE nex.contexts (
  context_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sense_id         uuid NOT NULL REFERENCES nex.concept_senses(sense_id) ON DELETE CASCADE,
  surface_signal   text NOT NULL,               -- e.g. "postgres" · "battery" · "accused of"
  signal_kind      text NOT NULL CHECK (signal_kind IN ('cooccur_token','cooccur_phrase','domain_hint','grammatical_role')),
  weight           numeric(4,3) NOT NULL DEFAULT 0.500,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contexts_sense_id_idx ON nex.contexts (sense_id);
CREATE INDEX contexts_surface_idx ON nex.contexts (surface_signal);

-- ── nex.relationships ─────────────────────────────────────────────
-- Concept ↔ concept edges (synonym · hypernym · antonym · related · domain_of · derived_from).
CREATE TABLE nex.relationships (
  relationship_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_concept_id uuid NOT NULL REFERENCES nex.concepts(concept_id) ON DELETE CASCADE,
  target_concept_id uuid NOT NULL REFERENCES nex.concepts(concept_id) ON DELETE CASCADE,
  relation_kind    text NOT NULL CHECK (relation_kind IN ('synonym','antonym','hypernym','hyponym','related','domain_of','derived_from','part_of')),
  confidence       numeric(4,3) NOT NULL DEFAULT 0.500,
  source_sense_id  uuid REFERENCES nex.concept_senses(sense_id) ON DELETE SET NULL,   -- optional: relate at sense-level
  target_sense_id  uuid REFERENCES nex.concept_senses(sense_id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_concept_id, target_concept_id, relation_kind, source_sense_id, target_sense_id)
);

-- ── nex.questions ─────────────────────────────────────────────────
-- Natural-language question pattern → resolved intent + expected answer type.
CREATE TABLE nex.questions (
  question_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface_pattern  text NOT NULL,               -- "how much does {entity} cost" · placeholder-friendly
  intent_slug      text NOT NULL,               -- "product_price" · "concept_definition" · etc.
  entity_slots     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name:"entity",kind:"noun_phrase"}]
  concept_id       uuid REFERENCES nex.concepts(concept_id) ON DELETE SET NULL,
  answer_type      text NOT NULL,               -- "price" · "definition" · "steps" · "boolean"
  confidence       numeric(4,3) NOT NULL DEFAULT 0.500,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','guardian_ok','truth_engine_ok','authoritative','deprecated')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_intent_idx ON nex.questions (intent_slug);

-- ── nex.answers ───────────────────────────────────────────────────
-- Canonical answers · attached to a question OR a sense · trust flows through evidence.
CREATE TABLE nex.answers (
  answer_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid REFERENCES nex.questions(question_id) ON DELETE CASCADE,
  sense_id         uuid REFERENCES nex.concept_senses(sense_id) ON DELETE CASCADE,
  body             text NOT NULL,               -- canonical answer text
  answer_kind      text NOT NULL CHECK (answer_kind IN ('definition','steps','list','fact','clarify','unknown')),
  confidence       numeric(4,3) NOT NULL DEFAULT 0.500,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','guardian_ok','truth_engine_ok','authoritative','deprecated','contradicted')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (question_id IS NOT NULL OR sense_id IS NOT NULL)
);
CREATE INDEX answers_question_idx ON nex.answers (question_id);
CREATE INDEX answers_sense_idx ON nex.answers (sense_id);

-- ── nex.evidence ──────────────────────────────────────────────────
-- Per-item provenance. Follows the ISG per-field provenance pattern already
-- live at nex.accommodation_business_field_provenance.
CREATE TABLE nex.evidence (
  evidence_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind     text NOT NULL CHECK (subject_kind IN ('concept','sense','question','answer','relationship','context')),
  subject_id       uuid NOT NULL,               -- FK enforced at app layer per subject_kind
  source_ref       text NOT NULL,               -- URL / dataset / worker id · never null
  trust_layer      text NOT NULL CHECK (trust_layer IN ('canonical_verified','canonical_unverified','evidence_verified','evidence_provisional','unknown')),
  confidence       numeric(4,3) NOT NULL DEFAULT 0.500,
  captured_at      timestamptz NOT NULL DEFAULT now(),
  captured_by      text NOT NULL,               -- worker id · "e1_language_researcher" · "e3_answer_builder" · "founder"
  cycle_run_id     uuid                          -- optional link to acquisition batch
);
CREATE INDEX evidence_subject_idx ON nex.evidence (subject_kind, subject_id);
CREATE INDEX evidence_trust_idx   ON nex.evidence (trust_layer);
```

## Resolver API

Single shared entry point consumed by both NEX Chat and NEX1:

```typescript
// src/lib/nex/language/concept-resolver.ts
export interface ResolvedConcept {
  concept_id: string;
  canonical_key: string;
  display_name: string;
  chosen_sense: {
    sense_id: string;
    sense_key: string;
    description: string;
    confidence: number;
  } | null;
  candidate_senses: Array<{ sense_id: string; sense_key: string; score: number }>;
  raw_surface: string;
  context_signals_used: string[];
}

export function resolveConcept(
  surface: string,
  context: { cooccur_tokens?: string[]; domain_hint?: string[]; grammatical_role?: string }
): Promise<ResolvedConcept | null>;
```

Deterministic. Zero LLM. Postgres-authoritative. Hot tier caches per-concept sense lists.

## Guardian responsibilities (deterministic · no LLM)

`src/lib/nex/language/guardian.ts` validates every write:

- Duplicate `canonical_key` on concepts.
- Duplicate `sense_key` within a concept.
- Contradiction: two `authoritative` senses whose descriptions contradict (heuristic · flag for human).
- Schema compliance: enum values · confidence range · required foreign keys.
- Unsupported claims: any `answer` or `sense` with status `authoritative` but no `evidence` row → reject.
- Hallucination signal: `sense_key` referring to a table/column/API that doesn't exist in the repo → reject.
- Terminology consistency: `sense_key` follows `<concept>.<snake_case_meaning>` naming rule.

Guardian never writes. It emits a verdict that `nex.*` write paths honour.

## Four worker roles

Located at `scripts/nex-english-brain-*` · each publishes to nex.* through the Guardian gate:

| Worker | File | Responsibility |
|---|---|---|
| **E1** | `scripts/nex-english-brain-e1-language.mjs` | Discovers words · meanings · synonyms · grammar. Writes candidate rows to `nex.concepts` + `nex.concept_senses` with status='draft'. |
| **E2** | `scripts/nex-english-brain-e2-intent.mjs` | Maps question patterns → intent + entities + answer_type. Writes to `nex.questions`. |
| **E3** | `scripts/nex-english-brain-e3-answers.mjs` | Creates canonical answers · attaches evidence. Writes to `nex.answers` + `nex.evidence`. |
| **Guardian** | `src/lib/nex/language/guardian.ts` | Deterministic validator. Runs on every draft → `guardian_ok`. Truth Engine promotes to `authoritative`. |

Claude may act as senior mentor to E1/E2/E3 during construction. Claude never writes directly to `nex.*` after founder approval — the workers do.

## Acceptance test

The same canonical concept `migration` resolves through both surfaces from the same schema row.

**Test 1 · NEX Chat:**
```
Input: "what is a migration?"
Path: /api/nex-conv/chat
  → domain-classifier · returns "unknown" (concept question, not accommodation/food/etc)
  → resolveConcept("migration", { cooccur_tokens: ["what","is"] })
  → concept:migration · candidate senses [database_schema_change, human_movement, business_transition]
  → chosen_sense: null (ambiguous · no context signal wins)
  → composer emits "I know 'migration' can mean X, Y, or Z. Which meaning?"
```

**Test 2 · NEX Chat with context:**
```
Input: "what does database migration mean?"
Path: /api/nex-conv/chat
  → resolveConcept("migration", { cooccur_tokens: ["database"] })
  → context row: surface_signal="database" → sense: database_schema_change (weight 0.9)
  → chosen_sense: database_schema_change
  → composer emits canonical answer from nex.answers where sense_id=database_schema_change
```

**Test 3 · NEX1:**
```
Input: "create a PostgreSQL migration adding user preferences"
Path: /api/nex/agent/submit
  → orchestrator.classifyPrompt
  → normaliser turns slang · tokens include "postgresql","migration","user","preferences"
  → resolveConcept("migration", { cooccur_tokens: ["postgresql"], domain_hint: ["programming"] })
  → context: "postgresql" → sense: database_schema_change (weight 0.95)
  → SAME sense_id as Test 2
  → NEX1 layers programming doctrine: db/migrations/ path · append-only · founder types phrase · rollback plan
  → composes plan
```

**PASS criterion:** Tests 2 and 3 return the *exact same* `sense_id` from `nex.concept_senses`. This is checked programmatically by the acceptance script.

## Progressive layer growth (does NOT block v1)

- **Layer 1** · Core English (~10k common words · grammar · relationships)
- **Layer 2** · Question language (natural question patterns · intents)
- **Layer 3** · Answer patterns (definitions · steps · lists · facts)
- **Layer 4** · Domains (construction · business · travel · food · tech)
- **Layer 5** · Programming English (TypeScript · PostgreSQL · APIs · Git · architecture · testing · security)

v1 ships with Layer 1 minimum viable + one concept per layer to prove architecture end-to-end. `migration` covers Layer 1, 4, 5 in one worked example.

## Learning loop

```
interaction (chat or nex1)
  → gap detected (unresolved concept or missing sense or no answer)
  → nex.evidence row with subject_kind='gap'
  → gap ticket enqueued
  → E1/E2/E3 workers process
  → Guardian
  → Truth Engine
  → status promoted to 'authoritative'
  → next interaction retrieves without gap
```

Existing `nex.accommodation_enrichment_evidence` + `knowledge-gap-queue.ts` are the reference pattern.

## Storage boundary preserved

- `nex.*` = what NEX knows (this ADR adds to it)
- `nex_agent.*` = what NEX1 has proven (competencies · tasks · audit · unchanged)
- No Supabase · no third-party runtime dependency · `NEX_LOCAL_ONLY=1` compatible

## What this ADR does NOT do

- Create the migration file · founder types `APPLY MIGRATION` first
- Populate seed data · that's E1/E2/E3's job post-migration
- Wire the resolver into `/api/nex-conv/chat` · own BEGIN
- Wire the resolver into `orchestrator.classifyPrompt` · own BEGIN (replaces current `code-intent-registry.ts`)
- Delete `src/lib/nex-agent/language/code-intent-registry.ts` · moves to `nex.concepts` + `nex.concept_senses` once seeded
- Layers 2-5 population · progressive · gap-driven

## Consequences

**Positive:**
- One brain, two roles · matches founder architecture directive
- Shared concept substrate · improvements to concept resolution benefit chat and nex1 simultaneously
- Provenance per sense · existing Truth Engine + trust ladder reused
- Deterministic · no LLM at runtime · no third-party
- Progressive · doesn't require boiling the ocean

**Negative:**
- Six new tables to maintain
- Concept-resolution latency will be measurable · needs hot tier cache
- Requires migration application (founder-gated)
- E1/E2/E3 acquisition workers are new dev work · non-trivial

**Rejected alternatives:**
- Nested JSONB meanings in `nex.concepts` (Option 1 in 2026-09-10 review) · rejected · loses per-sense provenance
- Both JSONB + relational (Option 3) · rejected · dual-writes create sync bugs
- Separate NEX Chat brain and NEX1 brain · rejected · founder directive · two AIs are one AI

## Approval

Founder must type `APPLY MIGRATION` before the migration file lands in `db/migrations/`. Follow-up BEGINs for resolver wire-in and worker construction are each independently founder-approved.

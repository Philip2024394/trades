# NEX · ADR-0308/0309 Migration Pre-Apply Safety Audit

**Founder-directed 2026-09-16 · READ-ONLY audit · FREEZE remains in force**

**No source-code changes. No migration changes. No `APPLY MIGRATION`. No database state changes. No wiring. No retirement. No deletion. No commits. No pushes.**

Founder truth rule: *"The most important output is not READY. The most important output is an accurate description of what is known, unknown, blocked, and irreversible."*

---

## §1 · ADR authority

**FACT** — Read across `docs/DECISIONS/`:

| ADR | File | Status | Role |
|---|---|---|---|
| **0308** | `0308-nex-english-brain-v1.md` | Proposed · migration held pending `APPLY MIGRATION` | Semantic layer schema (six tables) |
| **0309** | `0309-nex-english-brain-layered-architecture.md` | Proposed · database freeze in force | Layered architecture · 15 rules · gate sequence |
| **0309.1** | `0309.1-nex-logical-authority-model.md` | Proposed · doctrine only · database freeze in force | Logical Authority Model · 13 object types · authority matrix |
| **0310** | `0310-nex-knowledge-router-multi-substrate-authority.md` | Proposed · doctrine only · database freeze remains in force | Knowledge Router · multi-substrate authority · depends on 0308+0309+0309.1 |
| **0311** | `0311-nex-knowledge-router-reference-interface.md` | See file | Router reference interface |
| **0312** | `0312-nex-semantic-domain-knowledge-bridge.md` | See file | Semantic ↔ Domain Knowledge bridge |
| **0313** | `0313-nex-repo-orphan-classification.md` | See file | Repo orphan classification (references 0308+0309+0309.1) |
| **0314** | `0314-nex-unified-truth-engine.md` | See file | Unified Truth Engine (depends on 0309+0309.1) |
| **0314a** | `0314a-nex-truth-engine-rule-parity-certification.md` | Proposed · audit doctrine only · database freeze in force · `quality-checker` never modified | Truth Engine rule parity certification |

**FACT · Supersession check** — Grep across `docs/DECISIONS/` for "supersede" / "revoke" targeting 0308 or 0309: none found. All later ADRs use "Depends on" language.

**Rules directly governing the migration** (verbatim):
- **ADR-0308 Rule 9**: "PostgreSQL is authoritative · in-memory language structures are hot tier / cache only."
- **ADR-0308 Rule 10**: "Every knowledge write passes through Guardian → Truth Engine before becoming authoritative."
- **ADR-0308 Rule 11**: "`nex.*` = what NEX knows · `nex_agent.*` = what NEX1 has proven it can do · Never mixed."
- **ADR-0308 line 281**: *"Create the migration file · founder types `APPLY MIGRATION` first"*
- **ADR-0308 line 310**: *"Founder must type `APPLY MIGRATION` before the migration file lands in `db/migrations/`. Follow-up BEGINs for resolver wire-in and worker construction are each independently founder-approved."*
- **ADR-0309 line 210 (Gate 5)**: *"Founder types `APPLY MIGRATION`. Migration lands in `nex_dev`."*

**Rules governing Capability A**:
- **ADR-0308 Rule 6**: "NEX1 never creates a private programming definition of a shared concept."
- **ADR-0308 Rule 7**: "Programming-specific knowledge belongs in domain knowledge / doctrine layered ON TOP of the shared concept."
- **ADR-0308 Rule 11** (above).

**Rules governing Universal Intent**:
- **ADR-0309 Rule 1**: "NEX has ONE shared language/meaning architecture, not separate English brains for Chat and NEX1. Chat and NEX1 are two specialist roles of one NEX system (per ADR-0308 rule 5)."
- **ADR-0308 Rule 5**: "NEX Chat and NEX1 use the same `resolveConcept(surface, context)` API."

**Rules governing `nex.concepts`**:
- ADR-0308 Rules 1-8, 10; ADR-0309 Rule 3 (`nex.concepts` + `nex.concept_senses` = semantic layer)

**Rules governing `nex.*` versus `nex_agent.*`**:
- ADR-0308 Rule 11; ADR-0309 Rule 11 (Guardian → Truth Engine gate)

---

## §2 · Migration SQL inspection

**FACT · Migration file exists** — `db/migrations/006_nex_english_brain_v1.sql` (146 lines).

**FACT · Contradiction with ADR-0308** — ADR-0308 line 281 states migration file lands only AFTER `APPLY MIGRATION`. The file is present in `db/migrations/`. This is either:
- (a) The file was pre-authored and committed for readiness (physical presence without formal APPLY MIGRATION invocation is possible if the ADR text is interpreted flexibly), OR
- (b) `APPLY MIGRATION` was executed but not recorded in the ADR chain
- **INFERENCE**: Case (a) or (b) — cannot distinguish from repo evidence alone. **UNKNOWN**.

**FACT · Migration content** (complete inventory):

**Schema**: `nex` (guard: `CREATE SCHEMA IF NOT EXISTS nex`)

**Extension**: `pgcrypto` (guard: `CREATE EXTENSION IF NOT EXISTS pgcrypto`)

**Tables created (7)** — all wrapped in `BEGIN` … `COMMIT` (atomic), all use `CREATE TABLE IF NOT EXISTS` (idempotent):

| Table | Primary key | FKs (ON DELETE) | Notable constraints |
|---|---|---|---|
| `nex.concepts` | `concept_id uuid` | none | `canonical_key` UNIQUE · `layer` CHECK 1-5 · `status` CHECK enum |
| `nex.concept_senses` | `sense_id uuid` | `concept_id → concepts` (CASCADE) | UNIQUE (concept_id, sense_key) · `confidence` CHECK 0-1 · `status` CHECK enum |
| `nex.contexts` | `context_id uuid` | `sense_id → concept_senses` (CASCADE) | `signal_kind` CHECK enum (cooccur_token / cooccur_phrase / domain_hint / grammatical_role) · `weight` CHECK 0-1 |
| `nex.relationships` | `relationship_id uuid` | `source_concept_id`, `target_concept_id` → concepts (CASCADE) · `source_sense_id`, `target_sense_id` → concept_senses (SET NULL) | `relation_kind` CHECK enum (synonym/antonym/hypernym/hyponym/related/domain_of/derived_from/part_of) · UNIQUE compound |
| `nex.questions` | `question_id uuid` | `concept_id → concepts` (SET NULL) | `intent_slug` non-null · `entity_slots` JSONB · `status` CHECK enum |
| `nex.answers` | `answer_id uuid` | `question_id → questions` (CASCADE) · `sense_id → concept_senses` (CASCADE) | `answer_kind` CHECK enum · CHECK (question_id OR sense_id NOT NULL) · `status` CHECK enum |
| `nex.evidence` | `evidence_id uuid` | none (polymorphic via `subject_kind` + `subject_id`) | `subject_kind` CHECK enum · `trust_layer` CHECK enum · `captured_by` non-null |

**Indexes created (~17)** — all `CREATE INDEX IF NOT EXISTS`:
- 2 on `nex.concepts` (layer+status compound · canonical_key)
- 3 on `nex.concept_senses` (concept_id · domain_hint GIN · status)
- 3 on `nex.contexts` (sense_id · surface_signal · signal_kind)
- 3 on `nex.relationships` (source · target · relation_kind)
- 2 on `nex.questions` (intent_slug · concept_id)
- 3 on `nex.answers` (question_id · sense_id · status)
- 3 on `nex.evidence` (subject compound · trust_layer · captured_by)

**Seed data**: **ZERO**. No INSERT statements anywhere in the file.

**Dependencies**:
- Requires `nex` schema (guarded by `CREATE SCHEMA IF NOT EXISTS`)
- Requires `pgcrypto` extension (guarded)
- No references to tables outside `nex.*` — no cross-schema dependencies

**Ordering requirements** (implicit via FKs):
1. `nex.concepts` first
2. `nex.concept_senses` (depends on concepts)
3. `nex.contexts` (depends on senses)
4. `nex.relationships` (depends on concepts + senses)
5. `nex.questions` (depends on concepts optionally)
6. `nex.answers` (depends on questions + senses)
7. `nex.evidence` (polymorphic · no FK · logical dependency only)

Order in the file matches the FK dependency order.

**Destructive operations**: **NONE**. No DROP · No ALTER · No DELETE · No UPDATE · No TRUNCATE.

**Irreversible operations**: **NONE by strict definition** (no destruction). However:
- Schema creates leave artifacts unless manually dropped
- The migration file has NO DOWN migration · rollback would require manually dropping each table + index + extension check

**Plain-English explanation** (per founder rule):

*"If the founder eventually applies this migration:*
- *A `nex` schema is ensured (if absent, created).*
- *The `pgcrypto` extension is ensured (if absent, created).*
- *Seven tables are created inside `nex.` schema (if absent): concepts, concept_senses, contexts, relationships, questions, answers, evidence. Each table has enum constraints on status/kind fields and confidence-range constraints on numeric fields.*
- *Approximately 17 indexes are created (if absent) to support common lookups: canonical_key, layer/status, sense-by-concept, domain-hint arrays, question intent, evidence subject.*
- *NO existing data is touched. NO code is changed. NO wiring is performed. NO existing table is altered.*
- *If any of the tables or indexes already exist (they may, per ADR-0309.1 audit reporting 44 concepts + 51 senses seeded 2026-09-11), the migration is a no-op for those objects.*
- *The migration is atomic: entire operation succeeds or nothing changes.*
- *If rollback is later needed, tables must be manually dropped — no down migration exists."*

---

## §3 · Current schema/database state

**FACT** — `db/migrations/` directory contents:
- Numbered migrations 001-006 (`001_nex_brain_schema.sql` through `006_nex_english_brain_v1.sql`)
- 11 additional un-numbered `.sql` files with descriptive names (`nex_lab_schema.sql`, `nex_founder_window.sql`, etc.)
- No obvious migration-tracking metadata file (e.g. no `schema_migrations` table check in the repo)

**FACT** — Migration `001_nex_brain_schema.sql` line 12: *"Safe to re-run: uses IF NOT EXISTS"*. All prior migrations appear to follow the same idempotent pattern.

**FACT** — `006_nex_english_brain_v1.sql` file header: "Founder BEGIN 2026-09-11 · NEX English Brain v1 · ADR-0308."

**UNKNOWN · Whether tables exist in `nex_dev`**:
- ADR-0309.1 line 58 states: `nex.concepts + .concept_senses + .contexts + .relationships` were "Built 2026-09-11 · seeded 44 concepts + 51 senses"
- Migration file `006_nex_english_brain_v1.sql` includes those tables plus `nex.questions`, `nex.answers`, `nex.evidence`
- Whether the 44-concept seeding used this specific migration file OR a separate ad-hoc creation cannot be determined from repo evidence alone
- **Direct DB inspection outside the scope of this read-only audit**

**FACT · No naming/FK conflicts in repo**:
- Tables named `nex.concepts` · `nex.concept_senses` · etc. do not appear in any other `db/migrations/*.sql` file (grep-verified)
- No competing schema definitions for these names

**FACT · Duplicate migration responsibility check**:
- No other migration file creates `nex.concepts`, `nex.concept_senses`, or the other five tables
- No overlap with the 11 unnumbered SQL files

**INFERENCE** — At the repo level, the migration file is unique and non-conflicting. At the DB level, physical tables may already exist per ADR-0309.1 · idempotent CREATE IF NOT EXISTS means re-running is safe regardless.

---

## §4 · Migration data safety

Applied against the migration SQL as written:

| Question | Answer | Evidence |
|---|---|---|
| Does it INSERT data? | **NO** | Grep for INSERT: zero matches |
| Does it TRANSFORM data? | **NO** | Grep for UPDATE / SET (outside DEFAULT): zero matches |
| Does it COPY data? | **NO** | No SELECT INTO · no COPY · no INSERT FROM |
| Does it DERIVE data? | **NO** | No triggers · no computed columns beyond DEFAULT NOW() |
| Does it create records from existing registries? | **NO** | Zero seed statements in the file |
| Risk of duplicate records? | **N/A** | No data operations |
| Risk of losing existing information? | **NO** | CREATE IF NOT EXISTS means existing tables/rows are untouched |
| Deterministic identifiers? | **PARTIAL** | UUID PKs use `gen_random_uuid()` (non-deterministic); seed data doesn't exist so identifier stability is not a concern here |
| Idempotency protections? | **YES** | All `CREATE ... IF NOT EXISTS` |
| Rollback / down migration support? | **NO** | No down migration file · manual DROP would be required for rollback |
| Transaction atomicity? | **YES** | `BEGIN` … `COMMIT` wrapper |

**FACT · Migration data safety verdict**: The migration file itself is data-safe by construction — it performs zero data operations. All risk is at the schema-creation level, and CREATE IF NOT EXISTS eliminates conflict.

**INFERENCE · Down-migration absence** — If founder later decides to reverse the migration, manual `DROP TABLE nex.concepts` etc. must be executed in reverse dependency order (evidence → answers → questions → relationships → contexts → concept_senses → concepts). Not present in the repo.

---

## §5 · Capability A migration plan

Per §2 of the prior Disposition Analysis document, Capability A splits into:

### §5.1 · Currently stored in code

**FACT** — `src/lib/nex-agent/code-engine/capability-a-founder-intent/vocabulary.ts` (3836 lines · ~2726 array entries) contains:

| Registry | Item count (approx) | Character |
|---|---|---|
| VERB_FAMILY_VARIANTS | 8 × ~10 variants = ~80 | Knowledge |
| DELIVERABLE_PHRASES | 9 × ~10 phrases = ~90 | Knowledge |
| STOP_WORDS | ~125 | Linguistic knowledge (ADR-0309 Rule 2 layer) |
| REQUIREMENT_MARKERS | ~20 | Knowledge · grammatical concepts |
| TOOL_LEXEMES | ~180 | Knowledge |
| FRAMEWORK_LEXEMES | ~250 | Knowledge |
| CODE_CONCEPT_LEXEMES | ~1254 | Knowledge |
| LANGUAGE_LEXEMES | ~65 | Knowledge |
| WELL_KNOWN_CONFIG_FILES | ~240 | Knowledge |
| WELL_KNOWN_PROJECT_DIRS | ~114 | Knowledge |

Plus executable logic in `classifier.ts` (~750 lines) + `context-evidence-gate.ts` (universal signals + area gates). Plus 2253 tests.

### §5.2 · What would move to `nex.concepts` (Option A · Migrate)

**FACT** — Per ADR-0308 Rules 1-3, the ten knowledge registries above (~2200 items) become:
- `nex.concepts` rows (canonical_key)
- `nex.concept_senses` rows (sense_key per meaning)
- `nex.evidence` rows for provenance (per Rule 4)

STOP_WORDS is a special case:
- Per ADR-0309 Rule 2, `nex.brain_english_vocabulary` is the linguistic vocabulary authority
- STOP_WORDS is word-level linguistic data — arguably belongs in the Linguistic layer, not the Semantic layer
- **UNKNOWN** — Founder decision needed on whether STOP_WORDS migrates to `nex.brain_english_vocabulary` (as function-word entries) or to `nex.concepts` (as grammatical concepts) or stays in-code (competency)

### §5.3 · What would remain as `nex_agent.*` competency

**FACT**:
- `TOKEN_RE` / `FILE_REF_RE` regex constants
- All functions: `tokenise`, `extractFileReferences`, `extractProjectDirs`, `extractCodingConcepts`, `scanDeliverables`, `classifyVerbFamily`, `extractDomainTokens`, `extractRequirementPhrases`, `computeOverallConfidence`, `classifyFounderIntent`
- Context Evidence Gate helpers: `isPathVerbTerminal`, `requirementMarkerGate`, `isSpeculativeContext`, `wordsBefore`, `wordsAfter`, `isPastParticipleShape`
- Nex1IntentClassified / Nex1IntentRefused / Nex1IntentResult types
- The 2253 tests

### §5.4 · What would need to call `resolveConcept()` later

**FACT** — Per ADR-0308 Rule 5 and ADR-0308 line 284 (*"Wire the resolver into orchestrator.classifyPrompt · own BEGIN (replaces current code-intent-registry.ts)"*):

Post-migration wiring (separate founder-gated BEGINs):
1. `extractCodingConcepts` — currently reads `CODING_LEXEME_INDEX` in-memory; would call `resolveConcept()` per concept lookup
2. `classifyVerbFamily` — currently reads `VERB_LEXEME_INDEX`; would consult `nex.concepts` where `canonical_key LIKE 'verb.%'`
3. `scanDeliverables` — currently reads `DELIVERABLE_SCAN_ORDER`; would consult `nex.concepts` where domain_hint contains `deliverable`
4. `extractProjectDirs` — currently reads `WELL_KNOWN_PROJECT_DIRS`; would consult `nex.concepts` for project-dir concepts
5. `extractFileReferences` — could consult `nex.concepts` for well-known-config-file matches

**FACT · Zero code changes required by migration itself.** All wiring is post-migration follow-up work.

### §5.5 · Tests that remain valid

**FACT · By construction (tests exercise LOGIC not DATA)**:
- Alpha.6-alpha.10 tests that assert classifier BEHAVIOUR (e.g., "modify code in services rendered → no emission") — remain valid; test the logic, not the storage
- Tests that assert specific token presence in in-memory registries (e.g., `expect(WELL_KNOWN_PROJECT_DIRS.has("services")).toBe(true)`) — would need to shift to asserting `nex.concepts` contains the entry OR to a new abstraction (the vocabulary registry becomes a fetch)
- Version-check tests (`VOCABULARY_VERSION.startsWith("v5.0.0-alpha.")`) — likely obsolete post-migration; would move to a schema-version or migration-timestamp check

**INFERENCE · Estimated test refactor scope**: from grep, ~200 tests directly assert on `WELL_KNOWN_PROJECT_DIRS.has(...)`, `TOOL_LEXEMES.get(...)`, or similar in-memory data structures. These would need updating. **UNKNOWN precise count** without deeper inspection.

### §5.6 · Tests that would need rewriting

**FACT** — Tests that break the ADR-0308 layer separation would need to change:
- Any test that asserts "vocabulary entry X exists at path Y" in `nex_agent.*` — after migration, X lives in `nex.*`
- Tests that count vocabulary sizes (~50 tests in alpha.1-alpha.5)

### §5.7 · Lexemes doing double-duty as knowledge AND classifier logic

**FACT** — Not a widespread pattern. Grep confirms:
- Verb-family variants are used both as knowledge (what NEX knows: "build is a BUILD verb") AND as classifier lookup keys (VERB_LEXEME_INDEX). This is the Rule 11 violation itself.
- The vocabulary literal IS the double-duty. Migration resolves this by moving knowledge to `nex.concepts` and having classifier logic query the resolver.

**FACT · No structural obstacle** to the split beyond the wiring effort.

---

## §6 · Universal Intent · Rule 1 conformance

**FACT · Universal Intent** (`src/lib/nex/universal-intent/`):
- `classify.ts` (128 lines) · `phrasings.ts` · `types.ts` · `index.ts` · `classify.test.ts` (~60 tests)
- Classifies user input into 10 verbs (Create/Communicate/Decide/Plan/Manage/Automate/Analyse/Learn/Improve/Monitor) + domain + capability
- Own tokenizer: `.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)` with own 15-word stopword set
- Own phrasing corpus at `data/nex-intent-phrasings.jsonl` (164 rows · founder-authored 2026-08-03 per ADR-0309 line 20)
- Jaccard similarity scoring + verb-keyword fallback
- **Does NOT import from `nex/language/`** (grep-verified)

**FACT · Consumers**:
- `/api/nex/universal-intent/route.ts` (HTTP endpoint)
- `nex/pipeline/converse.ts` line 252 (Stage 4 of 11-stage pipeline)
- `components/nex/GoalLayer.tsx` (UI)

**FACT · Duplication vs `nex/language/`**:
- Universal Intent has own tokenizer; `nex/language/normaliser.ts` has its own tokenizer. Different rules (Universal Intent strips ALL non-alphanumeric; normaliser strips a specific 14-character punctuation set + collapses whitespace + applies UK slang aliases).
- Universal Intent has own stopwords (15 hardcoded); `nex/language/stopwords-en-gb.ts` has 54.
- Universal Intent uses a phrasing corpus; `nex/language/intent-parser.ts` uses a DomainIntent registry. Different data shapes.

**FACT · Responsibilities not covered elsewhere**:
- Universal Intent's 10-verb general-Q&A verb classification (Create/Communicate/Decide/Plan/Manage/Automate/Analyse/Learn/Improve/Monitor) is NOT covered by any other module
- `nex/language/` uses per-domain DomainIntent registries; the only registered domain today is CODE (via `nex-agent/language/code-intent-registry.ts`)
- Universal Intent's 10-verb model IS a coarse general-Q&A classification specialist that other modules don't currently provide

**FACT · Technical possibility of wrapping as specialist**:
- Would require: refactor `classify()` to first call `normalise()` from `nex/language/`, then call `resolveConcept()` for concept grounding, then apply the 10-verb layer on top
- Migrate the 164-row phrasing corpus to `nex.questions` per ADR-0309 Rule 5
- Retain Jaccard scoring as a specialist ranking method
- No fundamental blocker — the specialist role IS what ADR-0309 Rule 1 permits above the shared architecture

**FACT · Retirement gap analysis**:
- If Universal Intent retires, the 10-verb general-Q&A classification vocabulary is lost
- `nex/language/` + domain plug-ins could eventually cover this space (add "general-Q&A" domain with equivalent DomainIntent entries)
- Pipeline Converse would need refactoring — Stage 4 currently calls `classifyUniversalIntent` directly
- Not a trivial retirement

**FACT · Does ADR-0309 provide enough information to decide?**
- Rule 1 requires ONE architecture with specialist roles
- ADR-0309 does not explicitly name Universal Intent
- ADR-0309 Gate 1 (7 open decisions) does not directly address Universal Intent
- The ADR provides enough to identify NONCONFORMANCE but NOT enough to prescribe the specific disposition
- Both U1 (wrap as specialist) and U2 (retire) are Rule-1-compatible endpoints

**Final classification**:

**Universal Intent · Rule 1 conformance = DOES_NOT_CONFORM (as currently implemented)**

Evidence: parallel classifier with independent tokenizer + stopwords + vocabulary; not consuming `resolveConcept`.

**Rule 1 provides enough information to identify the violation. It does NOT prescribe which of U1 or U2 to choose. That decision requires additional founder judgment beyond the ADR text.**

---

## §7 · The Seven Open Gate-1 Decisions

**FACT** — Per ADR-0309 lines 214-222, seven open decisions block Gate 1 (before proceeding to Gate 3):

| # | Question (verbatim ADR-0309 line reference) | Current evidence | Why open | Blocks migration itself? |
|---|---|---|---|---|
| 1 | Confirm the four-layer target architecture (Language + Semantic + People-Say + Domain) is correct as drawn | ADR-0309 body defines the four layers; ADR-0310 depends on this framing | No explicit founder "APPROVE" recorded | **NO** — migration creates only Semantic layer schema · four-layer framing is architectural, not migration-technical |
| 2 | Linguistic-field home (POS · CEFR · pronunciation · EN↔ID): (a) extend `nex.concepts`, (b) stay in `nex.brain_english_vocabulary` linked via `nex.concept_word_links`, or (c) new `nex.word_linguistics` table | ADR-0309 Rule 2 says `nex.brain_english_vocabulary` remains authoritative; ADR-0308 does not add linguistic fields to `nex.concepts` | Bridge decision unresolved | **NO** — migration file does not create bridging table · decision affects later linking work |
| 3 | People-Say home: (a) new table, (b) JSONB in senses, or (c) keep as JSON file | ADR-0309 Rule 4 defines the layer; physical home explicitly deferred (line 50) | Founder deferred (line 50) | **NO** — migration doesn't touch People-Say · founder-authored `human-language-map.json` remains untouched |
| 4 | Empty tables (`nex.brain_english_grammar`/`lesson`/`practice`/`progress`) — original design intent, retire or absorb? | Tables exist in `nex_dev.nex.*` per ADR-0309.1 · empty · schema-ready | Design intent unknown to Master AI Engineer per ADR-0309 line 186 | **NO** — migration doesn't touch these tables |
| 5 | Founder-authored orphans (`human-language-map.json` + `nex-intent-phrasings.jsonl`) — target home, target time | Files exist untouched · founder-authored | Founder decision on migration target + timing pending | **NO** — migration doesn't import these · they stay in repo |
| 6 | Supabase gate opening — when? | ADR-0309 Amendment ("Post-Gate-2") reports Supabase audit COMPLETE 2026-09-11 · authority matrix documented in ADR-0309.1 | Gate 2 is COMPLETE but subsequent Supabase-side work is not scheduled | **PARTIALLY** — migration is `nex_dev.nex.*` only, does not touch Supabase; but multi-substrate authority (ADR-0310) may require Supabase decisions before wire-in |
| 7 | Migration ADR draft (Gate 3) — draft now or wait until Gate 2? | Gate 2 done; a separate "Migration Design ADR" as ADR-0309 line 208 specified does NOT exist under that name; the migration file itself (`006_...`) is the de-facto migration content | Whether the ADR-0308 body + the migration file together constitute the "Migration Design ADR" is a founder interpretation call | **PARTIALLY** — if founder considers current material sufficient, Gate 3 is effectively complete; if a separate Migration Design ADR is required, it blocks |

**INFERENCE · Blocks migration itself?**
- Decisions 1-5: DO NOT technically block migration file execution. Migration is schema-only; those decisions affect post-migration wiring.
- Decision 6: PARTIALLY. Migration touches only `nex_dev.nex.*`; Supabase authority reconciliation is post-migration.
- Decision 7: PARTIALLY. Depends on founder interpretation of what "Migration Design ADR" requires.

**FACT · What would close each decision**:
- Decisions 1-5: founder verbal or written approval
- Decision 6: Supabase strategy decision (retain / migrate to `nex_dev` / cross-consume via router)
- Decision 7: founder confirmation that ADR-0308 body + `006_nex_english_brain_v1.sql` = Migration Design; OR authorisation to draft a separate Migration Design ADR

---

## §8 · Migration vs post-migration work · strict boundary

### APPLY MIGRATION WOULD DO (only these):

1. Ensure `nex` schema exists
2. Ensure `pgcrypto` extension exists
3. Create seven tables if absent (concepts, concept_senses, contexts, relationships, questions, answers, evidence)
4. Create ~17 supporting indexes if absent
5. Wrap in transaction (atomic)

**Nothing else.**

### APPLY MIGRATION WOULD NOT DO (all founder-gated afterward):

Per ADR-0308 lines 279-286 explicit "What this ADR does NOT do":

1. Populate seed data — that is E1/E2/E3 workers' job post-migration
2. Wire the resolver into `/api/nex-conv/chat` — its own founder-approved BEGIN
3. Wire the resolver into `orchestrator.classifyPrompt` — its own founder-approved BEGIN (would eventually replace `code-intent-registry.ts`)
4. Delete `src/lib/nex-agent/language/code-intent-registry.ts` — happens "once seeded" · founder-gated
5. Populate Layers 2-5 (progressive · gap-driven)

Per this audit's derivation:

6. Migrate Capability A vocabulary — separate founder decision (Options A/B/C from prior Disposition Analysis)
7. Refactor Capability A classifier logic to call `resolveConcept()` — separate founder-gated BEGIN
8. Wrap or retire Universal Intent — separate founder decision (Options U1/U2/U3)
9. Universal Intent phrasing corpus migration to `nex.questions` — separate founder decision
10. Retire code-intent-registry.ts — post-seeding · founder-gated
11. Accommodation `IntentDefinition` → `DomainIntent` convergence — separate work
12. Truth Engine cross-substrate unification — ADR-0314 depends
13. Supabase-side reconciliation — separate gate
14. Amend Language Architecture Doctrine v1.0 to reference ADR chain — documentation only
15. Preserve or amend Two-Proof Rule — documentation only
16. Stage 2 (Native Code Understanding) work — future ADR needed
17. Stage 3 (Agent Recognition) work — future ADR needed

**FACT** — Every item in the "WOULD NOT DO" list requires a separate founder-approved BEGIN or ADR. Applying the migration does NOT authorise any of them.

---

## §9 · Migration Readiness Matrix

| Area | Status | Evidence | Blocks APPLY? |
|---|---|---|---|
| ADR authority (0308+0309+0309.1+0310+0311+0312+0313+0314+0314a) | **PASS** | All ADRs Founder-authored · none superseded · dependency chain intact | NO |
| Migration SQL (`006_nex_english_brain_v1.sql`) | **PASS** | 146 lines · idempotent · atomic · seven tables + ~17 indexes · zero data ops | NO |
| Schema compatibility with existing DB | **PASS** | No naming conflicts in `db/migrations/*.sql` · `nex` schema exists per prior migrations | NO |
| Existing data preservation | **PASS** | Migration performs zero data operations · CREATE IF NOT EXISTS everywhere | NO |
| Seed data | **NOT APPLICABLE** | Migration includes ZERO seed data by design (per ADR-0308 line 282, seeding is E1/E2/E3's post-migration job) | NO |
| Duplicate / conflict risk | **PARTIAL** | ADR-0309.1 line 58 reports 44 concepts + 51 senses already exist in `nex.concepts` · idempotent DDL is safe but existing data state relative to founder intent is **UNKNOWN** | Possibly · founder should confirm pre-existing data state before deciding |
| Rollback characteristics | **PARTIAL** | Atomic transaction ensures success/failure integrity · but NO down-migration file exists · rollback would be manual DROP in reverse dependency order | NO for apply · YES if rollback ever needed |
| Capability A disposition | **UNKNOWN** | Rule 11 violation exists · Options A/B/C exist · founder has not chosen | NO — Capability A disposition is post-migration work; migration itself does not touch it |
| Universal Intent Rule 1 | **DOES_NOT_CONFORM** (as-is) | Parallel classifier · not using `resolveConcept` · options U1/U2/U3 open | NO — Universal Intent disposition is post-migration; migration itself does not touch it |
| Gate 1 (7 open decisions) | **PARTIAL** | Decisions 1-5 do not block migration technically · Decision 6 partial · Decision 7 depends on founder interpretation | Not blocking migration technically; blocking founder's confidence in post-migration path |
| Gate 3 (Migration Design ADR) | **PARTIAL** | Migration file exists · No separate ADR named "Migration Design" but ADR-0308 body + `006_...` may constitute it | Depends on founder interpretation |
| Gate 4 (Migration dry-run on scratch DB) | **UNKNOWN** | No evidence of dry-run in repo · no `data/migrations-dryrun*` or similar artifact | Yes if founder holds that Gate 4 must be complete before Gate 5 |

**Summary counts**:
- PASS: 5
- PARTIAL: 4
- NOT APPLICABLE: 1
- UNKNOWN: 1
- DOES_NOT_CONFORM: 1 (Universal Intent · NOT blocking migration)
- FAIL: 0

**FACT · No FAIL rows.** The migration itself is technically safe. Uncertainty resides in the POST-migration ecosystem, not in the migration file's execution.

---

## §10 · Final Founder Decision Pack

### A. FACTS WE NOW KNOW

1. Migration file `db/migrations/006_nex_english_brain_v1.sql` exists (146 lines, founder-authored 2026-09-11).
2. Migration is idempotent (`CREATE ... IF NOT EXISTS` throughout) and atomic (BEGIN/COMMIT).
3. Migration creates seven tables + ~17 indexes only. Zero seed data. Zero destructive operations.
4. No down-migration file exists.
5. No naming or FK conflicts with existing `db/migrations/*.sql` content.
6. ADR-0308, ADR-0309, ADR-0309.1, ADR-0310, ADR-0311, ADR-0312, ADR-0313, ADR-0314, ADR-0314a are all "Proposed" · none superseded · database freeze in force across all.
7. ADR-0309.1 line 58 reports 44 concepts + 51 senses already seeded in `nex.concepts` as of 2026-09-11 (physical state uncertain relative to migration authorisation).
8. Capability A knowledge (~2200 lexemes) violates ADR-0308 Rule 6 and Rule 11 as currently stored in `nex_agent`-namespaced path.
9. Universal Intent (`nex/universal-intent/`) DOES_NOT_CONFORM to ADR-0309 Rule 1 as currently implemented (parallel classifier).
10. Migration itself does NOT wire the resolver, does NOT touch Capability A, does NOT touch Universal Intent, does NOT delete anything.

### B. QUESTIONS STILL UNKNOWN

1. Did `APPLY MIGRATION` already occur (creating the 44 concepts) or were the tables built by a separate mechanism? Repo evidence is inconclusive.
2. Whether ADR-0308 body + `006_...` migration file jointly constitute the "Migration Design ADR" required by ADR-0309 Gate 3.
3. Whether Gate 4 (dry-run) was performed.
4. Whether the founder considers the seven Gate-1 decisions closed enough to proceed.
5. Founder's disposition for Capability A (Options A/B/C from prior Disposition Analysis).
6. Founder's disposition for Universal Intent (Options U1/U2/U3).
7. Founder's disposition for STOP_WORDS home (linguistic layer vs concepts vs stays in-code).
8. Founder's disposition for People-Say layer physical home.

### C. WHAT APPLY MIGRATION WOULD CHANGE

Concrete database/schema consequences ONLY:

1. `nex` schema exists (already may).
2. `pgcrypto` extension exists (already may).
3. Seven tables present in `nex_dev.nex.*` (may already be per ADR-0309.1).
4. ~17 indexes present.
5. Zero rows inserted.
6. Zero existing rows changed.
7. Zero source code changed.
8. Zero HTTP endpoints changed.
9. Zero classifier behaviour changed.

**Net effect if tables already exist**: NO-OP. If tables do not exist: schema creation only.

### D. WHAT THE FOUNDER STILL NEEDS TO DECIDE

1. **`APPLY MIGRATION`** · issue or hold. Evidence supports technical safety of the migration itself. Founder judgment on Gate 1, 3, 4 completeness remains sole decision.
2. **Verify current DB state** · direct inspection of `nex_dev.nex.*` (outside this read-only audit scope) to confirm whether the 44 concepts came from this migration or elsewhere. Founder-only decision on whether to inspect.
3. **Capability A disposition** · A/B/C (evidence supports A but founder decision required).
4. **Universal Intent disposition** · U1/U2/U3 (evidence identifies violation; disposition is founder judgment).
5. **STOP_WORDS home** · linguistic-vocab vs semantic-concepts vs in-code competency.
6. **Post-migration wiring order** · resolver → orchestrator vs resolver → chat vs seed E1/E2/E3 first.
7. **Down-migration authoring** · whether a rollback SQL file should be authored before Gate 5 or after.

---

## §11 · Migration readiness verdict

**MIGRATION READINESS: TECHNICALLY SAFE · CONTEXTUALLY UNKNOWN**

- Technical safety: PASS (idempotent · atomic · non-destructive · no data operations)
- Contextual readiness: **UNKNOWN** because:
  - Physical state of `nex_dev.nex.*` relative to founder intent is unverified
  - Gate 1 decisions are partially open
  - Gate 4 dry-run status is unverified
  - No down-migration exists

**Founder truth rule enforced**: I do NOT declare `READY`. The migration file itself would apply cleanly, but the systemic context around it has UNKNOWNs that only the founder can close.

---

## §12 · What this audit does NOT do

- Does NOT execute `APPLY MIGRATION`
- Does NOT modify any source · migration · database state
- Does NOT recommend any specific disposition for Capability A, Universal Intent, STOP_WORDS, or People-Say
- Does NOT amend any ADR
- Does NOT commit or push
- Does NOT run any migration dry-run
- Does NOT inspect `nex_dev` directly (outside read-only-repo scope)
- Does NOT authorise anything

**SEALED · 2026-09-16 · v1.0 · append-only · founder-directed pre-apply safety audit**

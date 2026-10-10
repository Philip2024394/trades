# NEX Language · ADR Conformance Audit

**Founder-directed 2026-09-16 · READ-ONLY evidence audit · FREEZE remains in force**

**No production code changes. No commits. No pushes. No wiring. No consolidation. No deletion. No migration. No implementation.**

Founder critical truth rule: *"Do not reopen a decision the founder has already made."* This audit measures conformance of the current codebase against the founder-authorised ADRs. It does NOT propose a new canonical layer.

---

## §1 · ADR-0308 findings

**FACT** — ADR-0308 exists at `docs/DECISIONS/0308-nex-english-brain-v1.md` (310 lines).

- **Title**: NEX English Brain v1
- **Status**: `Proposed · design doc for founder review · migration held pending APPLY MIGRATION`
- **Founder directive**: Phillip · delivered 2026-09-10
- **Superseded rules preamble**: "Reframes previous per-agent language modules (`src/lib/nex-agent/language/*`) as misfiled"

**Authorised architecture** (Decision section, 11 immutable rules):

| Rule | Verbatim |
|---|---|
| 1 | `nex.concepts` represents the canonical concept |
| 2 | `nex.concept_senses` represents distinct meanings of the same concept |
| 3 | `sense_key` is a stable canonical identifier · not just a label |
| 4 | Evidence / provenance attaches to the sense, not the concept |
| 5 | NEX Chat and NEX1 use the same `resolveConcept(surface, context)` API |
| 6 | NEX1 never creates a private programming definition of a shared concept |
| 7 | Programming-specific knowledge belongs in domain knowledge / doctrine layered ON TOP of the shared concept |
| 8 | JSONB may be used for genuinely flexible metadata / examples · NOT as the canonical meaning store |
| 9 | PostgreSQL is authoritative · in-memory language structures are hot tier / cache only |
| 10 | Every knowledge write passes through Guardian → Truth Engine before becoming authoritative |
| 11 | `nex.*` = what NEX knows · `nex_agent.*` = what NEX1 has proven it can do · never mixed |

**Schema DDL** (proposed · migration NOT yet created): six tables — `nex.concepts` · `nex.concept_senses` · `nex.contexts` · `nex.questions` · `nex.answers` · `nex.evidence`.

**Migration gating** (line 310): *"Founder must type `APPLY MIGRATION` before the migration file lands in `db/migrations/`."*

---

## §2 · ADR-0309 findings

**FACT** — ADR-0309 exists at `docs/DECISIONS/0309-nex-english-brain-layered-architecture.md` (383 lines).

- **Title**: NEX English Brain · Layered Architecture
- **Status**: `Proposed · draft for founder review · database freeze remains in force`
- **Founder directive**: Phillip · delivered 2026-09-11
- **Amends**: ADR-0308 (six-table schema stands; framing "44 concepts = the English Brain" corrected)

**Reconciliation context**: An audit of all English-related sources in the codebase and Postgres `nex_dev` revealed:
- `nex.brain_english_vocabulary` (30 rows · CC0 · 2026-08-28) = **linguistic vocabulary layer** (POS/CEFR/IPA/definitions/register/variety/frequency)
- `data/nex/human-language-map.json` (founder-authored 2026-07-30 · Rule B no-AI · Rule C attributable) = **People-Say layer**
- `nex.question_variant` (25,456 rows) = **retrieval asset**, not canonical
- `nex.knowledge_gap` (6335) · `nex.knowledge_inbox` (279) · other tables = runtime/staging
- `nex-intent-phrasings.jsonl` (164 rows · founder-authored 2026-08-03) = orphaned outside `nex.*`
- Supabase (two projects) has not been audited (behind separate gate)

**Authorised architecture** (Decision section, 15 rules · summarised):
- Rule 1: ONE shared language/meaning architecture for Chat + NEX1
- Rule 2: `nex.brain_english_vocabulary` = linguistic vocabulary layer (authoritative for word-level knowledge)
- Rule 3: `nex.concepts` + `nex.concept_senses` = semantic layer (ADR-0308's six-table schema)
- Rule 4: People-Say is a distinct translation/resolution layer with founder provenance (Rule B no-AI, Rule C attributable, Anti-scrape rule)
- Rule 5: `nex.questions` holds canonical patterns, not entity-specific variants
- Rule 6: `nex.question_variant` remains supporting retrieval data
- Rule 7-15: Governance, retrieval, guardians, safety, migration gates
- **Gate 5** (line 210): *"Founder types `APPLY MIGRATION`. Migration lands in `nex_dev`."*
- Rule 15: physical location does not determine logical authority

---

## §3 · Supersession check

**FACT · Grep across `docs/DECISIONS/` for references to ADR-0308 and ADR-0309**:

| Later ADR | Relationship |
|---|---|
| **ADR-0309.1** · Logical Authority Model (2026-09-11) | **AMENDS** ADR-0309 (Rule 15 already added) · adds 13 logical object types + authority matrix. Depends on 0308+0309. Does NOT supersede. |
| **ADR-0310** · Knowledge Router · Multi-Substrate Authority | **DEPENDS ON** ADR-0308 (semantic layer schema) + ADR-0309 (Rules 1-15) + ADR-0309.1. Explicitly rejects "Two independent NEX brains" as a violation of ADR-0308 rule 5 + ADR-0309 rule 1. |
| **ADR-0311** · Knowledge Router Reference Interface | Depends on 0308-0310 chain. |
| **ADR-0312** · Semantic Domain Knowledge Bridge | Depends on 0308 + 0309 + 0309.1. |
| **ADR-0313** · Repo Orphan Classification | References 0308, 0309, 0309.1 as authoritative. |
| **ADR-0314** · Unified Truth Engine | Depends on 0309 + 0309.1. |

**INFERENCE** — No later ADR supersedes ADR-0308 or ADR-0309. Every later ADR EXTENDS them. ADR-0310 explicitly enforces them.

**FACT · Additional check** — `docs/DECISIONS/` contains no ADR marked "supersedes 0308" or "supersedes 0309" or "revokes 0308/0309".

**Conclusion: ADR-0308 + ADR-0309 remain authoritative. The founder decision on the canonical NEX language architecture stands.**

---

## §4 · Authorised architecture (composite of 0308 + 0309 + 0309.1)

**FACT** — The authorised architecture is:

```
                              USER LANGUAGE
                                    ↓
              CANONICAL LANGUAGE / KNOWLEDGE SUBSTRATE
                (nex.* Postgres · database-authoritative)
                                    ↓
           ┌────────────────────────┼────────────────────────┐
           ↓                        ↓                        ↓
    LINGUISTIC LAYER          SEMANTIC LAYER           PEOPLE-SAY LAYER
    (nex.brain_english_       (nex.concepts +          (founder-authored ·
     vocabulary · 30 rows      nex.concept_senses +     Rule B no-AI ·
     CC0 · POS/CEFR/IPA)       nex.contexts +           Rule C attributable ·
                               nex.questions +          Anti-scrape enforced)
                               nex.answers +
                               nex.evidence)
                                    ↓
                        RESOLVER (`resolveConcept`)
                                    ↓
           ┌────────────────────────┼────────────────────────┐
           ↓                        ↓                        ↓
      NEX Chat role         NEX1 role (SW eng)         Specialists
   (conversation +         (programming ON TOP        (Reflex · Brain
    knowledge)              of shared concept)         language-intel · etc)
                                    ↓
                    DOMAIN KNOWLEDGE / DOCTRINE
                    (layered ON TOP of shared concepts)
                                    ↓
                              ACTION / ANSWER
```

**Explicitly enforced**:
- Rule 5: `resolveConcept(surface, context)` is the single API shared by Chat and NEX1
- Rule 6: NEX1 never creates a private programming definition
- Rule 9: Postgres is authoritative · in-memory is hot tier
- Rule 11: `nex.*` = knowledge · `nex_agent.*` = proven capability · never mixed

---

## §5 · Current implementation snapshot

**FACT** — Code state as of 2026-09-16:

| Layer | ADR calls for | Current code state |
|---|---|---|
| Linguistic (Language object) | `nex.brain_english_vocabulary` (Postgres) as authority | Table exists in Postgres per ADR-0309.1 audit line 57 (`nex_dev.nex.brain_english_vocabulary` · 30 rows). **CONFORMS** |
| Semantic (Semantic object) | `nex.concepts` + `nex.concept_senses` + `nex.contexts` + `nex.questions` + `nex.answers` + `nex.evidence` | Per ADR-0309.1 line 58, six tables **were built 2026-09-11 · seeded 44 concepts**. But ADR-0308 line 3 says "migration held pending APPLY MIGRATION". **UNKNOWN whether the tables that exist represent the ADR-0308 migration or a pre-migration state.** Need direct DB inspection to confirm — read-only DB access outside my current scope. |
| People-Say | Founder-authored translation layer | `data/nex/human-language-map.json` exists (founder-authored 2026-07-30). Not in DB. **PARTIALLY_CONFORMS** — layer exists but not integrated into resolver per Rule 4. |
| Resolver API | `resolveConcept(surface, context)` shared by Chat + NEX1 | `src/lib/nex/language/concept-resolver.ts` exports `resolveConcept`. Consumed by `nex-agent/core/orchestrator.ts` + `nex/live-chat-completion/adapters/code-adapter.ts`. **CONFORMS** at the API-shape level. |
| `nex.*` vs `nex_agent.*` segregation | Never mixed | Capability A (`nex-agent/code-engine/capability-a-founder-intent/`) contains ~1500 lexemes representing knowledge shape. Lives in `nex_agent`-namespaced path. **DOES_NOT_CONFORM** to Rule 11. |
| NEX1 private programming definition | Forbidden | Capability A defines private code-domain verb families, deliverables, concepts, project-dirs. **DOES_NOT_CONFORM** to Rule 6. |
| Guardian → Truth Engine gate | Every knowledge write | `nex/language/guardian.ts` exists. `nex/language/concept-resolver.ts` L173-194 uses Guardian. **PARTIALLY_CONFORMS** — Guardian exists; enforcement of evidence-link on answer promotion is half-implemented per Agent A. |
| Universal Intent | Not addressed by ADR-0308/0309 explicitly | `nex/universal-intent/` exists, 10-verb classifier, `/api/nex/universal-intent/` endpoint + Stage 4 of Pipeline Converse. **UNKNOWN** whether ADR-0308 intends this to be retired, wrapped as domain plug-in, or specialist. |
| Pre-`nex.*` migration modules | Reframed as "misfiled" per ADR-0308 preamble | `src/lib/nex-agent/language/code-intent-registry.ts` still exists and is actively consumed by orchestrator + code-adapter. **NOT_YET_MIGRATED** — code awaits `APPLY MIGRATION` before target `nex.concepts` schema is deployed. |

---

## §6 · ADR conformance matrix

| # | Architecture requirement | ADR evidence | Current implementation | Conformance | Evidence |
|---|---|---|---|---|---|
| 1 | Canonical concept lives in `nex.concepts` | ADR-0308 Rule 1, DDL line 40 | Concept-resolver reads from `nex.concepts` (concept-resolver.ts L98-127) | **PARTIALLY_CONFORMS** | Migration status uncertain; Postgres schema DDL exists in ADR but "migration held" |
| 2 | Distinct senses in `nex.concept_senses` | ADR-0308 Rule 2, DDL line 55 | Concept-resolver reads `sense_key` (types.ts + concept-resolver.ts) | **PARTIALLY_CONFORMS** | Same migration hold |
| 3 | `sense_key` is stable canonical identifier | ADR-0308 Rule 3 | `types.ts::ResolvedConcept.chosen_sense.sense_key: string` | **CONFORMS** | Interface exists |
| 4 | Evidence/provenance attaches to sense | ADR-0308 Rule 4 | `nex.evidence` table in DDL; `nex.concept_senses` has `sense_id` FK | **PARTIALLY_CONFORMS** | Design in place; enforcement TBD |
| 5 | Chat + NEX1 use same `resolveConcept` API | ADR-0308 Rule 5 | orchestrator.ts L32-36 + code-adapter.ts L18-22 both import `resolveConcept` from `nex/language/` | **CONFORMS** | Same API in both consumer paths |
| 6 | NEX1 never creates private programming definition | ADR-0308 Rule 6 | Capability A (`nex-agent/code-engine/capability-a-founder-intent/`) contains private code-domain vocabulary (~1500 lexemes) | **DOES_NOT_CONFORM** | Capability A's vocabulary shape is knowledge, defined privately outside `nex.concepts` |
| 7 | Programming knowledge = domain doctrine layered ON TOP of shared concept | ADR-0308 Rule 7 | Capability A does not layer on shared concept — it is standalone | **DOES_NOT_CONFORM** | See row 6 |
| 8 | JSONB only for flexible metadata, not canonical store | ADR-0308 Rule 8 | Canonical store is Postgres tables per DDL | **CONFORMS** (design) | DDL in ADR does not use JSONB for canonical fields |
| 9 | Postgres authoritative · in-memory = hot tier | ADR-0308 Rule 9 | `concept-resolver.ts` L89-91: "HOT_TIER: Map · TTL 60s · disposable · rebuildable from Postgres" | **CONFORMS** | Explicit doctrine-quote in code |
| 10 | Every knowledge write via Guardian → Truth Engine | ADR-0308 Rule 10 | `guardian.ts` exists; Truth Engine wiring exists (`nex/truth-engine/*`); enforcement of evidence-link on answer promotion half-implemented | **PARTIALLY_CONFORMS** | Guardian present, evidence-link enforcement missing per Agent A findings |
| 11 | `nex.*` = knows · `nex_agent.*` = proven · never mixed | ADR-0308 Rule 11 | Capability A stores knowledge-shape data in `nex-agent/code-engine/` | **DOES_NOT_CONFORM** | Namespace violation |
| 12 | ONE shared language architecture | ADR-0309 Rule 1 | `nex/universal-intent/` is a separate classifier; runs in parallel to `nex/language/`; different verb vocabulary; independent test suite | **PARTIALLY_CONFORMS** or **DOES_NOT_CONFORM** — depends on whether ADR-0309 Rule 1 intends Universal Intent as (a) another manifestation to retire, (b) a specialist under `nex/language/`, or (c) an intentional pipeline sibling. **UNKNOWN**. |
| 13 | `nex.brain_english_vocabulary` = linguistic authority | ADR-0309 Rule 2 | Table exists per ADR-0309.1 line 57 (30 rows · CC0) | **CONFORMS** | Verified by ADR-0309.1 audit |
| 14 | `nex.concepts` + `.concept_senses` = semantic layer | ADR-0309 Rule 3 | Six tables built 2026-09-11 per ADR-0309.1 line 58 | **CONFORMS** (built) BUT ADR-0308 "migration held" — **UNKNOWN** if the built tables represent authorised state or pre-authorisation |
| 15 | People-Say is distinct translation layer with founder provenance | ADR-0309 Rule 4 | `data/nex/human-language-map.json` exists (founder-authored 2026-07-30) · not in DB · not integrated with resolver | **NOT_YET_MIGRATED** | Layer exists as founder-authored file; DB home deferred by ADR-0309 |
| 16 | `nex.questions` = canonical patterns only | ADR-0309 Rule 5 | Table exists per ADR-0308 DDL | **PARTIALLY_CONFORMS** | Schema in place; seeded rows unknown |
| 17 | `nex.question_variant` = retrieval only | ADR-0309 Rule 6 | Table exists (25,456 rows per ADR-0309 audit line 18) | **CONFORMS** | Row count evidence |
| 18 | Physical location does not determine logical authority | ADR-0309 Rule 15 · ADR-0309.1 founding doctrine | Multi-substrate reality exists (Postgres + Supabase + repo files) per ADR-0309.1 line 12 | **CONFORMS** (doctrine) | Authority matrix in ADR-0309.1 explicitly maps physical→logical |
| 19 | Migration lands only after `APPLY MIGRATION` command | ADR-0308 line 310 · ADR-0309 Gate 5 line 210 | No `db/migrations/` file for the six-table schema currently exists | **CONFORMS** (freeze respected) | Migration file absence = freeze intact |
| 20 | `src/lib/nex-agent/language/*` reframed as misfiled | ADR-0308 preamble | `code-intent-registry.ts` still exists and is consumed (orchestrator + code-adapter) | **NOT_YET_MIGRATED** | Awaiting `APPLY MIGRATION` + subsequent migration of contents to `nex.concepts` |

**Summary counts**:
- CONFORMS: 7
- PARTIALLY_CONFORMS: 6
- DOES_NOT_CONFORM: 3 (all involving Capability A · rows 6, 7, 11)
- NOT_YET_MIGRATED: 2
- UNKNOWN: 2

---

## §7 · Runtime / sentence traces (do the pathways agree with ADR architecture?)

**Trace A** · `"chuck in a new endpoint"` (from prior audit):
- Via `nex/language/`: normalise → `add endpoint` (UK slang alias) → matchQuestion → parseIntent with CODE_INTENT_REGISTRY → operational route
- **ADR conformance**: Matches Rule 5 (shared API) BUT the underlying registry (`code-intent-registry.ts`) has not yet migrated to `nex.concepts` (Rule 20 · NOT_YET_MIGRATED)

**Trace B** · `"the services are slow"` (from prior audit):
- Via `nex/language/`: normalise → `["service", "slow"]` (stopwords stripped) → no trigger match → low confidence
- **ADR conformance**: API shape correct; result poor because canonical concepts not yet seeded per Rule 1 (PARTIALLY_CONFORMS)

**Trace C** · `"what does migration mean"`:
- Via `nex/language/`: matchQuestion pattern `"what does {entity} mean"` matches → `resolveConcept("migration")` → returns `sense_key: migration.database_schema_change` (if seed present)
- **ADR conformance**: This IS the ADR-0308 flow (Rule 5 + Rule 1 + Rule 3). If seed present → **CONFORMS**. If seed absent → **NOT_YET_MIGRATED**.
- The ADR-0309.1 audit line 58 says "built 2026-09-11 · seeded 44 concepts" — so this trace likely produces the sense_key output today.

**Cross-cut observation**: `/api/nex1/intent/classify` (Capability A HTTP endpoint) does NOT flow through `resolveConcept`. It flows through Capability A's private classifier. That violates Rule 5 (shared API) and Rule 6 (no private definitions).

---

## §8 · Migration status

**FACT**:
- ADR-0308 status: `Proposed · design doc for founder review · migration held pending APPLY MIGRATION`
- ADR-0309 status: `Proposed · draft for founder review · database freeze remains in force`
- ADR-0309.1 status: `Proposed · doctrine only · database freeze in force`
- ADR-0310 status: `Proposed · doctrine only · database freeze remains in force`
- ADR-0314a status: `Proposed · audit doctrine only · database freeze in force`

**FACT** — All five ADRs marked "database freeze". No ADR marks "APPLY MIGRATION" as issued.

**FACT** — ADR-0309.1 line 58 reports six semantic tables "built 2026-09-11 · seeded 44 concepts" BUT this appears to be part of the reconciliation activity that led to ADR-0309, not the formal migration authorised by ADR-0308. The freeze followed the reconciliation.

**INFERENCE** — Postgres `nex.*` semantic schema exists physically (per ADR-0309.1 audit), but the founder's `APPLY MIGRATION` gate for the ADR-0308-authorised deployment has NOT been triggered. This is a pre-migration state where reconciliation revealed prior work; the authorised deployment pathway is separate.

**UNKNOWN** — Whether the 44 concepts currently in `nex.concepts` should be treated as authoritative or as reconciliation-artifact awaiting formal migration.

---

## §9 · Migration hold evidence

**FACT** — Migration hold is founder-controlled and specific:

- ADR-0308 line 281: *"Create the migration file · founder types `APPLY MIGRATION` first"*
- ADR-0308 line 310: *"Founder must type `APPLY MIGRATION` before the migration file lands in `db/migrations/`. Follow-up BEGINs for resolver wire-in and worker construction are each independently founder-approved."*
- ADR-0309 line 210 (Gate 5): *"Founder types `APPLY MIGRATION`. Migration lands in `nex_dev`."*

**FACT** — Prerequisites named in ADR-0309 gate sequence:
- Gate 1: Founder reads ADR → APPROVE / AMEND / REJECT
- Gate 2: Reconciliation audit complete (done)
- Gate 3: Founder approves the reconciliation
- Gate 4: Migration dry-run applied to scratch database (never `nex_dev` directly)
- **Gate 5: `APPLY MIGRATION` command issued by founder**
- Gate 6: Cross-layer linking + resolver wiring
- Gate 7: Domain plug-in seeding (business, brain intents)

**Reason for hold**: Migration is gated on founder judgment that ADR-0309 (and its dependent chain) has been fully reviewed and approved before schema hits `nex_dev`. This is explicit doctrine, not an accident.

**INFERENCE** — At the audit date (2026-09-16), no `APPLY MIGRATION` command is in evidence. The freeze remains in force. All later ADRs (0310-0314a) reaffirm the freeze.

---

## §10 · Relationship to `nex-language-architecture-doctrine.md`

**FACT** — The Language Architecture Doctrine I wrote 2026-09-16 (this session) references neither ADR-0308 nor ADR-0309. **My doctrine was written without knowledge of the ADRs.**

**FACT** — My doctrine's "canonical target architecture" (Doctrine §3) matches the ADR-0308/0309 architecture in spirit:
- User language → Canonical Language Layer → Context + Intent → Skills + Domain Specialists → Brain → Action → Answer
- One canonical layer, specialists layered above, shared context, deterministic behaviour

**INFERENCE** — The two documents converge accidentally. My session-authored doctrine is compatible with the ADRs but is NOT authoritative — the ADRs predate it and are the founder's actual decision.

**PROPOSAL** — Amend my Language Architecture Doctrine v1.0 (or supersede it with v1.1) to explicitly reference ADRs 0308 + 0309 + 0309.1 + 0310 as its authoritative source. This would prevent future work from treating my doctrine as separate from the ADR chain. **Founder decision required.**

**FACT** — The Two-Proof Rule from my doctrine is an original addition not directly in the ADRs, but it aligns with ADR-0308 Rule 10 (Guardian → Truth Engine) and ADR-0309.1 Rule 11 (governance). It should survive as complementary doctrine.

---

## §11 · Agent Recognition implications

Founder's 7-stage progression (from `project_nex_founder_locked_review_principles_2026_09_16.md`):

```
Stage 1 · Language Architecture (this audit's scope)
Stage 2 · Native Code Understanding
Stage 3 · Agent Recognition
Stage 4 · Identity
Stage 5 · NEX designation
Stage 6 · Capability testing
Stage 7 · NI classification
```

**FACT** — The ADR-0308+0309+0309.1+0310 architecture provides Stage 1 authorisation. Specifically:
- ADR-0308 provides the shared semantic substrate (`nex.concepts` + senses)
- ADR-0309 provides layered architecture (Language / Semantic / People-Say)
- ADR-0309.1 provides the Logical Authority Model (13 object types + authority matrix)
- ADR-0310 provides the Knowledge Router pattern for multi-substrate resolution

**FACT** — What the authorised architecture SOLVES for Agent Recognition (Stage 3):
- A single `resolveConcept(surface, context)` call gives all NEX components the same understanding of what a "concept" (e.g., "agent", "orchestrator", "brain") means
- Provenance and evidence attach to senses, enabling audit-trail identity
- Guardian + Truth Engine gate prevents fabricated identity claims

**FACT** — What the authorised architecture does NOT solve:
- **Structural code understanding** (Stage 2) — parsing source files, symbol graphs, import graphs, type introspection. None of the ADRs mandate this.
- **Cross-file semantic similarity** for duplication detection
- **Behaviour attribution** — "this file DOES agent-like things" requires code-level reasoning

**INFERENCE** — The ADR-authorised language architecture provides Stage 1 foundation, but Stage 2 (Native Code Understanding) requires a separate authorisation. Nothing in the current ADR chain builds structural code-understanding capability.

**PROPOSAL** — After `APPLY MIGRATION` and Stage 1 fully in place, a future ADR should scope Stage 2 (Native Code Understanding). Foundation candidates already exist (AST Semantic adapter at `nex-agent/code-engine/adapters/ast-semantic.ts`) but are not wired to Stage 1's semantic substrate.

---

## §12 · FACT / INFERENCE / UNKNOWN / PROPOSAL separation

### FACT (evidence-supported)
1. ADRs 0308, 0309, 0309.1, 0310, 0311, 0312, 0313, 0314, 0314a exist and depend on the 0308+0309 pair.
2. No later ADR supersedes 0308 or 0309.
3. All relevant ADRs are marked "Proposed" and "migration held" or "database freeze in force".
4. `APPLY MIGRATION` is a specific founder verbal command that has NOT been issued.
5. `nex/language/` code (normaliser + intent-parser + resolver + question-resolver + guardian) exists and is consumed by orchestrator + code-adapter.
6. Capability A (`nex-agent/code-engine/capability-a-founder-intent/`) contains private code-domain knowledge in `nex_agent`-namespaced path.
7. Six semantic tables (`nex.concepts` etc.) exist in `nex_dev` per ADR-0309.1 audit line 58.
8. `resolveConcept` is a shared API used by both NEX Chat (via code-adapter) and NEX1 (via orchestrator).

### INFERENCE (multi-piece conclusions)
1. The founder decision on the canonical language architecture stands.
2. Capability A violates ADR-0308 Rules 6 and 11.
3. Universal Intent's relationship to ADR-0308 is undefined and may become clearer after `APPLY MIGRATION`.
4. My Language Architecture Doctrine v1.0 converges with the ADRs accidentally, without inheriting their authority.
5. The migration hold is deliberate, not an oversight.

### UNKNOWN (insufficient evidence)
1. Whether the 44 concepts currently in `nex.concepts` are the authorised state or a reconciliation artifact.
2. Whether Universal Intent is intended to be retired, wrapped, or retained as specialist.
3. Whether `APPLY MIGRATION` is close to being issued or blocked by a specific prerequisite.
4. Whether Capability A's alpha.6-alpha.10 work should migrate, retire, or restructure.
5. Migration cost for accommodation's `IntentDefinition` → `DomainIntent` convergence.
6. State of Supabase-side `nex.*` substrate (Gate 2 audit exists but not read here).

### PROPOSAL (labelled, not decided)
1. Amend Language Architecture Doctrine v1.0 to reference the ADR chain.
2. Preserve Two-Proof Rule as complementary doctrine.
3. Defer any decisions on Universal Intent / Capability A / accommodation convergence until `APPLY MIGRATION` is issued.
4. Do NOT wire Capability A into the resolver until ADR-0308 Rule 6 is resolved by founder decision.

---

## §13 · Founder decision required

The founder critical truth rule ("Do not reopen a decision the founder has already made") is honoured. This audit does NOT propose a new canonical layer. It reports conformance status.

**Decisions the founder needs to make** (none require reversing the ADR chain):

1. **`APPLY MIGRATION` · issue or hold?** — the six-table semantic schema deployment. All later ADRs are gated on this.
2. **Resolve DOES_NOT_CONFORM rows** — Capability A (rows 6, 7, 11 of §6 matrix) violates ADR-0308 Rules 6 and 11. Decisions:
   - a) Migrate Capability A's ~1500 lexemes into `nex.concepts` under sense-keys (preserves the alpha.6-alpha.10 work)
   - b) Retire Capability A per Rule 6 (respects doctrine, discards work)
   - c) Scope-restrict Capability A to `nex_agent`-only doctrine (competency, not knowledge) — requires clear boundary
   - d) Amend ADR-0308 to permit specific code-domain private definitions (unlikely given the ADR's explicit rejection)
3. **Universal Intent status** — currently PARTIALLY_CONFORMS / UNKNOWN vs ADR-0309 Rule 1. Options:
   - a) Wrap as `DomainIntent` plug-in under `nex/language/`
   - b) Retire once `nex/language/` covers general-Q&A intents post-migration
   - c) Retain as specialist under different architectural layer
4. **Language Architecture Doctrine v1.0 relationship** — amend to reference ADR chain, or supersede with v1.1?
5. **Language Architecture Doctrine's Two-Proof Rule** — preserve as complementary NEX principle?
6. **Timing of remaining Gate work** — ADR-0309 Gates 1-7 all await founder pacing.

**Founder-authored FACT to preserve**: The canonical language architecture decision is not open. Only conformance, implementation completion, and migration timing remain.

---

## §14 · What this audit does NOT do

- Does NOT reopen the canonical-layer decision.
- Does NOT propose replacing the ADR architecture.
- Does NOT recommend deletion of any subsystem.
- Does NOT issue `APPLY MIGRATION`.
- Does NOT retire, wire, or consolidate any code.
- Does NOT commit or push.
- Does NOT promote NEX-02.
- Does NOT retire Capability A alpha.6-alpha.10 work.
- Does NOT claim NEX has capabilities it has not built.

---

**SEALED · 2026-09-16 · v1.0 · append-only · founder-directed conformance audit**

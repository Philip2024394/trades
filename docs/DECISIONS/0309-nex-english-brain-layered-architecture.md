# 0309 · NEX English Brain · Layered Architecture

**Status:** Proposed · draft for founder review · database freeze remains in force
**Founder:** Phillip · directive delivered 2026-09-11
**Amends:** ADR-0308 (NEX English Brain v1) — the six-table schema in 0308 stands, but the framing "44 concepts = the English Brain" is corrected. The English Brain is broader; 0308 defines the **semantic layer only**.
**Depends on:** `data/nex-english-source-map/reconciliation-2026-09-11.md` (evidence base)

---

## Context

Between 2026-09-10 and 2026-09-11, Master AI Engineer built the semantic layer (`nex.concepts` · `nex.concept_senses` · `nex.contexts` · `nex.questions` · `nex.answers` · `nex.evidence`) and seeded 44 concepts, treating those tables as *the* English Brain.

The founder halted expansion. A read-only reconciliation audit was performed on **all** English-related sources in the codebase and in Postgres `nex_dev`. Findings:

1. **`nex.brain_english_vocabulary`** (30 rows · hand-curated CC0 · 2026-08-28) already existed as a **linguistic vocabulary** layer — POS, CEFR level, pronunciation IPA, bilingual EN+ID definitions, register, variety, frequency rank. **It answers a fundamentally different question than `nex.concepts`.**
2. **`data/nex/human-language-map.json`** (16 staircase concepts + 6 diagnostic symptom patterns · founder-authored 2026-07-30 · Rule B "no AI authored" enforced) is a **People-Say translation** layer — how ordinary people describe canonical concepts in their own words ("wooden bit on the side" → concept:`string`).
3. **`nex.question_variant`** (25,456 rows · template-generated accommodation instances) is not canonical knowledge; it's a **retrieval asset** — canonical intent × entity × phrasing.
4. **`nex.knowledge_gap`** (6,335 rows), **`nex.knowledge_inbox`** (279 rows), **`nex.brain_english_grammar/lesson/practice/progress`** (empty schema-ready), and other tables represent runtime, staging, and reserved schemas that predate 0308.
5. **Founder-authored files** (`nex-intent-phrasings.jsonl` · 164 rows · 2026-08-03) sit orphaned outside `nex.*` and must never be silently discarded.
6. **Supabase** (two projects · `msdonkkechxzgagyguoe` and `ijvqdvsvwtwxzcqmoqit` NEX-dedicated) has not been audited. Behind a separate gate.

The correction is architectural, not tactical: **NEX has one shared language/meaning architecture with distinct layers**, not one flat English Brain and not competing English Brains. Each layer answers a different question.

## Decision

The following 14 rules are locked. They govern every future English Brain build.

### Rule 1 · One shared language/meaning architecture

NEX has ONE shared language/meaning architecture, not separate English brains for Chat and NEX1. Chat and NEX1 are two specialist roles of one NEX system (per ADR-0308 rule 5).

### Rule 2 · `nex.brain_english_vocabulary` is the linguistic vocabulary layer

`nex.brain_english_vocabulary` remains authoritative for word-level linguistic knowledge: word · POS · CEFR level · pronunciation (IPA + bilingual hint) · EN definition · ID definition · example sentences · register · variety · frequency_rank · tags · source · provenance. Its 30 rows stand. Its schema is not extended without a follow-up ADR.

### Rule 3 · `nex.concepts` + `nex.concept_senses` is the semantic layer

Concepts, distinct senses per concept, context signals, cross-concept relationships, evidence, layered status workflow. ADR-0308's six-table schema is the semantic layer. **Not renamed. Not deprecated. Not migrated into `brain_english_vocabulary`.**

### Rule 4 · People-Say is a distinct translation/resolution layer with founder provenance

The People-Say layer answers: *"How do ordinary people describe a canonical concept in their own words?"* Examples: "wooden bit on the side" → concept:`string` · "wobbly stair" → symptom:`movement_or_flex`.

Founder provenance rules from `data/nex/human-language-map.json` are inherited:
- **Rule B · no AI authored.** AI may cluster / dedupe / spot patterns but never authors People-Say entries.
- **Rule C · attributable origin.** Every entry carries `authored_by` + `verified_at`.
- **Anti-scrape rule.** NEX does not scrape the internet to populate the People-Say layer. Own customer conversations + expert authoring are the only approved sources.

The physical home of the People-Say layer (new table, JSONB in senses, or preserved as JSON file) is deferred to the eventual migration ADR. Founder decides.

### Rule 5 · `nex.questions` holds canonical question patterns, not millions of entity-specific variants

Canonical patterns are parameterised shapes ("what does {entity} mean" · "how do I add a {entity}"). Concrete entity-specific instances belong in `nex.question_variant`.

### Rule 6 · `nex.question_variant` remains supporting retrieval data

25,456 rows stay where they are. Not merged into `nex.questions`. Not renamed. Auto-generation continues per its existing pipeline.

### Rule 7 · `nex.knowledge_gap` remains runtime/operational

The gap ledger (6,335 rows) is operational state, not canonical English knowledge. Any auto-gap-ticketing added in future consumes this table rather than creating a parallel one.

### Rule 8 · `nex.knowledge_inbox` remains source/reference staging

External sources (Wikipedia, Wikivoyage, etc.) staged for extraction stay in `knowledge_inbox`. They never become canonical without passing through Guardian + Truth Engine first.

### Rule 9 · `nex_agent.*` competency remains separate from `nex.*` knowledge

Founder rule from ADR-0308 rule 11, restated. Never mixed.

### Rule 10 · No layer may silently become an alternative source of truth

Any read path that resolves a concept, question, or answer must be explicit about which layer(s) it consults. Adding a new layer requires an ADR. Extending a layer with new fields requires an ADR. Silent widening is forbidden.

### Rule 11 · Canonical knowledge ultimately passes through Guardian + Truth Engine

Every promotion from draft → `guardian_ok` → `truth_engine_ok` → `authoritative` requires the Guardian (deterministic validator) to pass and the Truth Engine to sign off. This applies to all layers: linguistic, semantic, People-Say, questions, answers.

### Rule 12 · Existing knowledge is preserved · migration is additive and reversible

No existing English knowledge row is deleted or overwritten by an English Brain migration. All migrations must be:
- **Additive.** New rows / new columns / new tables only.
- **Reversible.** Every migration has an inverse that restores the pre-state.
- **Provenance-preserving.** Founder-authored rows retain `authored_by` + `verified_at` + `source_ref` pointing to the original source file.

### Rule 13 · Empty schema-ready tables are not automatically activated

`nex.brain_english_grammar` · `nex.brain_english_lesson` · `nex.brain_english_practice` · `nex.brain_english_progress` · `nex.contradictions` · `nex.relationships` are currently empty. They exist. They imply a design that predates ADR-0308. **None are populated by English Brain work until their original design intent is documented and reconciled with this ADR.** Founder decides whether they slot into this layered architecture or are deprecated.

### Rule 14 · Supabase cannot become a second canonical NEX brain

The two Supabase projects (`msdonkkechxzgagyguoe` and `ijvqdvsvwtwxzcqmoqit`) may hold English-related data. Gate 2 (Supabase audit) is read-only. If Supabase holds canonical knowledge, it either migrates into `nex.*` (with founder approval) or stays as reference. **Never as a parallel canonical source.**

---

## Layered architecture · conceptual view

**Layers are a conceptual model, not a schema. The physical schema follows from the *relationships*.**

```
                    NEX ENGLISH / LANGUAGE ARCHITECTURE
                                  │
          ┌───────────────────────┼────────────────────────┐
          │                       │                        │
   LANGUAGE LAYER           SEMANTIC LAYER          PEOPLE-SAY LAYER
          │                       │                        │
  vocabulary              concepts / senses       founder mappings
  POS                     contexts                 natural descriptions
  CEFR                    relationships            "wooden bit on side"
  pronunciation           evidence                 → canonical concept
  EN + ID                  questions
  examples                 answers
          │                       │                        │
          └───────────────────────┼────────────────────────┘
                                  │
                           DOMAIN KNOWLEDGE
                                  │
                    programming · staircase ·
                    accommodation · food · etc.
                                  │
                                  ▼
                        RUNTIME / SUPPORTING
                                  │
              question_variant · knowledge_gap ·
              knowledge_inbox · question_index
```

## Relationship-first schema thinking (guidance for future migration design)

Rather than assuming each layer becomes an independent table hierarchy, the physical schema should follow the natural relationship graph:

```
word (linguistic properties)
   │
   ├── POS / CEFR / pronunciation / bilingual defs / examples
   │
   └── linked_to → concept
                       │
                       ├── sense A · sense B · sense C
                       │
                       ├── contexts (per sense · disambiguation)
                       │
                       ├── relationships (concept ↔ concept · sense ↔ sense)
                       │
                       ├── people_say (folk phrases → this concept, per domain)
                       │
                       ├── questions (canonical patterns that touch this concept)
                       │
                       ├── answers (per sense · answer_kind ladder)
                       │
                       └── evidence (per row · trust ladder · provenance)
```

Physical implications (deferred to migration ADR):

- A word may resolve to zero or many concepts.
- A concept may bind to zero or many words (across languages).
- A People-Say phrase resolves to exactly one concept-sense pair (with domain scoping).
- Questions may cross-reference the same concept from different phrasings.
- Every canonical write emits an evidence row.

**No physical table is committed by this ADR. Migration design is a follow-up ADR.**

## Consequences

### Positive

- **No competing brains.** The linguistic, semantic, and People-Say layers coexist by design, not by accident.
- **Founder-authored knowledge preserved.** Staircase map, intent phrasings, kitchen FAQs, trade-business FAQs — all provenance rules apply.
- **Truth Engine remains the gate.** No layer bypasses Guardian → Truth Engine.
- **NEX Chat and NEX1 share the same substrate.** ADR-0308 rule 5 upheld.
- **Additive-only migrations.** No existing English data ever silently destroyed.

### Negative

- **More complex than "one big concepts table."** Three layers plus domain plus runtime is more surface to maintain.
- **Cross-layer queries require joins.** Chat asking "what is a riser" may need linguistic (POS) + semantic (concept definition) + People-Say (homeowner phrases) all at once.
- **Requires a follow-up migration ADR** to commit physical schema.

### Rejected alternatives

- **Merge everything into `nex.concepts`.** Rejected — loses linguistic detail (POS, CEFR, pronunciation, bilingual definitions) and forces the People-Say layer into JSONB blobs.
- **Deprecate `nex.brain_english_vocabulary`.** Rejected — it holds fields the semantic schema cannot represent.
- **Deprecate `nex.concepts` in favour of `brain_english_vocabulary`.** Rejected — vocabulary has no sense-disambiguation, no cross-concept relationships, no evidence ladder, no layered status workflow.
- **Silent auto-activation of empty English tables.** Rejected — their design intent is unknown to Master AI Engineer.

## What this ADR does NOT do

- Write any SQL migration.
- Create, alter, or drop any table.
- Insert, update, or delete any row.
- Decide the physical home of the People-Say layer.
- Decide whether linguistic fields (POS, CEFR, etc.) extend into `nex.concepts` OR stay in `nex.brain_english_vocabulary` OR live in a new `nex.word_linguistics` table.
- Open Supabase (Gate 2 remains closed until founder authorises).
- Import `data/nex/human-language-map.json` or `data/nex-intent-phrasings.jsonl`.
- Modify `nex.brain_english_grammar` · `nex.brain_english_lesson` · `nex.brain_english_practice` · `nex.brain_english_progress` · `nex.contradictions` · `nex.relationships`.

All the above are deferred to their own founder-approved ADRs.

## Migration sequence (draft · gated · unexecuted)

Every step below is preceded by a founder-approval gate. Nothing runs without your typed authorisation.

- **Gate 0 · this ADR review.** Founder reads, approves or amends.
- **Gate 1 · design decisions.** Founder answers the 7 open decisions from the reconciliation report (see §Open Decisions below).
- **Gate 2 · Supabase audit.** Read-only inspection of both Supabase projects. Amend reconciliation report.
- **Gate 3 · Migration ADR draft.** Master AI writes ADR-0310 (Migration Design) — with SQL DDL, migration scripts, and rollback plans — for founder review. Still no execution.
- **Gate 4 · Migration dry-run.** Migration applied to a scratch database (never `nex_dev` directly). Founder validates outputs.
- **Gate 5 · Migration apply.** Founder types `APPLY MIGRATION`. Migration lands in `nex_dev`.
- **Gate 6 · Cross-layer linking + wiring.** `resolveConcept` extended to consult linguistic + People-Say layers as well.
- **Gate 7 · Retire deprecated (only if founder decides so).** Nothing marked deprecated by Master AI unilaterally.

## Open decisions (Gate 1 blockers · founder input required)

1. **Confirm the four-layer target architecture** (Language + Semantic + People-Say + Domain) is correct as drawn.
2. **Linguistic-field home.** POS, CEFR, pronunciation, EN↔ID: (a) extend `nex.concepts`, (b) stay in `nex.brain_english_vocabulary` linked via a new `nex.concept_word_links` bridge, or (c) new `nex.word_linguistics` table.
3. **People-Say home.** (a) new `nex.people_say_translations` table, (b) JSONB in `nex.concept_senses.examples`, or (c) keep as JSON file · reference only.
4. **Empty tables.** `nex.brain_english_grammar/lesson/practice/progress` — original design intent? Reserved for future or absorb into new architecture?
5. **Founder-authored orphans.** `data/nex/human-language-map.json` + `data/nex-intent-phrasings.jsonl` — target home, target time.
6. **Supabase gate opening.** When?
7. **Migration ADR draft.** Do you want ADR-0310 drafted immediately after decisions 1-5 are answered, or wait until after Gate 2 (Supabase audit)?

## References

- ADR-0308 · NEX English Brain v1 (the semantic-layer schema · this ADR amends its framing)
- ADR-0300 · NEX own storage migration blueprint (Supabase migration doctrine)
- ADR-0028 · NEX Intelligence Constitution (immutable · every LLM output verified before authoritative)
- `data/nex-english-source-map/reconciliation-2026-09-11.md` · the read-only audit that produced this ADR
- `data/nex-english-source-map/reconciliation-evidence.json` · full 30-word vocabulary + 44 concepts + 51 senses evidence dump

## Freeze status

**Database freeze remains in force.** No `nex.*` writes. No `brain_english_vocabulary` writes. No new tables. No new migrations. No source-file imports. Founder-authored orphan files (`human-language-map.json` · `nex-intent-phrasings.jsonl` · `kitchen/faqs.jsonl` · `trade-business/faqs.jsonl`) remain in the repo untouched.

The freeze ends only when the founder explicitly authorises Gate 3 (Migration ADR draft) and Gate 5 (Migration apply).

---

# Amendment · 2026-09-11 · Post-Gate-2 (Supabase audit)

**Status:** Amendment appended · does not supersede the body above · founder-authorised
**Basis:** Gate 2 read-only audit of both Supabase projects. See `data/nex-english-source-map/gate-2-supabase-audit.md` for the raw evidence.

## New architectural fact (Gate 2 discovery)

A **canonical Domain Knowledge substrate already exists** in the NEX-dedicated Supabase project (`ijvqdvsvwtwxzcqmoqit` · founder-authorised 2026-08-02). It predates ADR-0308. It has been running independently of `nex_dev`. It carries its own governance (status ladder AUTHORITATIVE / DRAFT / DEPRECATED), its own provenance layer, its own Truth Engine primitive (contradiction detection is live), and 402 rows of founder judgments.

### Existing Domain Knowledge substrate · inventory

| Table (Supabase NEX-dedicated) | Rows | Purpose in the substrate |
|---|---:|---|
| `knowledge_records` | 3,627 | Primary domain-knowledge record substrate · Markdown records with `status` (AUTHORITATIVE/DRAFT/DEPRECATED) · `canonical_owner` · `authored_by` · `authorised_by` · `reviewed_by` · `supersedes` · versioned |
| `sources` | 3,625 | Provenance ledger (likely 1:1 with knowledge_records) |
| `graph_edges` | 4,308 | Knowledge relationships between records |
| `confidence_scores` | 4,228 | Trust / confidence metadata per record |
| `record_versions` | 22 | Version history |
| `audit_log` | 20,224 | Audit history for every canonical change |
| `knowledge_feedback` | 402 | Founder governance · Philip's judgments on records · `feedback_kind` · `severity` · `applied_to_prompts` |
| `contradictions` | 8 | **Active Truth Engine primitive** · real detections by `quality-checker@677` |
| `deprecations` | 0 | Deprecation ledger (empty · schema-ready) |
| `claim_requests` | 0 | (empty · schema-ready) |
| `llm_retry_queue` | 0 | (empty · schema-ready) |

Worker/job tables (`worker_results` 19,140 · `worker_jobs` 19,167 · `worker_heartbeats` 50) and directory/URL tables (`directory_seeds` 1,227 · `nex_collection_url_queue` 301 · `nex_collection_fetch_errors` 170) are **operational infrastructure**, not canonical knowledge.

### Main Supabase project · INACCESSIBLE

`msdonkkechxzgagyguoe.supabase.co` — audited via four legitimate read-only paths (host root, REST anon, REST service_role, auth health). All four return network-level `fetch failed`. Not authentication failure. Likely paused / deprecated. **The commented rollback URL in `.env.local` also points at `ijvqdvsvwtwxzcqmoqit`, so "rollback" was already the dedicated project.** Recorded as inaccessible. Not chased further per founder rule ("Don't spend hours chasing a dead/paused system just because it exists").

## Founder-confirmed classifications

3. **`knowledge_records` = CANONICAL DOMAIN KNOWLEDGE SUBSTRATE** · with founder qualification: *the table is canonical at the substrate level; individual record authority is determined by each row's status/governance fields*. Do not treat all 3,627 rows as AUTHORITATIVE. The status ladder governs.
4. **`knowledge_feedback` = FOUNDER-AUTHORED GOVERNANCE** · sibling to the repo JSON orphans. Preserved. Never silently discarded.

## New locked rule (added to the 14 in the body)

### Rule 15 · Physical storage location does not determine logical knowledge authority

NEX may have multiple physical storage substrates (Supabase, Postgres `nex_dev`, JSON files in repo). NEX must maintain **one logical authority per knowledge object and per knowledge layer**, even if implementation currently spans multiple physical stores.

Consequence for readers: any code that resolves knowledge must be explicit about which physical store(s) it consults AND about which is the logical authority. Chat MUST NOT read one store while NEX1 reads another for the same concept.

Consequence for writers: promoting a knowledge object from draft → authoritative requires the logical-authority path (Guardian → Truth Engine) regardless of which physical store the row lives in.

## Updated layered architecture

```
                    NEX BRAIN
                       │
       ┌───────────────┼────────────────┐
       │               │                │
   LANGUAGE        SEMANTIC        PEOPLE-SAY
   LAYER            LAYER            LAYER
       │               │                │
 vocabulary       concepts/senses    founder mappings
 POS              contexts           natural language
 CEFR             relationships
 pronunciation    questions
 EN/ID            answers
 examples         evidence
       │               │                │
       └───────────────┼────────────────┘
                       │
                DOMAIN KNOWLEDGE
                       │
              ┌────────┴──────────┐
              │                   │
       Supabase substrate    NEX-operational
       knowledge_records     domain systems
       sources               accommodation
       graph_edges           food
       confidence_scores     staircase
       record_versions       trades
       audit_log             etc.
       knowledge_feedback
       contradictions

                    ▲
                    │
         Physical storage boundary
              is NOT the
        logical authority boundary
```

The English Brain remains: **Language → Semantic → People-Say → Domain**. Conceptual layers, not physical schemas.

## New architectural question · to be answered BEFORE any ADR-0310 draft

*"What should become the authoritative runtime substrate for NEX knowledge, and how do we unify the physical systems without destroying provenance, governance, contradictions, versions, or founder decisions?"*

Master AI does NOT assume ADR-0310 = "migrate Supabase into `nex.*`". That would be the wrong question. The right question is unification of logical authority, not physical consolidation.

Ten pre-migration architectural questions (unanswered · founder decides · each blocks ADR-0310):

1. Which knowledge objects belong in the semantic layer vs the domain-knowledge layer?
2. Which physical store is the logical authority for each layer today?
3. Which provenance structures (`sources` · `evidence`) must remain attached to which objects?
4. How does founder governance (`knowledge_feedback` · `authorised_by`) follow a knowledge object across physical stores?
5. How do contradictions follow a knowledge object across physical stores?
6. How do confidence scores follow a knowledge object?
7. How do versions follow a knowledge object?
8. How is Truth Engine authority preserved across physical stores?
9. How do Supabase and Postgres coexist temporarily without becoming competing sources of truth?
10. What is the eventual logical-authority model?

Only after these are answered does Master AI draft ADR-0310. ADR-0310 will describe the logical-authority model, the physical topology, and the migration/unification path — not just "move rows."

## Deferred (still frozen)

The English schema questions from the reconciliation report remain deferred:

- Where linguistic fields (POS · CEFR · pronunciation · EN↔ID) physically live
- Where People-Say physically lives (new table · JSONB · JSON file)
- Whether empty schema-ready tables (`brain_english_grammar` · `brain_english_lesson` · `brain_english_practice` · `brain_english_progress` · `contradictions` in `nex_dev` · `relationships` in `nex_dev`) are revived

Rationale: these are physical-schema decisions. The Gate 2 discovery has widened the scope from "how do we build the English Brain?" to "how does the English Brain become one layer of the larger NEX knowledge architecture that already exists?" Physical-schema decisions come AFTER the logical-authority model is settled.

## Freeze status · post-amendment

- Hard freeze on all writes to `nex.*` **and** all writes to Supabase.
- No import of any Supabase row into `nex_dev`.
- No import of any `nex_dev` row into Supabase.
- No modification of any Supabase table.
- No modification of any `nex_dev` table.
- No source-file imports (repo JSON orphans stay put).
- No canonical-status changes on any row anywhere.
- Gate 3 CLOSED.

## What Master AI does NEXT (upon founder request)

Master AI does not act. It waits for founder instruction. Legitimate next moves from here:

- **A.** Draft the Logical Authority Model (LAM) doctrine as an appended addendum to this ADR (or as ADR-0309.1). Answers questions 1-10 above at the doctrine level only, still zero SQL.
- **B.** Attempt a limited follow-on Supabase read (specific tables sampled deeper if founder wants to see actual `knowledge_records` category distribution, contradiction status breakdown, etc.).
- **C.** Compile a cross-substrate row-level overlap analysis between Supabase `knowledge_records` and any `nex_dev` domain tables (business_knowledge, brain_did_you_know_indonesia, brain_attractions) to find hidden duplicates.
- **D.** Something else the founder specifies.

Freeze remains in force in all four paths.

---

**End of 2026-09-11 amendment.**

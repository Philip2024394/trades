# NEX English Brain · Reconciliation Report

**Date:** 2026-09-11
**Author:** Master AI Engineer (report only · zero DB writes · zero source imports)
**Founder authorization for this document:** "continue" (produce reconciliation before any migration)
**Hard rule respected:** NO DATA MIGRATION · NO DELETIONS · NO DEPRECATION · NO CANONICAL STATUS CHANGES · NO IMPORTS · NO ALTERATION OF EXISTING ENGLISH KNOWLEDGE

This document answers a single question:

> "For every piece of English knowledge NEX already possesses, where does it live, what is it, whether it is authoritative, whether it is duplicated, and what — if anything — should move into the canonical English Brain?"

---

## 1. Complete English Source Map

### 1.1 In-database sources (Postgres · nex_dev)

| Source | Rows | Author / Origin | Structure | Classification | Notes |
|---|---:|---|---|---|---|
| `nex.brain_english_vocabulary` | 30 | `corpus_layer1` · seed_v1 · 2026-08-28 · CC0 · file `data/nex-english-vocab-seed-v1.json` | word · POS · CEFR · def_en · def_id · pronunciation_ipa · examples · tags · register · variety · frequency_rank | 🟢 **CANONICAL · LINGUISTIC LAYER** | General A1 English · EN+ID bilingual · older schema than nex.concepts |
| `nex.concepts` | 44 | `master_ai_engineer` · 2026-09-11 | canonical_key · display_name · layer(1-5) · status | 🟢 **CANONICAL · SEMANTIC LAYER** | Programming + NEX meta terms |
| `nex.concept_senses` | 51 | Same | concept_id · sense_key · description · domain_hint[] · confidence · status | 🟢 **CANONICAL · SEMANTIC LAYER** | Multi-sense per concept |
| `nex.contexts` | 224 | Same | sense_id · surface_signal · signal_kind · weight | 🟢 **CANONICAL · SEMANTIC LAYER** | Deterministic disambiguation |
| `nex.questions` | 60 | Same · Layer 2 seed | surface_pattern · intent_slug · entity_slots · concept_id · answer_type · confidence · status | 🟢 **CANONICAL · QUESTIONS LAYER** | Regex-compilable patterns |
| `nex.answers` | 62 | Same · 51 definitions + 11 steps | sense_id · question_id · body · answer_kind · confidence · status | 🟢 **CANONICAL · ANSWERS LAYER** | |
| `nex.evidence` | 173 | Same · every write emits one | subject_kind · subject_id · source_ref · trust_layer · confidence · captured_by · cycle_run_id | 🟢 **CANONICAL · PROVENANCE LAYER** | |
| `nex.relationships` | 0 | Schema-ready · unused | source/target concept_id · relation_kind · confidence | 🟢 **CANONICAL · SEMANTIC LAYER** (empty) | |
| `nex.question_variant` | **25,456** | Template-generated · 2026-09-09 | fingerprint · domain · entity_ref · intent_slug · raw_text · normalised_text · required_fact_slugs · trust · reply_kind | 🔷 **SUPPORTING · RETRIEVAL/RUNTIME** | 100% accommodation · concrete instances (property × intent × phrasing) |
| `nex.semantic_question_index` | 4,000 | | | 🔷 **SUPPORTING · RETRIEVAL** | Semantic search index over question_variant |
| `nex.knowledge_gap` | 6,335 | source=`verifier` · 2026-09-09 | gap_id · domain · entity_ref · intent_slug · times_seen · resolved_at | 🔶 **RUNTIME · OPERATIONAL** | Accommodation gap ledger |
| `nex.knowledge_inbox` | 279 | Wikipedia/Wikivoyage crawls · 2026-08-27+ | title · url · preview_text · truth_class · brain_slug · content_path | 🔷 **SUPPORTING · REFERENCE MATERIAL** | External sources staged for extraction |
| `nex.brain_did_you_know_indonesia` | 39 | | | 🔷 **SUPPORTING · DOMAIN FACTS** | Indonesia knowledge |
| `nex.brain_attractions` | 32 | | | 🔷 **SUPPORTING · DOMAIN FACTS** | Attraction knowledge |
| `nex.brain_english_grammar` | 0 | | | ⏸ **CANONICAL · LINGUISTIC LAYER (empty)** | Schema-ready · unused |
| `nex.brain_english_lesson` | 0 | | | ⏸ **CANONICAL · LINGUISTIC LAYER (empty)** | Schema-ready · unused |
| `nex.brain_english_practice` | 0 | | | ⏸ **CANONICAL · LINGUISTIC LAYER (empty)** | Schema-ready · unused |
| `nex.brain_english_progress` | 0 | | | ⏸ **RUNTIME · LEARNER PROGRESS (empty)** | Schema-ready · unused |
| `nex.conv_intents` | 22 | | | 🔷 **SUPPORTING · RUNTIME** | Conversation-derived intents |
| `nex.conv_knowledge_items` | 890 | | | 🔷 **SUPPORTING · RUNTIME** | Chat-derived knowledge |
| `nex.business_knowledge` | 1,258 | | | 🔷 **SUPPORTING · DOMAIN FACTS** | Business-domain knowledge (trades) |
| `nex.contradictions` | 0 | Schema-ready · unused | | ⏸ **RUNTIME (empty)** | For contradiction detection |
| `nex.entity_index` | 877 | | | 🔷 **SUPPORTING · RETRIEVAL** | |

### 1.2 In-repo sources (files · not in DB)

| Source | Path | Rows | Author | Structure | Classification | Notes |
|---|---|---:|---|---|---|---|
| Human-Language Map (Staircase) | `data/nex/human-language-map.json` | 16 concepts + 6 symptoms | **Philip O'Farrell** · 2026-07-30 · expert-authored | trade_term · people_say[] · nex_response_style · reflex_entry_exists · authored_by · verified_at | 🟠 **ORPHANED CANONICAL** · founder-authored | Full inventory below. Governance: Rule B (no AI authored) · Rule C (attributable). **Never silently discard.** |
| Intent Phrasings | `data/nex-intent-phrasings.jsonl` | 164 | **Philip** · 2026-08-03 | phrasing · layer1_verb · layer2_domain · layer3_capability · authored_by · captured_at | 🟠 **ORPHANED CANONICAL** · founder-authored | Wide-domain: Create/Communicate/Decide × Design/Website/Marketing/Business/Staircase/Kitchen/Interior Design/Construction/Home/Sales/Finance/Personal/Customer Service |
| Eval Questions (Staircase golden path) | `data/nex/eval/questions.json` | 40 Q&A | Human-approved test set | question · intent · expected_answer | 🔷 **SUPPORTING · TEST FIXTURE** | Golden-path evaluation |
| Kitchen FAQs | `data/nex-knowledge/kitchen/faqs.jsonl` | 50+ | Philip · 2026-08-03 | Q&A · audience level · category | 🔷 **SUPPORTING · DOMAIN FAQ** | Kitchen brain material · not English brain |
| Trade Business FAQs | `data/nex-knowledge/_shared/trade-business/faqs.jsonl` | 13 | Philip · 2026-08-03 | Q&A | 🔷 **SUPPORTING · CROSS-DOMAIN FAQ** | Trade process FAQs |
| Accommodation Intent Registry | `src/lib/nex/intelligence-storage-grid/accommodation/intent-registry.ts` | 50 intents | 2026-09-09 · Founder Phase 3.2 | slug · display_en · display_id · answer_kind · canonical_fields · evidence_field_names · freshness_class | 🔷 **SUPPORTING · DOMAIN-SCOPED** | Accommodation intent taxonomy. Stays put (correctly located) |
| Accommodation Language Normaliser | `src/lib/nex/intelligence-storage-grid/accommodation/language-normaliser.ts` | ~180 aliases (EN + ID + slang) | 2026-09-09 | alias → canonical token | 🔷 **SUPPORTING · DOMAIN PREPROCESSING** | Accommodation-scoped. Stays put |
| Phrasing Templates | `src/lib/nex/live-chat-completion/question-factory/phrasing-templates.ts` | ~110 templates | | intent · language · template | 🔷 **SUPPORTING · GENERATION** | Feeds nex.question_variant |
| UK Slang Aliases | `src/lib/nex/language/slang-en-gb.ts` | ~140 aliases | 2026-09-10 | alias → canonical token | 🔷 **SUPPORTING · PREPROCESSING** | Cross-domain normaliser input |
| Stopwords EN-GB | `src/lib/nex/language/stopwords-en-gb.ts` | ~50 words | 2026-09-10 | Set | 🔷 **SUPPORTING · PREPROCESSING** | |
| Language Corpus Audit (test) | `src/lib/nex/brain/_language-corpus-audit.test.ts` | 400 sentences | | 12 families A-L | 🔷 **SUPPORTING · TEST FIXTURE** | Observation-only |
| English Vocab Seed | `data/nex-english-vocab-seed-v1.json` | 30 words | `corpus_layer1` · 2026-08-28 | Same as `nex.brain_english_vocabulary` | 🟢 **CANONICAL SOURCE FILE** | This IS the origin of the DB rows. Already imported. |

### 1.3 External · Supabase (BEHIND SEPARATE GATE · not audited this phase)

- `msdonkkechxzgagyguoe.supabase.co` — main Supabase project
- `ijvqdvsvwtwxzcqmoqit.supabase.co` — NEX-dedicated Supabase project (Philip 2026-08-02)
- Migration files at `supabase/migrations/` — accommodation persister, food business persister, workforce, etc.
- Founder directive: "Do not connect Supabase yet."

---

## 2. Two-Schema Comparison

### 2.1 The linguistic layer schema — `nex.brain_english_vocabulary`

| Field | Type | Purpose | In semantic layer? |
|---|---|---|---|
| `word` | text | The English word | ❌ (only `canonical_key` which is a slug) |
| `word_normalised` | text | Search key | ❌ |
| `part_of_speech` | text | noun/verb/adjective/adverb/etc | **❌ MISSING FIELD** |
| `cefr_level` | text | A1/A2/B1/B2/C1/C2 | **❌ MISSING FIELD** |
| `definition_en` | text | English definition | Approximate match: senses.description (but only one per sense) |
| `definition_id` | text | Indonesian definition | **❌ MISSING FIELD** |
| `pronunciation_ipa` | text | IPA phonetic | **❌ MISSING FIELD** |
| `pronunciation_id_hint` | text | Bilingual pronunciation hint | **❌ MISSING FIELD** |
| `example_sentence_en` | text | Usage example (EN) | Approximate: senses.examples JSONB (but generic) |
| `example_sentence_id` | text | Usage example (ID) | **❌ MISSING FIELD** |
| `common_mistake_note_id` | text | Learner mistake note | **❌ MISSING FIELD** |
| `register` | text | formal/informal/slang | **❌ MISSING FIELD** |
| `variety` | text | British/American/Aus/Ind English | **❌ MISSING FIELD** |
| `tags` | text[] | Free-form tags | Approximate: senses.domain_hint[] |
| `frequency_rank` | integer | Word frequency ranking | **❌ MISSING FIELD** |
| `source` | text | Origin identifier | `evidence.source_ref` |
| `source_reference` | text | Specific source path | `evidence.source_ref` |
| `source_licence_terms` | text | Legal notes | **❌ MISSING FIELD** |
| `created_by` | text | Author | `evidence.captured_by` |
| `confidence` | integer 0-100 | Trust level | `concepts.confidence` numeric 0-1 (scale mismatch) |
| `flagged_for_review` | boolean | Human-review flag | Approximate: status='draft' |

### 2.2 The semantic layer schema — `nex.concepts` + `nex.concept_senses` + `nex.contexts` + `nex.relationships`

| Field | Type | Purpose | In linguistic layer? |
|---|---|---|---|
| `concepts.canonical_key` | text | Concept identifier (slug) | ❌ (uses `word` instead) |
| `concepts.display_name` | text | Human-readable label | Approximate: `word` |
| `concepts.layer` | smallint 1-5 | Which knowledge layer (progressive growth) | **❌ MISSING FIELD** |
| `concepts.status` | text | Workflow (draft/guardian_ok/truth_engine_ok/authoritative/deprecated) | Approximate: `flagged_for_review` boolean (much simpler) |
| **Multiple `senses` per concept** | rows in concept_senses | One word has multiple meanings | **❌ MISSING** — vocab is one word → one definition |
| `senses.sense_key` | text | Stable canonical id per meaning | **❌ MISSING FIELD** |
| `senses.description` | text | Description of THIS sense | Approximate: `definition_en` (but flat) |
| `senses.domain_hint` | text[] | Which domain(s) this sense belongs to | Approximate: `tags[]` |
| `senses.examples` | jsonb | Flexible examples per sense | Approximate: `example_sentence_en/id` (flat) |
| `senses.status` | text | Workflow | Approximate: `flagged_for_review` |
| `contexts.surface_signal` | text | Disambiguation trigger | **❌ MISSING** — vocab doesn't disambiguate |
| `contexts.signal_kind` | text | Type of disambiguation (cooccur_token/phrase/domain_hint/grammatical_role) | **❌ MISSING FIELD** |
| `contexts.weight` | numeric | Signal strength | **❌ MISSING FIELD** |
| `relationships.relation_kind` | text | synonym/antonym/hypernym/hyponym/related/domain_of/derived_from/part_of | **❌ MISSING FIELD** — vocab has no inter-word relationships |
| `relationships.source_sense_id` / `target_sense_id` | uuid | Sense-level relationships | **❌ MISSING FIELD** |
| `evidence` per row | 173 rows | Provenance ladder | Approximate: `source` + `source_reference` (flat) |

### 2.3 Verdict on the two schemas

**They are NOT competing brains. They model different aspects.**

- **Linguistic layer** = *word-level* knowledge: how English works as a language (POS, CEFR, pronunciation, bilingual mapping, examples, register).
- **Semantic layer** = *concept-level* knowledge: what concepts *mean* (multi-sense, contextual disambiguation, relationships between concepts, domain scoping, layered status workflow, evidence).

**A hypothetical merge would LOSE either linguistic detail or semantic richness.** Neither schema strictly contains the other.

---

## 3. Row-Level Overlap Report

### 3.1 Cross-hit query (Postgres · READ ONLY)

Query: `SELECT v.word FROM nex.brain_english_vocabulary v JOIN nex.concepts c ON c.canonical_key = LOWER(v.word) OR c.canonical_key = v.word_normalised`

**Result: 0 rows.** No word in the vocabulary is a canonical_key in the semantic layer, and no concept is a bare English word from the vocabulary.

This confirms the two layers cover **disjoint conceptual space**:

| Vocab words (linguistic · 30) | Concept keys (semantic · 44) |
|---|---|
| afternoon, day, evening, excuse me, goodbye, hello, here, how, later, month, morning, night, no, now, please, sorry, thank you, there, today, tomorrow, week, what, when, where, which, who, why, year, yes, yesterday | api, auth, branch, brief, bug, cache, column, commit, component, config, cookie, cron, dependency, doctrine, endpoint, environment, founder, git, hook, index, log, middleware, migration, model, nex, nex1, nextjs, package, plan, postgres, prop, pull_request, refactor, route, schema, secret, session, state, table, test, typescript, vitest, worker, worktree |
| **General A1 English · everyday words** | **Programming + NEX meta domain-specific terms** |

### 3.2 `data/nex-intent-phrasings.jsonl` vs `nex.questions`

**Not a row-level duplicate.** The two do NOT hold the same shape of data:

- `nex-intent-phrasings.jsonl` — **concrete phrasings** with layered classification (verb/domain/capability). Example: `"design my logo" → Create/Design/Design`.
- `nex.questions` — **canonical surface patterns** with `{entity}` placeholders + regex compilation. Example: `"what does {entity} mean" → explain intent`.

They are complementary. The 164 phrasings could seed the same table as canonical *starting points* (with entity_slots empty and intent_slug set) but their structure needs transformation.

**Row-level overlap risk:** low. Sample check of first 30 phrasings vs my 60 patterns · zero exact string matches.

### 3.3 `data/nex/human-language-map.json` (staircase) vs anything

**Zero row-level duplicate.** Staircase is a domain not covered by my 44 concepts. Zero risk of duplicate keys.

---

## 4. Founder Knowledge Inventory (personally authored · must preserve)

| Source | Rows | When | Verified? |
|---|---:|---|---|
| `data/nex/human-language-map.json` — 16 staircase concepts | 16 | 2026-07-30 | ✓ Philip O'Farrell |
| `data/nex/human-language-map.json` — 6 symptom people_say seeds | 6 | 2026-07-30 | ✓ Philip · seeded from router pattern |
| `data/nex/human-language-map.json` — 6 symptom probable_causes | 0 (empty) | Pending | ⏸ **Awaiting expert authoring** |
| `data/nex-intent-phrasings.jsonl` | 164 | 2026-08-03 | ✓ Philip |
| `data/nex-knowledge/kitchen/faqs.jsonl` | 50+ | 2026-08-03 | ✓ Philip |
| `data/nex-knowledge/_shared/trade-business/faqs.jsonl` | 13 | 2026-08-03 | ✓ Philip |

**Total founder-authored English knowledge NOT in nex.***: **~249 items across four files.**

All four files carry provenance (`authored_by`, `verified_at` or equivalent). None have been ingested. All must be preserved even in the read-only phase — no rename, no move, no reformat.

---

## 5. Recommended Target Architecture

Matches your diagram. All five layers:

```
                    NEX BRAIN
                       │
             ┌─────────┴─────────┐
             │                   │
       LANGUAGE LAYER       SEMANTIC LAYER
             │                   │
   word · POS · CEFR         concepts · senses
   pronunciation             contexts · relationships
   EN ↔ ID definitions       meanings · disambiguation
   examples · register       evidence · status ladder
             │                   │
             │              (concept/sense identifier
             │               shared across domains)
             │                   │
             └─────────┬─────────┘
                       │
              PEOPLE-SAY LAYER
              (folk phrases → concept · per-domain)
              e.g. "wooden bit on side" → concept:string
                       │
                       ▼
                DOMAIN KNOWLEDGE
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
Programming       Staircase           Accommodation
(nex.concepts     (human-language-    (accommodation
 filtered by       map.json ·          intent-registry ·
 domain_hint)      trade-terminology)  fact-computer)
    │                  │                  │
    └──────────────────┼──────────────────┘
                       │
                QUESTIONS · INTENTS
    ┌──────────────────┼──────────────────┐
    │                  │                  │
canonical patterns  concrete variants  templates
(nex.questions      (nex.question_     (phrasing-
 60 patterns ·       variant · 25,456   templates.ts
 my Layer 2)         auto-generated)    per-domain)
                       │
                       ▼
                ANSWERS · FACTS
                (nex.answers ·
                 domain-facts tables)
                       │
                       ▼
             TRUTH ENGINE · GAP LEDGER
                (nex.evidence ·
                 nex.knowledge_gap ·
                 nex.knowledge_inbox ·
                 nex.contradictions)
```

**Key architectural insight:** a **concept** in the semantic layer can be *linked* to zero or more **words** in the linguistic layer, and *linked* to zero or more **people-say phrasings** in the folk layer, and *linked* to zero or more **question patterns** in the questions layer. The linking is what makes it one brain rather than five parallel brains.

---

## 6. Proposed Migration Sequence (DRAFT · not executed)

Every step below is preceded by a founder-approval gate. Master AI writes NOTHING until each gate opens.

### Gate 0 · Founder review of this reconciliation report (current gate)
- Read this document
- Decide whether the architecture is correct
- No action until approved

### Gate 1 · Design (drafts only · no code · no SQL)
- Draft ADR-0309 · "NEX English Brain · Language + Semantic + People-Say layered architecture"
- Draft schema additions:
  - `nex.concept_word_links` (many-to-many between `nex.concepts` and `nex.brain_english_vocabulary`)
  - `nex.people_say_translations` (folk phrase → concept mapping · replaces `human-language-map.json` if approved)
  - Missing linguistic fields added to `nex.concepts` OR held in the linguistic layer (founder decides)
- Founder approves ADR before Gate 2 opens

### Gate 2 · Supabase audit (parallel · own BEGIN)
- Read-only inspection of `ijvqdvsvwtwxzcqmoqit.supabase.co`
- Inventory English-related tables
- Amend this report if new sources found
- No writes to Supabase

### Gate 3 · Founder-authored orphans import (staircase + phrasings)
- Only after Gates 1 + 2 pass
- Draft import scripts (unapplied)
- Founder types APPLY MIGRATION per file
- Preserve provenance in `evidence` rows citing original source_ref

### Gate 4 · Cross-layer linking
- Populate `nex.concept_word_links` where semantically appropriate
- Populate `nex.people_say_translations` from staircase map
- Populate `nex.relationships` where synonymy detected

### Gate 5 · Semantic Q&A wiring
- Extend resolveConcept + matchQuestion to consult all three layers
- Prove it: "what does riser mean?" (chat) and "add a riser part to the schema" (nex-agent) resolve to same concept · linked to both linguistic word and people-say phrases

### Gate 6 · Retire deprecated (only if approved)
- If Founder decides certain sources are obsolete, mark deprecated (never delete)

---

## 7. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Silent brain competition — brain_english_vocabulary AND nex.concepts both grow independently, both claim canonical | 🔴 HIGH | Freeze both until Gate 1 ADR approves the layered architecture. ✅ Already done. |
| 2 | Founder-authored files silently discarded during a naive import | 🔴 HIGH | Hard rule: every founder-authored row preserves `source_ref` pointing at original file. Original files are NEVER deleted. |
| 3 | Question_variant (25,456) confused with canonical questions | 🟡 MEDIUM | Classification already recorded (`SUPPORTING · retrieval/runtime`). Do NOT merge into nex.questions. |
| 4 | Missing linguistic fields (POS, CEFR, pronunciation) cannot be represented in nex.concepts as-is | 🟡 MEDIUM | Either extend nex.concepts schema (Gate 1 ADR decision) OR keep linguistic layer separate with `nex.concept_word_links`. |
| 5 | Supabase contains a THIRD parallel English brain not yet inspected | 🟡 MEDIUM | Gate 2 (Supabase audit) happens before any import. |
| 6 | Empty schema-ready tables (`brain_english_grammar`, `brain_english_lesson`, `brain_english_practice`, `brain_english_progress`, `contradictions`, `relationships`) suggest a wider planned architecture that Master AI hasn't seen the design for | 🟡 MEDIUM | Ask founder whether these empty tables have an intended schema/design doc that predates my nex.concepts work. |
| 7 | The 25,456 question_variant rows are 100% accommodation domain · widening to other domains requires deliberate design | 🟢 LOW | Not English-brain concern · noted for future work. |
| 8 | Ambiguous concepts (migration has 3 senses) exist in semantic layer but linguistic layer has flat definition — bilingual users may see mismatch | 🟢 LOW | Design layered access: linguistic first, then semantic disambiguation. |

---

## 8. Open Founder Decisions (Gate 1 blockers)

Master AI does not choose. All decisions below are for you.

1. **Confirm the four-layer target architecture** (Language + Semantic + People-Say + Domain) is correct? Any layers missing? Any layers to remove?
2. **Where do linguistic fields (POS, CEFR, pronunciation, EN↔ID) live?**
   - a. Extended into `nex.concepts` (single table · loses schema clarity)
   - b. Stay in `nex.brain_english_vocabulary` · linked via new `nex.concept_word_links` (recommended per your framing)
   - c. Third table `nex.word_linguistics` fresh · migrate 30 rows
3. **Where does the People-Say layer live?**
   - a. New table `nex.people_say_translations`
   - b. Extended into `nex.concept_senses.examples` JSONB (loses queryability)
   - c. Keep as JSON file · reference only until Reflex Brain formalised
4. **Question variants (25,456 rows) — leave completely alone?** (My recommendation: YES. They serve retrieval, not canonical.)
5. **Empty schema-ready tables** (`brain_english_grammar` etc.) — do they have a pre-existing design I should honour, or can I treat them as reserved-for-future?
6. **Supabase audit — when to open Gate 2?** (Master AI awaits explicit "audit Supabase" instruction.)
7. **ADR-0309 draft — do you want me to draft it now, or after decisions 1-6?**

---

## 9. Confidence Score

| Dimension | Score | Basis |
|---|---:|---|
| Postgres nex_dev inventory | **99%** | 272 tables scanned · all English-related tables sampled |
| Repo file inventory | **90%** | Deep glob + grep via Explore agent · may have missed archived branches |
| Supabase inventory | **0%** | Not opened (founder-gated) |
| Two-schema comparison | **95%** | Full schema dump from information_schema |
| Row-level overlap | **95%** | Direct SQL cross-check · sample compare on phrasings |
| Founder-authored inventory | **95%** | All authored_by=philip files identified with row counts |
| Missing-field analysis | **95%** | Field-by-field comparison |
| Target architecture | **75%** | Confidence in the shape · uncertainty in schema details until founder decides |
| Migration sequence | **65%** | Draft only · every gate requires founder approval |

**Overall confidence in reconciliation completeness (pre-Supabase):** **85%**.

---

## 10. What Master AI recommends next

Master AI does not act. It recommends. You choose.

Two recommended next-turn options in order of value:

**A.** Draft ADR-0309 (Layered English Brain architecture) capturing decisions 1-6 above. No SQL. Founder reviews ADR before any writes.

**B.** Open Supabase audit (Gate 2). Read-only inspection of both Supabase projects for English tables. Amend this reconciliation report with findings. No writes.

Both keep the freeze in place. Either can happen without touching any existing knowledge.

---

**End of reconciliation report.**
**Zero DB writes performed.** **Zero source files altered.** **Freeze remains in force.**

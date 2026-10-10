# NEX · ADR-0308/0309 Migration Readiness & Capability A Disposition Analysis

**Founder-directed 2026-09-16 · READ-ONLY evidence document · FREEZE remains in force**

> "First, I'd have NEX1 produce one final read-only document: 'ADR-0308/0309 Migration Readiness & Capability A Disposition Analysis.' Its job would be to answer the six founder decisions with evidence."
> — Founder, 2026-09-16

**Absolutely no**: code changes · commits · pushes · APPLY MIGRATION · Capability A modifications · Universal Intent modifications · retirements · new NEX numbers · Stage 2 or Stage 3 work.

This document answers the six founder decisions with evidence. It proposes nothing that goes beyond what evidence supports.

---

## §1 · What APPLY MIGRATION concretely changes

**FACT** — Migration hold is founder-controlled per ADR-0308 line 281 and ADR-0309 line 210 (Gate 5).

**FACT · What `APPLY MIGRATION` unlocks** (from ADR-0308 lines 279-286 · "What this ADR does NOT do"):

Per the ADR, `APPLY MIGRATION` is a **specific act with specific effect**:
- Creates the migration file in `db/migrations/` for the six-table schema (`nex.concepts` + `nex.concept_senses` + `nex.contexts` + `nex.questions` + `nex.answers` + `nex.evidence`)
- Formalises the schema as legally authorised

**FACT · What `APPLY MIGRATION` does NOT do by itself**:
- Does NOT wire the resolver into `orchestrator.classifyPrompt` — that is its own founder-approved BEGIN (line 284)
- Does NOT wire the resolver into `/api/nex-conv/chat` — its own founder-approved BEGIN (line 283)
- Does NOT delete `src/lib/nex-agent/language/code-intent-registry.ts` — that happens "once seeded" per line 285 · founder-gated
- Does NOT populate seed data — that is E1/E2/E3 workers' job post-migration (line 282)
- Does NOT retire Capability A — no ADR text authorises this
- Does NOT touch Universal Intent — no ADR text addresses it directly

**FACT · Current physical state contradicts the freeze narrative**:
- ADR-0309.1 line 58 reports: `nex.concepts + .concept_senses + .contexts + .relationships · Built 2026-09-11 · seeded 44 concepts + 51 senses`
- Yet `APPLY MIGRATION` has not been issued
- **INFERENCE**: The six semantic tables were created during 2026-09-11 reconciliation activity (see ADR-0309 Amendment "Post-Gate-2"). They physically exist but are not yet formally-migrated authoritative state.

**INFERENCE · What `APPLY MIGRATION` therefore materially changes today**:
1. Formalises the six-table schema as legally authoritative
2. Documents the schema in `db/migrations/` for future replayability
3. Unlocks Gate 6 (resolver wire-in) as a founder-approvable next step
4. Unlocks Gate 7 (deprecated retirement) as a founder-approvable next step
5. Does NOT itself change any behaviour · Capability A · Universal Intent · orchestrator · code-adapter continue as-is

**FACT · Gate sequence status (per ADR-0309 lines 205-212)**:

| Gate | Description | Status |
|---|---|---|
| Gate 0 | Founder reads ADR | **COMPLETE** (ADR authored by founder) |
| Gate 1 | Founder answers 7 open decisions | **UNKNOWN** — 7 open decisions (ADR-0309 lines 216-222) not documented as answered |
| Gate 2 | Supabase audit | **COMPLETE** (Amendment appended · gate-2-supabase-audit.md exists per ADR-0309 line 243) |
| Gate 3 | Migration ADR draft (with SQL DDL, migration scripts, rollback plans) | **UNCLEAR** — ADR-0310 exists but is "Knowledge Router Multi-Substrate Authority", not the Migration Design ADR mentioned in ADR-0309 line 208 |
| Gate 4 | Migration dry-run on scratch DB | **NO EVIDENCE** of dry-run |
| Gate 5 | `APPLY MIGRATION` command | **NOT ISSUED** |
| Gate 6 | Cross-layer linking + resolver wiring | Blocked by Gate 5 |
| Gate 7 | Retirement of deprecated | Blocked by Gate 5 |

**INFERENCE · Migration is stalled at Gate 1 OR Gate 3** — either the 7 open decisions haven't been answered, or the Migration Design ADR hasn't been drafted as ADR-0309 line 208 specified. Direct evidence for either state is not visible in the ADR chain files themselves.

---

## §2 · Capability A · Knowledge vs Competency decomposition

Founder direction: *"Which parts of Capability A represent NEX knowledge, and which parts represent proven agent competency? That distinction could tell you what survives."*

### §2.1 · Full content inventory

**FACT** — Capability A at `src/lib/nex-agent/code-engine/capability-a-founder-intent/` contains:

**Data files**:
- `vocabulary.ts` — 3836 lines, 2726 array entries approximately
- `types.ts` — Nex1IntentClassified / Nex1IntentRefused / Nex1IntentResult types + 8 supporting interfaces + 3 constants
- `classifier.ts` — 750+ lines; single exported function `classifyFounderIntent`
- `context-evidence-gate.ts` — universal signals + area-specific gate predicates (alpha.10)
- `index.ts` — barrel re-exports

**Vocabulary registries** (all inside vocabulary.ts):
| Registry | Approximate size | ADR-0308/0309 shape |
|---|---|---|
| VERB_FAMILY_VARIANTS | 8 families × ~10 variants ≈ 80 lexemes | 8 concepts · each concept has multiple senses |
| DELIVERABLE_PHRASES | 9 kinds × ~10 phrases ≈ 90 phrases | 9 concepts |
| STOP_WORDS | ~125 English function words | Linguistic layer (ADR-0309 Rule 2) not semantic layer |
| REQUIREMENT_MARKERS | ~20 marker phrases | Grammatical / requirement concepts |
| TOOL_LEXEMES | ~180 tools | ~180 tool concepts |
| FRAMEWORK_LEXEMES | ~250 frameworks | ~250 framework concepts |
| CODE_CONCEPT_LEXEMES | ~1254 concepts | ~1254 concepts |
| LANGUAGE_LEXEMES | ~65 programming languages | ~65 language concepts |
| WELL_KNOWN_CONFIG_FILES | ~240 config-file names | ~240 file-name concepts |
| WELL_KNOWN_PROJECT_DIRS | ~114 dir names | ~114 dir-name concepts |

**Executable logic** (in classifier.ts + context-evidence-gate.ts):
- `TOKEN_RE` regex (tokenizer · `[A-Za-z_][A-Za-z0-9._/\-]*/g`)
- `FILE_REF_RE` regex (file-path extractor with extension list)
- `tokenise()` function
- `extractFileReferences()` function
- `extractProjectDirs()` function (3-pass: file-ref-adjacent · compound-path · bare-word)
- `extractCodingConcepts()` function
- `scanDeliverables()` function
- `classifyVerbFamily()` function
- `extractDomainTokens()` function
- `extractRequirementPhrases()` function
- `computeOverallConfidence()` function
- `classifyFounderIntent()` — top-level entry
- Context Evidence Gate helpers: `isPastParticipleShape`, `isSpeculativeContext`, `wordsBefore`, `wordsAfter`, `requirementMarkerGate`

**Test suites**: 2253 passing tests · 14 test files (Alpha.6 through Alpha.10)

### §2.2 · Knowledge vs Competency separation

Per ADR-0308 Rule 11 (*"`nex.*` = what NEX knows · `nex_agent.*` = what NEX1 has proven it can do · never mixed"*) and Rule 6 (*"NEX1 never creates a private programming definition of a shared concept"*):

**KNOWLEDGE — belongs in `nex.*` after migration**:

| Content | ADR-0308 destination | Sense-key example |
|---|---|---|
| VERB_FAMILY_VARIANTS (8 families) | `nex.concepts` + `nex.concept_senses` | `verb.build.code_action` (canonical_key: `verb_build`; sense_key: `code_action`) |
| DELIVERABLE_PHRASES (9 kinds) | `nex.concepts` + `nex.concept_senses` | `deliverable.component`, `deliverable.route`, etc. |
| TOOL_LEXEMES (~180) | `nex.concepts` | Each tool is a concept; senses distinguish (e.g. `npm.package_manager.javascript`) |
| FRAMEWORK_LEXEMES (~250) | `nex.concepts` | Same pattern |
| CODE_CONCEPT_LEXEMES (~1254) | `nex.concepts` | Same pattern |
| LANGUAGE_LEXEMES (~65) | `nex.concepts` | Language names as concepts |
| WELL_KNOWN_CONFIG_FILES (~240) | `nex.concepts` OR retained as retrieval data | File-name concepts |
| WELL_KNOWN_PROJECT_DIRS (~114) | `nex.concepts` OR retained as retrieval data | Dir-name concepts |
| REQUIREMENT_MARKERS (~20) | Grammatical/requirement concepts in `nex.concepts` | e.g. `requirement.must_have`, `requirement.constraint` |
| STOP_WORDS (~125) | `nex.brain_english_vocabulary` (Linguistic layer per ADR-0309 Rule 2) | Word-level linguistic knowledge |

**FACT — this content is KNOWLEDGE by ADR-0308 Rule 11 definition.** It answers "what does NEX know?" It currently lives in `nex_agent`-namespaced path (`src/lib/nex-agent/code-engine/capability-a-founder-intent/vocabulary.ts`). That violates Rule 11.

**COMPETENCY — correctly stays in `nex_agent.*` per Rule 11**:

| Content | Why it is competency, not knowledge |
|---|---|
| `TOKEN_RE`, `FILE_REF_RE` regex | Reasoning procedures NEX1 uses to inspect text |
| `tokenise()` function | Deterministic transformation NEX1 performs |
| `extractFileReferences()` | Deterministic extraction procedure |
| `extractProjectDirs()` (3-pass detector) | Reasoning about surface evidence |
| `extractCodingConcepts()` | Reasoning procedure that consumes vocabulary + goal |
| `scanDeliverables()` | Reasoning procedure |
| `classifyVerbFamily()` | Reasoning procedure |
| `extractDomainTokens()` | Reasoning procedure |
| `extractRequirementPhrases()` | Reasoning procedure |
| `computeOverallConfidence()` | Reasoning procedure |
| `classifyFounderIntent()` | Composite reasoning entry point |
| Context Evidence Gate (all helpers) | Reasoning about surface context |
| 2253 tests | Proof-of-competency (per Two-Proof Rule Component Proof) |

**FACT — this content is COMPETENCY by ADR-0308 Rule 11 definition.** It answers "what has NEX1 proven it can do?" It correctly lives in `nex_agent`-namespaced path.

### §2.3 · Three disposition options · concrete outcomes

**Option A · Migrate (knowledge → `nex.concepts`, competency stays in `nex_agent`)**:
- Move all ten vocabulary registries into `nex.concepts` + `nex.concept_senses` (post-APPLY MIGRATION)
- Each of the ~2200 knowledge items becomes concept/sense rows
- Provenance attaches per Rule 4: each sense records `authored_by` (master_ai_engineer during Alpha.6-Alpha.10 · founder-authorised per session log)
- Classifier logic in `classifier.ts` refactored to consume `resolveConcept()` instead of embedded lexeme lookups
- Context Evidence Gate survives unchanged in `nex_agent`
- 2253 tests survive; may need updates when data source changes (Postgres vs in-file)
- **Alpha.6-Alpha.10 work preserved** as historical component evidence · content preserved via migration
- **Two-Proof Rule fully satisfied post-migration**: Component Proof (2253 tests) + System Connectivity Proof (via shared resolveConcept → orchestrator + code-adapter already use it)

**Option B · Retire (delete Capability A)**:
- Vocabulary data lost unless separately preserved
- Classifier logic lost
- Context Evidence Gate lost (though its universal signals could be lifted to `nex/language/`)
- 2253 tests become historical evidence only · component archived
- **Alpha.6-Alpha.10 work NOT preserved as active NEX capability** · only as history
- No new work needed but sunk cost is written off
- Universal Intent + `nex/language/` + code-intent-registry continue as the classifier pipeline

**Option C · Scope-restrict (keep only competency in `nex_agent`, do not treat vocabulary as knowledge)**:
- Vocabulary stays in `nex_agent/code-engine/capability-a-founder-intent/vocabulary.ts` — **still violates Rule 11 as written**
- Would require either (a) an ADR amendment clarifying that "private reasoning-lookup tables" are permitted in `nex_agent`, distinct from "canonical knowledge" in `nex.*`, OR (b) reframing the vocabulary as "test fixtures" (dishonest — it's actual reasoning data)
- Not a stable configuration under current ADR text

**INFERENCE · Option A is the only disposition that preserves the Alpha.6-Alpha.10 work AND conforms to the ADR chain.** Options B and C either discard work or maintain the Rule 11 violation.

### §2.4 · Migration mechanics per ADR-0308

ADR-0308 line 285 already specifies the migration pattern for a similar case: *"Delete `src/lib/nex-agent/language/code-intent-registry.ts` · moves to `nex.concepts` + `nex.concept_senses` once seeded."*

**INFERENCE** — The same pattern applies to Capability A's vocabulary. It would move to `nex.concepts` + `nex.concept_senses` once seeded, then the in-file vocabulary literal is deleted. Classifier logic remains.

**PROPOSAL** (labelled per founder rules) — if founder authorises Option A, the migration sequence would be a follow-up Gate (not part of Gate 5 · APPLY MIGRATION itself). ADR-0308 Rule 5 requires it to happen "once seeded"; seed order is founder-controlled.

---

## §3 · Universal Intent · Rule 1 conformance analysis

Founder direction: *"Don't guess. Find exactly what Rule 1 requires and compare Universal Intent's actual role against it."*

### §3.1 · Rule 1 verbatim (ADR-0309 line 30-31)

> "NEX has ONE shared language/meaning architecture, not separate English brains for Chat and NEX1. Chat and NEX1 are two specialist roles of one NEX system (per ADR-0308 rule 5)."

**What Rule 1 REQUIRES**:
- One shared language/meaning architecture (not multiple)
- Chat and NEX1 are ROLES of one system, not separate systems
- Cross-references ADR-0308 Rule 5: same `resolveConcept(surface, context)` API

**What Rule 1 does NOT forbid**:
- Specialist layers above the shared architecture
- Different presentation/UI surfaces (chat, orchestrator, etc.)
- Different scoring algorithms consuming the shared substrate

### §3.2 · Universal Intent · actual role

**FACT** — Universal Intent (`src/lib/nex/universal-intent/classify.ts`):
- Classifies user input into three layers: verb (10 options: Create/Communicate/Decide/Plan/Manage/Automate/Analyse/Learn/Improve/Monitor) + domain + capability
- Own tokenizer (`.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)`) with own 15-word stopword set (line 30)
- Own phrasing corpus at `data/nex-intent-phrasings.jsonl` (164 rows · founder-authored 2026-08-03)
- Jaccard similarity scoring + verb-keyword fallback
- **Does NOT use `resolveConcept(surface, context)`** — grep confirms no import from `nex/language/`
- Consumed by: `/api/nex/universal-intent/route.ts` + `nex/pipeline/converse.ts` (Stage 4)

### §3.3 · Rule 1 conformance verdict

**FACT** — Universal Intent has:
- Its own tokenizer (different from `nex/language/normaliser`)
- Its own stopwords (15 vs `nex/language/`'s 54 in STOPWORDS_EN_GB)
- Its own vocabulary (10 verbs vs `nex/language/`'s intent registries)
- Its own classifier logic (Jaccard vs trigger-token scoring)

**INFERENCE** — Structurally, Universal Intent is a **separate English brain** by any reasonable reading of Rule 1. It duplicates every function that `nex/language/` provides · at a coarser resolution.

**INFERENCE** — Rule 1 is violated as of 2026-09-16. Universal Intent is not a specialist role — it is a parallel classifier that does not share the `nex/language/` substrate.

**PROPOSAL** (three restructuring options for Rule 1 conformance):

**Option U1 · Wrap as specialist above the canonical resolver**:
- Universal Intent becomes a caller of `resolveConcept` instead of an independent classifier
- Its 10-verb model becomes a specialist scoring layer that consumes canonical concept output
- Its phrasing corpus (164 founder-authored rows) migrates to `nex.questions` per ADR-0309 Rule 5
- Its tests remain

**Option U2 · Retire once `nex/language/` covers general-Q&A intents**:
- After migration, `nex/language/` + business/brain domain plug-ins would cover Universal Intent's classification space
- Universal Intent becomes redundant
- Its phrasing corpus migrates to `nex.questions`
- The `/api/nex/universal-intent/` endpoint gets replaced by `/api/nex/language/classify` or equivalent

**Option U3 · Retain unchanged**:
- Requires an ADR amendment relaxing Rule 1 to permit parallel classifiers at the surface layer
- Not aligned with founder-authored intent of Rule 1

**INFERENCE · Option U1 or U2 is required for Rule 1 conformance.** Option U3 requires an ADR amendment.

**UNKNOWN** — Which of U1 or U2 the founder prefers · depends on strategic value of the 10-verb general-Q&A classifier as an ongoing specialist.

---

## §4 · Post-migration unresolved items

Even after `APPLY MIGRATION` is issued, the following remain unresolved:

**FROM ADR-0309 Gate 1 (7 open decisions) · none of these are answered by APPLY MIGRATION**:

1. Confirm four-layer target architecture (Language + Semantic + People-Say + Domain) is correct
2. Linguistic-field home: extend `nex.concepts` OR keep in `nex.brain_english_vocabulary` OR new `nex.word_linguistics` table
3. People-Say home: new `nex.people_say_translations` table OR JSONB in senses OR keep as JSON file
4. Empty tables (`nex.brain_english_grammar`/`lesson`/`practice`/`progress`) — original design intent, retire or absorb?
5. Founder-authored orphans (`human-language-map.json` + `nex-intent-phrasings.jsonl`) — target home, target time
6. Supabase gate opening — when?
7. Migration ADR draft (Gate 3) — draft now or wait until after Gate 2 (COMPLETE per Amendment)?

**FROM THIS AUDIT**:

8. Capability A disposition (Options A/B/C from §2.3) — founder-only decision
9. Universal Intent Rule 1 conformance (Options U1/U2/U3 from §3.3) — founder-only decision
10. Language Architecture Doctrine v1.0 relationship to ADR chain — amend / supersede / retain as complementary
11. Two-Proof Rule preservation as complementary NEX principle

**FROM ADR-0309.1 Logical Authority Model**:

12. Confidence-score idiom unification (Supabase 0-100 integer vs `nex_dev` 0-1 numeric)
13. Truth Engine unification across Supabase (active `quality-checker@677`) and `nex_dev.nex.*` (schema-ready, no verifier)
14. Version-record unification (Supabase `record_versions` + Git history)
15. Cross-substrate authority reconciliation (Path C per ADR-0310)

**INFERENCE** — `APPLY MIGRATION` unlocks Gate 6 (resolver wiring) and Gate 7 (deprecation), but does NOT itself resolve any of items 1-15 above. Each remains a founder-only decision.

---

## §5 · Answers to the six founder decisions

Founder listed six decisions in the prior review. Answers below with evidence, no proposals beyond evidence:

### Decision 1 · APPLY MIGRATION · issue or hold?

**Evidence-based recommendation**: **HOLD**.

Reasoning:
- ADR-0309.1 audit reveals 44 concepts + 51 senses already physically seeded during 2026-09-11 reconciliation — this is a pre-migration state that itself requires founder review before formalisation
- Gate 1 (7 open decisions from ADR-0309 lines 216-222) is not documented as answered
- Gate 3 (Migration Design ADR draft with SQL DDL, migration scripts, rollback plans per ADR-0309 line 208) does not exist under that name — ADR-0310 exists but is "Knowledge Router Multi-Substrate Authority" not the Migration Design ADR
- Gate 4 (Migration dry-run on scratch DB) has no evidence of execution

**Prerequisite gates ARE NOT ALL COMPLETE.** Issuing `APPLY MIGRATION` before Gates 1, 3, 4 are complete would skip founder-authored gate sequence.

### Decision 2 · Capability A disposition

**Evidence-based answer**: **Option A · Migrate is the only disposition that preserves Alpha.6-Alpha.10 work AND conforms to ADR-0308 Rules 6 and 11.**

Reasoning:
- Rule 11 forbids `nex.*` (knowledge) and `nex_agent.*` (competency) mixing
- Capability A's vocabulary content is KNOWLEDGE by Rule 11 definition (~2200 lexemes)
- Capability A's classifier logic is COMPETENCY by Rule 11 definition
- Migration moves knowledge to `nex.concepts` (respects Rule 11) while classifier logic stays in `nex_agent` (respects Rule 11)
- Options B (retire) discards work
- Option C (scope-restrict) does not stabilise under current ADR text

**PROPOSAL · Timing**: Do NOT execute migration in this phase. Founder-authorise Option A as the destination; execution happens after `APPLY MIGRATION` (Gate 5) is issued, following the seeding pattern in ADR-0308 line 285 that already applies to `code-intent-registry.ts`.

### Decision 3 · Universal Intent status vs ADR-0309 Rule 1

**Evidence-based answer**: Universal Intent CURRENTLY VIOLATES Rule 1 as a parallel classifier with independent tokenizer + stopwords + vocabulary. Two Rule-1-conforming options exist:
- U1: wrap as specialist consuming `resolveConcept`
- U2: retire once `nex/language/` covers its scope

**UNKNOWN** — Which the founder prefers. Not resolvable from evidence alone; requires strategic judgment about whether the 10-verb general-Q&A vocabulary has ongoing specialist value.

### Decision 4 · Language Architecture Doctrine v1.0 · relationship to ADR chain

**Evidence-based recommendation**: **Amend to reference the ADR chain, don't supersede**.

Reasoning:
- Language Architecture Doctrine v1.0 was authored 2026-09-16 (this session) without knowledge of ADR-0308+0309+0309.1+0310+etc.
- The two converge accidentally on the canonical target architecture
- Amending Language Architecture Doctrine v1.0 → v1.1 to cite the ADR chain as authoritative preserves the doctrinal writing (which encodes Two-Proof Rule and other principles) while placing it correctly under ADR authority
- Superseding would discard doctrinal principles that don't appear in the ADRs

**FACT** — This amendment is documentation only, not code. Can be done post-freeze if founder approves.

### Decision 5 · Two-Proof Rule preservation

**Evidence-based answer**: **Preserve as complementary NEX principle.**

Reasoning per founder direction: *"Keep it. It doesn't compete with the ADRs. It answers a different question. ADR: Where should this capability live? Two-Proof: Has this capability actually shipped? Those are complementary."*

The Two-Proof Rule is:
- Proof 1 (Component Proof): does it work in isolation?
- Proof 2 (System Connectivity Proof): is it actually connected to the system that needs it?

**INFERENCE** — Combined with the ADR chain, the full shipment predicate becomes: *"Architecturally authorised (ADRs conform) + Component Proof (tests pass) + System Connectivity Proof (real consumer) = legitimately shipped."*

This encoding survives all six decisions above.

### Decision 6 · Timing of remaining Gate work

**Evidence-based recommendation**: **Do not rush.**

Reasoning per founder direction: *"The current discoveries suggest that architecture must settle before capability expansion. Especially because you are trying to eventually get to Language → Code Understanding → Recognition → Identity → NEX designation → Capability → NI."*

Ordering:
- Decisions 4, 5 (documentation) can be resolved now if founder authorises · no freeze conflict
- Decisions 1-3 (APPLY MIGRATION · Capability A · Universal Intent) should wait for founder pacing
- Gates 1 and 3 (open decisions + Migration Design ADR) should complete before Gate 5

---

## §6 · The bigger governance picture (founder-observed)

Founder observed 2026-09-16: *"You're building a system where: Knowledge has an authorised home. Agents have an authorised identity. Capabilities require evidence. Intelligence has a classification. Actions require authority. Execution requires permission. Results require verification. And now: Architecture decisions have an immutable history."*

**FACT · Existing NEX doctrine artifacts as of 2026-09-16**:
- **Knowledge home** · ADR-0308 (`nex.concepts` + `nex.concept_senses`)
- **Agent identity** · agent-designation.ts (NEX-01 OFFICIAL, NEX-02 PROPOSED · governance state machine)
- **Capabilities require evidence** · Two-Proof Rule (Language Architecture Doctrine §2)
- **Intelligence classification** · NI Doctrine (NATIVE / AI_DELEGATED / HYBRID / NOT_IMPLEMENTED / UNKNOWN · NI-0..NI-5)
- **Actions require authority** · Safety Doctrine §3 (permission check before action)
- **Execution requires permission** · Safety Doctrine §2 (I_NEED_PERMISSION response kind)
- **Results require verification** · Safety Doctrine §2 (I_DID_IT requires execution_receipt + evidence_refs)
- **Architecture decisions have immutable history** · ADR chain + Historical Wave Receipt Immutability Doctrine

**INFERENCE** — The NEX governance stack is architecturally complete for doctrine. Implementation completeness is a separate axis (see §4 unresolved items).

**FACT · Historical mistake preserved per founder direction**:
- Capability A alpha.6-alpha.10 was developed 2026-09-16 without knowledge of ADRs 0308+0309 which existed since 2026-09-10/11
- The component works (2253 tests) but is architecturally misplaced
- **This history is not being erased.** It is preserved as evidence of the exact governance case Two-Proof Rule + ADR chain now prevent.

---

## §7 · What this document does NOT do

- Does NOT issue `APPLY MIGRATION`
- Does NOT modify Capability A · Universal Intent · orchestrator · code-adapter · or any other module
- Does NOT create new NEX designations
- Does NOT promote NEX-02
- Does NOT amend any ADR
- Does NOT amend Language Architecture Doctrine v1.0
- Does NOT retire any subsystem
- Does NOT commit or push
- Does NOT begin Stage 2 (Native Code Understanding) work
- Does NOT begin Stage 3 (Agent Recognition) work

---

## §8 · Founder decisions required (unchanged list · now with evidence-backed answers ready)

1. **`APPLY MIGRATION` · issue or hold?** — Evidence supports HOLD until Gates 1, 3, 4 are complete.
2. **Capability A disposition** — Evidence supports Option A (migrate). Founder authorises A/B/C.
3. **Universal Intent Rule 1 conformance** — Evidence shows current violation. Founder chooses U1 (wrap as specialist) or U2 (retire) or U3 (amend ADR).
4. **Language Architecture Doctrine v1.0 relationship** — Recommend amend to reference ADR chain.
5. **Two-Proof Rule preservation** — Recommend keep as complementary NEX principle.
6. **Gate pacing** — Recommend no rush; complete Gates 1 and 3 before Gate 5.

**All six decisions are founder-only. This document exists to inform, not to decide.**

---

**SEALED · 2026-09-16 · v1.0 · append-only · one final read-only document per founder direction**

# NEX Language · Current-State Inventory · 2026-09-16

**Companion document to** `nex-language-architecture-doctrine.md`.

This inventory is a **frozen evidence snapshot** as of the sealing date. Every entry cites a file path. Every consumer count comes from repo-wide `grep`. Every classification uses the vocabulary from Doctrine §4. **This document does not authorise any action** — it establishes what exists so future decisions can be made against real evidence.

**Method**: three parallel read-only research agents + direct code inspection + verification of one contested claim.

---

## §0 · Summary counts

| Category | Count |
|---|---|
| Distinct language subsystems | **9** |
| Distinct tokenizers | **5+** |
| Distinct intent registries | **3** |
| Distinct intent classifiers | **3** |
| HTTP entry points accepting user text | **21** |
| Subsystems classified **CORE CANDIDATE** | **1** |
| Subsystems classified **SPECIALIST** | **4** |
| Subsystems classified **LEGACY CANDIDATE** | **2** |
| Subsystems classified **DEAD END** | **1** (Capability A) |
| Subsystems classified **UNKNOWN** | **1** |

---

## §1 · The Nine Subsystems

### Subsystem A · Capability A · Founder Intent Classifier
- **Path**: `src/lib/nex-agent/code-engine/capability-a-founder-intent/`
- **Purpose (from code)**: Deterministic classifier of founder goals · verb-family + deliverable-kind + coding concepts + file refs + project-dir refs + requirement phrases + Context Evidence Gate (alpha.10)
- **Tokenizer**: `[A-Za-z_][A-Za-z0-9._/\-]*/g` (alpha.9 · accepts leading underscore)
- **Vocabulary**: 6 registries (~1500 lexemes: TOOL / FRAMEWORK / CONCEPT / LANGUAGE + WELL_KNOWN_CONFIG_FILES + WELL_KNOWN_PROJECT_DIRS + REQUIREMENT_MARKERS + VERB_FAMILY_VARIANTS + DELIVERABLE_PHRASES)
- **Verified consumers**: `src/app/api/nex1/intent/classify/route.ts` only. Zero in-repo callers of `classifyFounderIntent` outside the module itself.
- **Component Proof**: 1878 passing tests (alpha.6-alpha.10)
- **System Connectivity Proof**: **NOT CONNECTED**
- **Classification**: **DEAD END** (per Doctrine §4)
- **Notes**: The classifier is well-tested and its outputs are structurally sound. The dead-end status is a wiring gap, not a component defect.

### Subsystem B · Nex-Agent Language Registry
- **Path**: `src/lib/nex-agent/language/code-intent-registry.ts`
- **Purpose (from code)**: 9 code-domain `DomainIntent` records (add_feature / fix_bug / explain / add_test / add_migration / refactor / add_route / ... ) with `trigger_tokens` + `trigger_phrases` + `clarify_questions` + `reply_template`
- **Tokenizer**: N/A — provides token data to the Nex Language normaliser + intent-parser
- **Vocabulary**: 9 code-intent records with per-intent triggers
- **Verified consumers**: Nex Language intent-parser (via `DomainIntent` contract)
- **Component Proof**: passes shared-language-engine tests
- **System Connectivity Proof**: **PARTIALLY CONNECTED** (used by Nex Language, not by Capability A)
- **Classification**: **SPECIALIST** (code-domain layer above canonical language)

### Subsystem C · Nex Language Engine
- **Path**: `src/lib/nex/language/` (`normaliser.ts` · `intent-parser.ts` · `question-resolver.ts` · `concept-resolver.ts` · `stopwords-en-gb.ts` · `slang-en-gb.ts` · `guardian.ts` · `types.ts` · plus tests)
- **Purpose (from code)**: Domain-agnostic UK-English normaliser + intent-scorer + question-pattern resolver. Deterministic, no LLM, no embeddings.
- **Tokenizer**: `stripPunctuation(14-char strip) → collapseWhitespace → multi-word alias substitution (longest-first) → split(/\s+/) → stopword filter → alias substitution per token`
- **Vocabulary**: UK slang aliases + STOPWORDS_EN_GB + plug-in `DomainIntent` registries (accommodation / code / others)
- **Verified consumers**: 15+ importer files across accommodation adapters, code adapters, intent parser, nex1 orchestrator
- **Component Proof**: has its own test suite (`language.test.ts` etc.)
- **System Connectivity Proof**: **CONNECTED** (wide consumer base)
- **Classification**: **CORE CANDIDATE** (per Doctrine §3 canonical language layer)
- **Notes**: Designed as generic; already used by multiple downstream domains. Strongest candidate for the canonical layer role.

### Subsystem D · Universal Intent Classifier
- **Path**: `src/lib/nex/universal-intent/` (`classify.ts` · `phrasings.ts` · `types.ts` · `index.ts` · plus tests)
- **Purpose (from code)**: 3-layer classifier (Layer 1 · verb = Create/Communicate/Decide/Plan/Manage/Automate/Analyse/Learn/Improve/Monitor · Layer 2 · domain · Layer 3 · capability) with Jaccard scoring against phrasing corpus + verb-keyword fallback
- **Tokenizer**: Own tokeniser (`[^a-z0-9\s]` strip + split) with own small stopword set of 15 words. **Different from Nex Language's tokeniser.**
- **Vocabulary**: 10 canonical verbs + own keyword-per-verb map + phrasing corpus
- **Verified consumers**: `nex/pipeline/converse.ts` · `nex/pipeline/recommend.ts` · `components/nex/GoalLayer.tsx` · `/api/nex/universal-intent/route.ts`
- **Component Proof**: passes own test suite (`classify.test.ts`)
- **System Connectivity Proof**: **CONNECTED**
- **Classification**: **LEGACY CANDIDATE** (competes with Capability A's verb-family and Nex Language's intent-parser; different verb vocabulary; overlaps with both)
- **Notes**: 10 broad verbs vs Capability A's 8 code-focused verbs. Vocabularies do not agree. Future consolidation candidate.

### Subsystem E · Reflex Brain
- **Path**: `src/lib/nex/reflex/reflex-brain.ts` · `trade-terminology.ts`
- **Purpose (from code)**: Tier-1 sub-100ms pattern matcher for greetings / closings / thanks / trade-terminology. Zero LLM. Short-circuits before any classifier. Deliberately does NOT fire when the message contains a substantive question.
- **Tokenizer**: Regex patterns on raw input (no shared tokenizer)
- **Vocabulary**: In-file locked pattern list (matches "hi" · "morning" · "hello nex" · "thanks" · "goodnight" · "bye" · plus trade-terminology lookups)
- **Verified consumers**: `/api/nex/converse/route.ts` · `/api/nex/converse/stream/route.ts` · `nex/router/brain-router-core.ts`
- **Component Proof**: pattern-tested
- **System Connectivity Proof**: **CONNECTED** (in the active tier-1 path)
- **Classification**: **SPECIALIST** (correct role · narrow scope · above the canonical layer)
- **Notes**: This is doing exactly what a Tier-1 reflex should do. Not a problem — a well-scoped specialist.

### Subsystem F · Brain Language Intelligence
- **Path**: `src/lib/nex/brain/language-intelligence.ts`
- **Purpose (from code)**: Feature extractor for brain agents — interrogative words (where/how/why/what) · referents (deictic pronouns / ordinals) · verb-semantic classification (provenance / location / other)
- **Tokenizer**: Own regex-based feature extraction
- **Vocabulary**: Interrogative/referent/verb-class token sets
- **Verified consumers**: brain agents (staircase brain and others per Agent C)
- **Component Proof**: unknown test coverage
- **System Connectivity Proof**: **CONNECTED** (used by brain agents)
- **Classification**: **SPECIALIST** (brain-answer-specific feature extraction · valid role above canonical layer)

### Subsystem G · Accommodation Intent Registry
- **Path**: `src/lib/nex/intelligence-storage-grid/accommodation/intent-registry.ts`
- **Purpose (from code)**: Accommodation-domain `DomainIntent` records (accommodation-specific triggers)
- **Tokenizer**: N/A — provides trigger data
- **Vocabulary**: Accommodation-domain intents
- **Verified consumers**: accommodation flow (via Nex Language contract)
- **Classification**: **SPECIALIST** (accommodation-domain layer above canonical language)

### Subsystem H · Pipeline Converse
- **Path**: `src/lib/nex/pipeline/converse.ts` · `recommend.ts` · `types.ts` · `index.ts` · plus tests
- **Purpose (from code)**: 11-stage router for `/api/nex/pipeline` endpoint. Consumes Universal Intent output.
- **Tokenizer**: N/A — consumes classifier output
- **Verified consumers**: `/api/nex/pipeline/route.ts`
- **Classification**: **CORE CANDIDATE** dispatcher (would need to expand to consume canonical language layer output instead of only Universal Intent)
- **Notes**: Position in the architecture is right; upstream is currently biased.

### Subsystem I · AST Semantic
- **Path**: `src/lib/nex-agent/code-engine/adapters/ast-semantic.ts`
- **Purpose (from code)**: TypeScript compiler API for parsing source code (not natural language). Extracts interfaces/functions/test-blocks. Deterministic.
- **Tokenizer**: TypeScript AST (orthogonal to natural-language tokenization)
- **Verified consumers**: `nex1-authoring-loop.ts`
- **Classification**: **SPECIALIST** (code-parsing-only · orthogonal to natural-language layer · legitimate specialist)

---

## §2 · Context Evidence Gate (alpha.10)

- **Path**: `src/lib/nex-agent/code-engine/capability-a-founder-intent/context-evidence-gate.ts`
- **Purpose**: Reusable deterministic gate — universal signals (isPastParticipleShape · isSpeculativeContext · wordsBefore/After) + area-specific gates (requirementMarkerGate wired; verbCandidateGate + deliverableGate + conceptGate declared as scaffolding)
- **Verified consumers**: `extractRequirementPhrases` in `classifier.ts` (wired in alpha.10)
- **Component Proof**: 65 passing tests
- **System Connectivity Proof**: **PARTIALLY CONNECTED** (used inside Capability A only; Capability A itself is DEAD END so the CEG's system-level reach is bounded)
- **Classification**: **PROPOSED NEX-02** · candidate for future canonical Context Intelligence layer
- **Notes**: Currently the CEG serves one classifier. The doctrine's larger vision (Doctrine §5) is for NEX-02 to serve as a cross-subsystem context provider. Not yet demonstrated.

---

## §3 · Sentence-trace evidence

Three representative inputs traced through the actual pathways they encounter. Every step is based on code inspection, not fabrication.

### Trace 1 · "build a login form"

| Route | Path taken | Result |
|---|---|---|
| `/api/nex1/intent/classify` | Capability A · TOKEN_RE tokenises → verb classification → deliverable scan → coding concepts → project-dir refs → CEG | `verb_family=BUILD`, `deliverable_kind=component`, coding_concepts=[login form-related if present] |
| `/api/nex/converse` | Reflex Brain first (no pattern match) → falls through to Anthropic LLM (`askNex`) | LLM produces text; Capability A not consulted |
| `/api/nex/universal-intent` | Universal-intent's own tokeniser → Jaccard scoring against phrasing corpus → verb-keyword fallback | `layer1_verb=Create`, confidence based on corpus similarity |
| `/api/nex/pipeline` | Pipeline converse (11-stage) consuming universal-intent output | Downstream dispatch based on Universal Intent's verb `Create` |

**Same sentence · 4 different endpoints · 4 different interpretations. Zero shared state. No cross-validation.**

### Trace 2 · "the services are slow"

| Route | Path taken | Result |
|---|---|---|
| `/api/nex1/intent/classify` | Capability A · no controlled-vocab verb ("are" is not in any family) | **REFUSED** (`refused_no_verb_recognised`) |
| `/api/nex/converse` | Reflex Brain (no match) → Anthropic LLM | LLM produces text; Capability A never called |
| `/api/nex/universal-intent` | Universal-intent · keyword fallback (contains "slow" · matches Analyse verb keywords) | `verb=Analyse`, low-moderate confidence |
| `nex/language/normaliser` (if consumed by any downstream) | Tokens `["service", "slow"]` (stopwords the/are removed) | Ready for intent-parser scoring against DomainIntent registries |

**REFUSAL from Capability A + confident Analyse from Universal Intent + no LLM involvement in the deterministic paths. Different endpoints produce structurally incompatible outputs.**

### Trace 3 · "hello"

| Route | Path taken | Result |
|---|---|---|
| `/api/nex1/intent/classify` | Capability A · below minimum length (5 chars < 8) | **REFUSED** (`refused_goal_too_short`) |
| `/api/nex/converse` | Reflex Brain · pattern match ("greeting" category) → short-circuit | Instant response, sub-100ms, no LLM |
| `/api/nex/universal-intent` | Universal-intent · no verb keyword match | Falls to default `Learn` verb at very low confidence |
| `/api/nex/pipeline` | Pipeline converse · low-confidence intent → clarify-mode | Clarification prompt |

**Reflex Brain is the correct system for this. The others produce noise or refusals. This confirms that specialist layers are legitimate and should coexist with the canonical layer.**

---

## §4 · Duplicated responsibilities table

| Responsibility | Subsystem A | Subsystem B | Overlap kind |
|---|---|---|---|
| Verb classification | Capability A (8 verb families) | Universal Intent (10 verbs) | Different vocabularies, different classifiers |
| Tokenisation | Capability A (`[A-Za-z_]...`) | Nex Language normaliser (`\s+` post-strip) | Different token boundaries on `_`, punctuation, contractions |
| Intent registry | `nex-agent/language/code-intent-registry.ts` (9 code intents) | Capability A's verb+deliverable output | Overlapping concepts (add_feature ≈ verb=BUILD + deliverable) |
| Stopwords | Nex Language `STOPWORDS_EN_GB` | Universal Intent hardcoded 15-word list | Different sizes, different lists |
| Slang | Nex Language `UK_SLANG_ALIASES` | Capability A: none | UK slang only handled in Nex Language |
| Question/interrogative detection | Nex Language question-resolver | Brain Language Intelligence | Different mechanisms, may disagree |

---

## §5 · Missing connections

Documented by direct grep + Agent C:

1. **Capability A → downstream**: none. Only its HTTP endpoint reads it.
2. **File Memory → downstream**: none outside the 3 file-memory endpoints.
3. **Capability A → Nex Language normaliser**: not wired. Capability A ignores UK slang, ignores stopword filtering.
4. **Nex Language → Capability A**: not wired. Nex Language uses `nex-agent/language/code-intent-registry.ts` for code intents, not Capability A's richer vocabulary.
5. **Native programming loop → Capability A**: not wired. Loop uses its own file:line regex (line 146 · `native-programming-loop.ts`).
6. **Reflex Brain → any classifier**: not wired. Reflex is standalone (correct by design for Tier 1).
7. **Universal Intent → Capability A** or reverse: not wired. Two parallel classifiers.
8. **Brain Language Intelligence → Capability A**: not wired. Brain has its own feature extractor.

---

## §6 · Report accuracy note (audit trail integrity)

Agent A during the connectivity audit stated that `/api/nex1/native-loop/run` uses Capability A. **Direct code inspection contradicted this** — the route handler calls `runNativeProgrammingLoop(input)` which uses its own regex at `native-programming-loop.ts:146`, no `classifyFounderIntent` import.

This is documented per founder governance ("NEX1 caught an agent's incorrect claim ... That is truth-first native engineering"). Corrected in §5 above.

---

## §7 · What this inventory does NOT do

- Does **not** authorise deletion.
- Does **not** authorise wiring changes.
- Does **not** promote NEX-02.
- Does **not** describe an implementation timeline.
- Does **not** claim completeness — additional language subsystems may exist that this audit did not surface. Adding them requires a new dated inventory version.

---

**SEALED · 2026-09-16 · v1.0 · append-only**

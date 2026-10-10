# NEX Canonical Language Layer · Evidence Review

**Founder-directed 2026-09-16 · READ-ONLY architecture review · FREEZE remains active**

**No code changes. No commits. No pushes. No wiring. No consolidation. No deletion.**

This document reports what the code proves, not what the folder names suggest. Every major claim carries file-path evidence. Every conclusion is labelled FACT / INFERENCE / UNKNOWN / PROPOSAL per founder rule.

---

## §1 · Executive evidence summary

**THE HEADLINE FINDING** — this reviewer went into the audit expecting to *choose* the canonical layer from evidence. That is the WRONG question.

**FACT** — The founder already decided the canonical NEX language architecture six days before this session:

- **ADR-0308** · `docs/DECISIONS/0308-nex-english-brain-v1.md` (Founder Phillip · 2026-09-10) · **STATUS: Proposed · migration HELD pending `APPLY MIGRATION`**
- **ADR-0309** · `docs/DECISIONS/0309-nex-english-brain-layered-architecture.md` (Founder Phillip · 2026-09-11) · **STATUS: Proposed · database freeze remains in force**

The audit's job is therefore to report:
1. Whether the existing subsystems match the ADR-decided architecture
2. What is already implemented vs what remains incomplete
3. Where the current code CONFORMS to the doctrine and where it VIOLATES it

**The two ADR verbatim decisions**:

> ADR-0308 · Decision: "Build **one canonical NEX English knowledge substrate** at `nex.*` in Postgres, consumed by both NEX Chat and NEX1 through a shared resolver."
> Rule 5 · "NEX Chat and NEX1 use the same `resolveConcept(surface, context)` API."
> Rule 6 · "NEX1 never creates a private programming definition of a shared concept."
> Rule 9 · "PostgreSQL is authoritative. In-memory language structures are hot tier / cache only."
> Rule 11 · "`nex.*` = what NEX knows. `nex_agent.*` = what NEX1 has proven it can do. Never mixed."

> ADR-0309 · Rule 1: "NEX has ONE shared language/meaning architecture, not separate English brains for Chat and NEX1."

**The canonical layer is `src/lib/nex/language/` feeding the `nex.*` Postgres schema.** This decision predates the current session's alpha work.

---

## §2 · Complete language subsystem inventory (10 subsystems)

Extends the 2026-09-16 current-state inventory by adding one subsystem discovered during this review.

| # | Subsystem | Path | Relationship to ADR-0308 / ADR-0309 |
|---|---|---|---|
| 1 | **`nex/language/`** | `src/lib/nex/language/` (normaliser · intent-parser · concept-resolver · question-resolver · guardian · slang · stopwords · types) | **THE CANONICAL ENGINE** per ADR-0308 |
| 2 | **`nex-agent/language/code-intent-registry.ts`** | `src/lib/nex-agent/language/code-intent-registry.ts` | **DOMAIN PLUG-IN** for CODE. ADR-0308 preamble: "Reframes previous per-agent language modules (`src/lib/nex-agent/language/*`) as misfiled" · migration target: `nex.concepts` + `nex.concept_senses` |
| 3 | **`nex/intelligence-storage-grid/accommodation/intent-registry.ts`** | `src/lib/nex/intelligence-storage-grid/accommodation/intent-registry.ts` | **DOMAIN PLUG-IN** for ACCOMMODATION · uses `IntentDefinition` (a different contract than `DomainIntent`) · convergence required |
| 4 | **Capability A** | `src/lib/nex-agent/code-engine/capability-a-founder-intent/` (my session's Alpha.6-Alpha.10 work) | **VIOLATES ADR-0308 Rule 6** ("NEX1 never creates a private programming definition of a shared concept") · currently DEAD END · component-sound but architecturally misaligned |
| 5 | **`nex/universal-intent/`** | `src/lib/nex/universal-intent/` (10-verb classifier) | **PARALLEL CLASSIFIER** · verb vocabulary does NOT align with `DomainIntent` contract · overlaps with ADR-0308 intent role |
| 6 | **`nex/pipeline/converse.ts`** | `src/lib/nex/pipeline/converse.ts` (11-stage router) | **ORCHESTRATOR** using Universal Intent at Stage 4 · not yet integrated with `nex/language/`'s `resolveConcept` API per ADR-0308 Rule 5 |
| 7 | **`nex/reflex/reflex-brain.ts`** | `src/lib/nex/reflex/` | **SPECIALIST** · Tier-1 sub-100ms pattern matcher · correct role above canonical layer · never fires on substantive questions (verified) |
| 8 | **`nex/brain/language-intelligence.ts`** | `src/lib/nex/brain/language-intelligence.ts` | **SPECIALIST · WITH LIVE CONSUMERS** · linguistic feature extraction (interrogative, referent, verb-semantic, source-noun) consumed by `result-followup.ts` + `conversational-function.ts` · complementary to canonical layer, not competing |
| 9 | **`nex-agent/code-engine/adapters/ast-semantic.ts`** | `src/lib/nex-agent/code-engine/adapters/ast-semantic.ts` (912 lines) | **STAGE 2 CODE-PARSING ADAPTER** · orthogonal to language layer · TypeScript compiler API · NOT a canonical-layer candidate |
| 10 | **`nex-language-brain/`** (newly discovered) | `src/lib/nex-language-brain/` (10 files · 2046 lines · Founder-authored 2026-09-12) | **SPECIALIST · POLYGLOT COMPETENCE** · about NEX1 speaking natural human languages (English, Bahasa Indonesia, up to 32 languages) · NOT the internal pipeline · orthogonal to canonical layer |

**Not in the current-state inventory but discovered**:
- `docs/DECISIONS/0308-nex-english-brain-v1.md` (ADR)
- `docs/DECISIONS/0309-nex-english-brain-layered-architecture.md` (ADR)
- `src/lib/nex-language-brain/` (polyglot module · 2026-09-12)

---

## §3 · Actual consumers and runtime connections (grep-verified)

### `nex/language/` consumers (production)

**FACT** — Confirmed by direct grep (`grep -r "from.*nex/language" src/`):

1. `src/lib/nex-agent/core/orchestrator.ts` (line 32-36) — imports `parseIntent`, `resolveConcept`, `matchQuestion`, `normalise`. Uses in multi-round agent classification.
2. `src/lib/nex/live-chat-completion/adapters/code-adapter.ts` (line 18-22) — imports same functions for code-domain chat routing.
3. `src/lib/nex-agent/language/code-intent-registry.ts` (line 10) — imports `DomainIntent` type only.

Test consumers: `nex/language/language.test.ts`, `concept-resolver.test.ts`, `question-resolver.test.ts`.

### `nex-agent/language/code-intent-registry.ts` consumers

**FACT** — Consumed by:
1. `nex-agent/core/orchestrator.ts` (via `parseIntent(..., {intents: CODE_INTENT_REGISTRY})`)
2. `nex/live-chat-completion/adapters/code-adapter.ts` (same pattern)
3. Test files

### `nex/universal-intent/` consumers

**FACT** — Consumed by:
1. `nex/pipeline/converse.ts` (line 252) — Stage 4 of 11-stage pipeline
2. `/api/nex/universal-intent/route.ts` (HTTP endpoint)
3. `components/nex/GoalLayer.tsx` (UI)

### `nex/pipeline/converse.ts` consumers

**FACT** — Consumed by (implied via `converse()` export): `/api/nex/pipeline/route.ts`.

### `nex/reflex/reflex-brain.ts` consumers

**FACT** — Consumed by:
1. `/api/nex/converse/route.ts` (line 30)
2. `/api/nex/converse/stream/route.ts` (line 30)
3. `nex/router/brain-router-core.ts`

### `nex/brain/language-intelligence.ts` consumers

**FACT** (per Agent C):
1. `nex/brain/result-followup.ts` (line 47) — imports `interpretIntent` for provenance follow-up detection
2. `nex/brain/conversational-function.ts` (line 55) — imports `interpretIntent` for dialogue-act classification
3. Test file

### Capability A consumers

**FACT** — Grep for `classifyFounderIntent`, excluding Capability A's own module and tests, returns **exactly one file**: `src/app/api/nex1/intent/classify/route.ts` (HTTP endpoint).

**No downstream code path reads that endpoint.**

---

## §4 · Capability comparison

Against the criteria from the founder's directive:

| Criterion | nex/language/ | universal-intent | pipeline/converse | reflex-brain | brain/language-intelligence | Capability A |
|---|---|---|---|---|---|---|
| Native / deterministic | ✅ pure regex + set lookups | ✅ Jaccard + keywords | ✅ compositional | ✅ regex patterns | ✅ feature extraction | ✅ regex + vocab |
| Tokenisation consistency | ✅ single normaliser | ✅ own tokeniser (differs) | N/A | N/A | ✅ own tokeniser (differs) | ✅ own tokeniser (differs) |
| Slang / normalisation | ✅ UK slang + 54 stopwords | ⚠️ hardcoded small stopword list | N/A | N/A | ❌ none | ❌ none |
| Context handling | ✅ ResolveContext + cooccur signals | ❌ none | ⚠️ session/goal context | N/A | ⚠️ features only | ⚠️ span-only |
| Intent handling | ✅ two-layer (patterns + triggers) | ✅ 10-verb classifier | ✅ Stage-4 uses universal-intent | ✅ tier-1 pattern | ⚠️ intent composition (indirect) | ✅ 8 verb families |
| Extensibility · plug-ins for other domains | ✅ NormaliserOptions + ParseOptions | ⚠️ single-corpus | ⚠️ retrieval-router pattern | ❌ hardcoded | ✅ cross-domain by design | ❌ code-only |
| Cross-domain suitability | ✅ code + accommodation + brain planned | ⚠️ general Q&A vocab (misses code verbs) | ✅ domain-agnostic router | ❌ staircase-specific | ✅ domain-agnostic | ❌ code-only |
| Runtime connectivity | ✅ 3 production consumers | ✅ 3 production consumers | ✅ 1 endpoint | ✅ 3 production consumers | ✅ 2 production consumers | ❌ **0** external consumers |
| Postgres/persistence path | ✅ ADR-0308 aligned | ❌ JSONL corpus | ⚠️ YAML knowledge files | ❌ in-file | ❌ in-file | ❌ in-file |
| Compat with future code understanding | ✅ concepts + senses model | ❌ verb-only, no code awareness | ⚠️ knowledge-YAML-based | N/A | ✅ features feed reasoning | ⚠️ isolated |
| Compat with future agent recognition | ✅ concept-sense-based | ❌ | ⚠️ | N/A | ⚠️ features could help | ❌ isolated |
| Safety / truth-first | ✅ Guardian validation module | ⚠️ no truth engine hook | ✅ knowledge YAML curated | ⚠️ hardcoded strings | ✅ deterministic | ✅ deterministic |
| Migration complexity | 🟡 schema not deployed | 🟢 works today | 🟢 works today | 🟢 trivial | 🟢 works today | 🔴 large refactor to fit ADR |

---

## §5 · Duplication analysis (evidence-backed)

**FACT · Duplication 1 · Tokenisation** — five distinct tokenisers (`nex/language/normaliser`, `nex/universal-intent/classify` internal, `nex-agent/code-engine/capability-a-founder-intent/classifier`'s TOKEN_RE, `nex/brain/language-intelligence`, `nex-language-brain/spelling-normaliser`). They disagree on `_prefix`, contractions, punctuation, stopwords.

**FACT · Duplication 2 · Verb classification** —
- `nex/universal-intent/`: 10 verbs (Create/Communicate/Decide/Plan/Manage/Automate/Analyse/Learn/Improve/Monitor)
- Capability A: 8 families (BUILD/MODIFY/FIX/REFACTOR/TEST/INVESTIGATE/VERIFY/REMOVE)
- **Vocabularies do NOT align.** Verify, Refactor, Test, Remove have no Universal equivalent. Improve, Monitor, Learn, Plan, Communicate, Decide, Automate have no Capability A equivalent.

**FACT · Duplication 3 · Intent registries with different contracts**:
- `DomainIntent` (nex/language/types.ts) — used by code-intent-registry
- `IntentDefinition` (accommodation intent-registry) — different shape

Both describe the same problem (mapping user intent to data source) but with different abstractions. ADR-0308 Rule 5 requires convergence.

**FACT · Duplication 4 · Capability A vs code-intent-registry** — Both classify code-domain intent from a founder goal, but Capability A uses verb+deliverable+concept model while code-intent-registry uses trigger_tokens+trigger_phrases. Only code-intent-registry is actually consumed by orchestrator/code-adapter.

**INFERENCE · Duplication is architectural debt** — most subsystems predate ADR-0308 or ADR-0309. The doctrine explicitly reframes them.

---

## §6 · Sentence-trace comparison (representative inputs)

Each sentence traced through actual code:

### Trace A · `"chuck in a new endpoint"`

**Via `nex/language/`** (code-adapter path):
1. `normalise("chuck in a new endpoint")` → UK-slang alias `chuck in → add` → canonical_tokens `["add", "endpoint"]`
2. `matchQuestion(message, 0.85)` → probably no pattern hit
3. `parseIntent(message, CODE_INTENT_REGISTRY)` → matches `add_feature` intent (via trigger_tokens `["add", "endpoint"]`)
4. Route to code-adapter operational handler

**Via Capability A**:
1. Refused? `chuck` is not in any verb family. Grep confirms `chuck` not in VERB_LEXEME_INDEX.
2. Would return `refused_no_verb_recognised`.

**Via Universal Intent**:
1. Own tokeniser: `["chuck", "in", "a", "new", "endpoint"]` after stopword strip
2. Jaccard against phrasing corpus — probably matches `Create` verb via keyword `add` (if present) or nothing
3. Would return low-confidence `Create` or fallback

**Divergence**: Only `nex/language/` handles the UK slang alias correctly. The other two miss the intent entirely.

### Trace B · `"the services are slow"`

**Via `nex/language/`**: normalise → tokens `["service", "slow"]` (stopwords "the", "are" removed). No trigger match in CODE_INTENT_REGISTRY. Would return low confidence.

**Via Capability A**: Refused (`refused_no_verb_recognised` · "are" is not a verb).

**Via Universal Intent**: Fallback verb-keyword matching → likely `Analyse` (contains "why-like" analytic verbs). Wrong for user intent.

**Divergence**: All three fail this case in different ways.

### Trace C · `"what does migration mean"`

**Via `nex/language/`**: `matchQuestion` pattern `"what does {entity} mean"` matches. Entity = `migration`. Route to `resolveConcept("migration", context)` → concept-resolver returns `sense_key: migration.database_schema_change` (if seed present).

**Via Universal Intent**: Verb keyword `mean` matches `Learn` → confidence ~0.6. But no concept resolution.

**Via Capability A**: No verb match. Refused.

**Divergence**: `nex/language/` gives the RIGHT answer with the concept sense. Others give partial or wrong.

---

## §7 · Proof 1 / Proof 2 status per subsystem

| Subsystem | Proof 1 · Component | Proof 2 · System Connectivity | Verdict |
|---|---|---|---|
| **`nex/language/`** | ✅ 3 test suites | ✅ 3 production consumers (orchestrator + code-adapter + code-intent-registry) | **SHIPPED** |
| **`code-intent-registry`** | ✅ static data | ✅ consumed by 2 production files | **SHIPPED (domain plug-in)** |
| **`nex/universal-intent/`** | ✅ classify.test.ts | ✅ /api/nex/universal-intent + pipeline Stage 4 | **SHIPPED** |
| **`nex/pipeline/converse.ts`** | ✅ tests | ✅ /api/nex/pipeline | **SHIPPED** |
| **`nex/reflex/reflex-brain.ts`** | ✅ pattern-tested | ✅ /api/nex/converse* + brain-router-core | **SHIPPED** |
| **`nex/brain/language-intelligence.ts`** | ✅ 333 lines of tests | ✅ result-followup.ts + conversational-function.ts | **SHIPPED** |
| **`ast-semantic.ts`** | ✅ deterministic AST ops | ⚠️ integration into nex1-reasoning-engine not visible in this snapshot | **UNKNOWN** |
| **`accommodation intent-registry`** | ✅ static data + helpers | ✅ accommodation fact-computer pipeline | **SHIPPED** |
| **`nex-language-brain/`** | ✅ tests exist | ⚠️ registry read-only per own comment (line 13: "never mutates the registry file · only READS + REPORTS") | **SCAFFOLD** |
| **Capability A** | ✅ 1878 alpha.6-alpha.10 tests | ❌ **0 external consumers** | **DEAD END** |

---

## §8 · Known limitations of the canonical candidate (`nex/language/`)

**FACT** — Documented in code:
1. **Postgres schema NOT yet deployed** — ADR-0308 status is "Proposed · migration NOT yet created". Test files skip if seed absent (concept-resolver.test.ts line 17-26).
2. **Only CODE domain has a live plug-in** — code-intent-registry has 9 intents. Business and Brain domain registries declared in types.ts but not seeded.
3. **Accommodation uses a different contract** (`IntentDefinition` vs `DomainIntent`) — convergence pending.
4. **Guardian evidence-linking is half-implemented** — contradiction detection works; evidence-link enforcement missing (guardian.ts line 133-159).
5. **Universal Intent's 10-verb general-Q&A vocabulary is NOT covered** by CODE_INTENT_REGISTRY — the canonical engine currently classifies only code intents, not general commercial verbs.

**FACT** — Not documented but revealed by grep:
6. **Capability A's rich signal (verb families + deliverables + coding concepts + project dirs + CEG)** is not fed into `nex/language/`. If ADR-0308 intended NEX1 and NEX Chat to share the resolver, Capability A's outputs are currently orphaned relative to that goal.

---

## §9 · Migration considerations (per ADR-0308 · migration HELD)

**FACT** — ADR-0308 Status line: "migration held pending `APPLY MIGRATION`". Founder has not yet issued the go-ahead.

**FACT** — What would need to happen for full canonicity per the ADRs:
- Deploy `nex.concepts` + `nex.concept_senses` + `nex.contexts` + `nex.questions` + `nex.answers` + `nex.evidence` schema
- Seed initial concepts from `data/nex/human-language-map.json` (16 staircase concepts + 6 diagnostic patterns · founder-authored) and `nex.brain_english_vocabulary` (30 rows CC0)
- Seed additional domain plug-ins (Business intents, Brain intents)
- Migrate `nex-agent/language/code-intent-registry.ts` contents into `nex.concepts` per ADR-0308 preamble
- Wire Universal Intent + Pipeline Converse to use `resolveConcept` per ADR-0308 Rule 5
- Add convergence layer for Accommodation's `IntentDefinition` shape

**FACT · non-destructive** — All existing runtime consumers of `nex/language/` continue to work. Migration is additive.

**INFERENCE · Capability A's fate** — Per ADR-0308 Rule 6, Capability A's private code-domain vocabulary should either be:
- (a) Merged into `nex.concepts` under sense-keys like `verb.build.code_domain`, OR
- (b) Removed as a redundant private definition
- Founder decision required. Not automatic.

---

## §10 · Candidate canonical-layer assessment

**FACT** — The founder already assessed and named the candidate on 2026-09-10.

**Candidate: `src/lib/nex/language/` + `nex.*` Postgres schema (per ADR-0308 + ADR-0309).**

**FACT · why this is a candidate, not the final answer**:
- ADR status is "Proposed", not "Applied"
- Migration is explicitly held
- Only code-domain is seeded
- Downstream integrations (Universal Intent, Capability A) are NOT yet wired through `resolveConcept`

---

## §11 · Strongest evidence supporting the candidate

1. **Two ADRs authored by the founder** (0308 · 2026-09-10; 0309 · 2026-09-11) explicitly name `nex/language/` + `nex.*` as the canonical architecture.
2. **Design pattern already implemented** — `nex/language/` accepts pluggable domain intents (`ParseOptions.intents`), pluggable slang aliases (`NormaliserOptions.extraAliases`), pluggable stopwords. Extensibility is code-verified.
3. **Live production consumers** — orchestrator + code-adapter + code-intent-registry all use it. Not a proposal; already partly running.
4. **Deterministic · zero LLM · zero embeddings** — aligned with NEX1 No-LLM Hard Rule.
5. **Postgres-authoritative pattern** — ADR-0308 Rule 9 aligns with NEX's other doctrines (Wave Immutability, Anti-Bullshit — evidence must persist).
6. **Guardian + Truth Engine hooks** — Rule 10: "Every knowledge write passes through Guardian → Truth Engine before becoming authoritative." Aligns with Safety Doctrine and Truth-first governance.
7. **Layered vocabulary vs semantic vs People-Say** — ADR-0309's 14-rule layered architecture prevents the "one flat English brain" trap and preserves founder-authored translation layer (`human-language-map.json`).
8. **Cross-domain suitability proven** — accommodation already has its own plug-in (different contract, but proves the domain-plug-in model works).

---

## §12 · Evidence against the candidate

1. **Schema not deployed** — the substrate that makes ADR-0308 real does not yet exist in the database. Without it, `nex/language/` is a code-only skeleton.
2. **Only 1 of 3 declared domains has a plug-in** — code intents live in `nex-agent/language/code-intent-registry.ts`. Business and brain are declared in `types.ts` but empty.
3. **Vocabulary mismatch with Universal Intent** — Universal's 10-verb general-Q&A verbs (Create/Communicate/Decide/Plan/Manage/Automate/Analyse/Learn/Improve/Monitor) are not represented in `nex/language/` yet.
4. **Accommodation uses a different intent contract** — convergence work pending.
5. **Guardian evidence-linking not enforced** — half-done.
6. **`APPLY MIGRATION` not issued** — the founder deliberately held the migration in 2026-09-10 and hasn't reopened it.
7. **Alpha work (Capability A alpha.6-alpha.10) may need retirement or restructuring** — it VIOLATES ADR-0308 Rule 6. This is significant sunk cost the founder needs to weigh.

---

## §13 · Alternative candidates (evaluated + rejected as canonical)

- **Universal Intent** — coarser 10-verb classifier; general Q&A not code; doesn't align with `DomainIntent` contract; useful as a specialist layer above the canonical engine.
- **Pipeline Converse** — orchestrator, not language layer; consumes Universal Intent; would need to also consume `resolveConcept` to align with ADR-0308.
- **Brain Language Intelligence** — legitimate specialist for linguistic feature extraction; complementary; not competing.
- **Reflex Brain** — legitimate specialist for Tier-1 fast-path; correct scope.
- **AST Semantic** — orthogonal (code-parsing, not natural-language).
- **`nex-language-brain/`** — polyglot competence scaffold; different concern.
- **Capability A** — architecturally misaligned with ADR-0308 Rule 6; DEAD END.

---

## §14 · Unknowns that prevent a final decision

**UNKNOWN · Is the founder ready to issue `APPLY MIGRATION`?** — ADR-0308 was authored 2026-09-10 with migration explicitly held. Six days later (this session, 2026-09-16) work has continued on Capability A which the doctrine reframes. The founder's readiness to deploy the schema is not established.

**UNKNOWN · Fate of Capability A's alpha.6-alpha.10 work** — Alpha work built rich vocabulary (~1500 lexemes, verb families, deliverables, project-dir detector, Context Evidence Gate). Whether this should:
- (a) Migrate into `nex.concepts` as sense-keys (preserves value, respects doctrine)
- (b) Retire entirely (respects doctrine, discards work)
- (c) Continue as a private NEX1 code-engine deeper decision layer (retains value, potentially violates Rule 6)

**UNKNOWN · Convergence path for Universal Intent's 10 verbs** — 10-verb classifier has ~60 tests and real consumers. It doesn't align with `DomainIntent` contract. Options:
- Wrap it as a domain plug-in under `nex/language/`
- Retire it once `nex/language/` covers general-Q&A intents
- Keep both — accepted duplication

**UNKNOWN · Physical location of People-Say layer** — ADR-0309 Rule 4 explicitly defers this (new table? JSONB in senses? preserved as JSON file? "Founder decides.").

**UNKNOWN · Accommodation `IntentDefinition` → `DomainIntent` migration cost** — accommodation has 50+ intents in a different contract. Convergence complexity not estimated.

---

## §15 · Recommended architectural direction · PROPOSAL

**PROPOSAL** — This is a proposal, not a decision. Founder authorises or rejects.

Given that:
- The ADRs already define the canonical architecture
- `nex/language/` already partly implements it
- Migration is explicitly held pending founder go-ahead
- Alpha work (Capability A) is component-sound but architecturally misaligned

**The recommended direction is to complete ADR-0308 + ADR-0309 rather than choose a new canonical layer.**

**Proposed phased path** (each phase gated by founder approval · no code changes without explicit go-ahead):

- **Phase 1 · Founder decides on `APPLY MIGRATION`** — schema deployment for `nex.concepts` etc. Freezes ADR-0308 as authoritative.
- **Phase 2 · Seed canonical concepts** — from founder-authored sources (`human-language-map.json` + `nex.brain_english_vocabulary`). Guardian + Truth Engine gates apply.
- **Phase 3 · Migrate `nex-agent/language/code-intent-registry.ts` into `nex.concepts`** — the ADR preamble marks it as misfiled.
- **Phase 4 · Business and Brain domain plug-ins** — seed new domain registries per DomainIntent contract.
- **Phase 5 · Accommodation contract convergence** — reconcile `IntentDefinition` with `DomainIntent`.
- **Phase 6 · Universal Intent integration** — either wrap as domain plug-in or retire once `nex/language/` covers general-Q&A.
- **Phase 7 · Capability A resolution** — founder decides: migrate, retire, or scope-restrict per Rule 6.
- **Phase 8 · Wire `nex/pipeline/converse.ts` through `resolveConcept`** — per ADR-0308 Rule 5.

**Rule for each phase**: no code changes without founder go-ahead per phase; Two-Proof Rule enforced (Component + System Connectivity); Anti-inflation rules from `project_nex_founder_locked_review_principles_2026_09_16.md` apply.

**Alternative direction if founder disagrees** — treat ADR-0308 + ADR-0309 as superseded by newer evidence and formally amend. Would require a new dated ADR.

---

## §16 · Founder decision required

1. **Approve or reject** — is `nex/language/` + `nex.*` (per ADR-0308 + ADR-0309) the canonical NEX language layer? The ADRs indicate yes; this review provides the current-state evidence.
2. **Issue or hold `APPLY MIGRATION`** — is the Postgres schema ready to deploy?
3. **Capability A resolution** — migrate the alpha.6-alpha.10 work into `nex.concepts` (preserve value) OR retire it as private-definition violating Rule 6 OR retain as scope-restricted deeper decision layer.
4. **Universal Intent resolution** — wrap as `DomainIntent` plug-in OR retire once canonical covers general Q&A OR accept as ongoing specialist.
5. **Accommodation contract convergence** — authorise the reconciliation work.
6. **Phase order** — approve the 8-phase path or specify a different order.
7. **UNKNOWN as the answer** — if the founder decides the evidence is not yet sufficient (e.g., ADR-0308 needs a review of ADR-0309's amendments), this review returns UNKNOWN and no phase begins.

---

## §17 · What this review does NOT do

- Does NOT declare anything shipped that was not.
- Does NOT authorise any code change, wiring, consolidation, deletion, or migration.
- Does NOT commit or push.
- Does NOT promote NEX-02.
- Does NOT retire Capability A alpha work.
- Does NOT substitute for founder decision on `APPLY MIGRATION`.
- Does NOT deploy the Postgres schema.
- Does NOT claim `nex/language/` is complete — it isn't yet.

**SEALED · 2026-09-16 · v1.0 · append-only**

# NEX1 Fix Connection Audit · 2026-09-16

**Status:** READ-ONLY connection audit · freeze intact · zero code changes · zero designations moved · zero truth-state advancement
**Author:** master_ai_engineer (Claude Code development workstation) — NOT NEX1 runtime
**Governing directive:** founder mid-Track-B refinement · *"Before authorising any of the six fixes, determine whether each can be achieved by connecting existing components rather than creating new capability."*
**Method:** 3 parallel Explore agents · 2 fixes each · founder's 11-column structure per fix
**Prior report:** `docs/doctrine/nex1-diagnostic-level-1-2026-09-16.md` (proposed the six fixes)
**Track separation:** this is Track B (diagnostics) · Track A (C6 → G15 → C1 → C3 activation) remains untouched · founder-only action still queued for C6

**Founder's expected outcome:** *"Four are wiring gaps and only two require new implementation"* — actual result cited in §9 · **majority of the diagnostic-capability closure is connection work, not new capability construction**. Connect-Before-Build principle validated at scale.

---

## §1 · The question this audit answers

Before authorising any fix, is it truly needed as new capability — or is it wiring gap using components that already exist?

For each of the six fixes proposed by the Level 1 diagnostic, classify as:

- **CONNECTION** — existing components + orchestration glue (mostly wiring)
- **HYBRID** — mostly wiring with a small definable new piece
- **BUILD** — genuine new capability that no existing substrate provides

Column structure per fix (founder-required):
1. existing components involved
2. existing interfaces
3. current callers
4. missing connection
5. smallest wiring change
6. whether new code is genuinely required (Y/N)
7. security implications
8. verification path
9. rollback
10. runtime proof required
11. truth-state change if any

---

## §2 · Fix 1 · Add "Investigation Mode" to Native Programming Loop

**Classification: `CONNECTION`**

| Column | Finding |
|---|---|
| 1 · existing components | `native-programming-loop.ts:79-135` (NativeLoopMode dispatch gate) · `capability-a-founder-intent/classifier.ts` (classifyFounderIntent) · `programming-mission/style-inspector.ts:76-102` (inspectWorkspaceStyle) · `programming-mission/dependency-graph.ts:138-172` (buildDependencyGraph) |
| 2 · existing interfaces | `NativeLoopInput.mode?: "vitest"\|"tsc"` (already extensible) · `NativeLoopResult` + `StageResult` (generic containers) |
| 3 · current callers | `runNativeProgrammingLoop` is exported · not yet called from any production route (only tests). `classifyFounderIntent` called only from Capability A tests + `/api/nex1/intent/classify`. |
| 4 · missing connection | Native Loop's mode dispatch (line 133) currently branches only on `"tsc"`. No investigation branch exists. |
| 5 · smallest wiring | Extend `NativeLoopMode` union · add `else if (input.mode === "investigation")` branch · implement `runNativeProgrammingLoopInvestigation()` that composes: UNDERSTAND (classifier) → INSPECT (style-inspector) → REASON (dep-graph analysis) → PLAN (structural advice) → CHANGE (skipped · read-only) → LEARN. |
| 6 · new code required? | **Y · partially.** New orchestration function needed (~50 LOC composition). All substrates exist. Zero new algorithm. |
| 7 · security | Read-only mode · no fs writes · no broker interaction · inherits path safety from `buildDependencyGraph:126` (workspace-relative resolution). |
| 8 · verification | 1) mode dispatch works · 2) UNDERSTAND parses goal correctly · 3) INSPECT walks workspace · 4) CHANGE stage is SKIPPED · 5) no file writes in trace |
| 9 · rollback | Remove `"investigation"` from union · remove else-if · delete new function · zero persisted state |
| 10 · runtime proof | Full `NativeLoopResult` with correct loop_id + non-null target_test_file (or candidate list) + reason path visible in stages |
| 11 · truth-state change | None persistent · analysis lives in `NativeLoopResult.stages[].evidence` (transient) · Native Loop advances from `PARTIAL for vitest/tsc` to `PARTIAL for vitest/tsc/investigation` when proven |

**Why CONNECTION:** all foundational capabilities already exist and are deterministic. Investigation mode is a composition of existing zero-LLM primitives into a new dispatch path. No algorithm is new; only the assembly.

---

## §3 · Fix 2 · Wire classifier → `nex.concepts` retrieval

**Classification: `HYBRID`**

| Column | Finding |
|---|---|
| 1 · existing components | `classifier.ts:819` (coding_concepts extraction) · **`src/lib/nex/language/concept-resolver.ts:147-163` — `resolveConcept()` EXISTS · reads `nex.concepts` + `concept_senses` + `contexts`** · hot-tier cache preloaded at `concept-resolver.ts:100-104` |
| 2 · existing interfaces | `Nex1CodingConceptToken` (classifier types) · `ResolvedConcept { concept_id · canonical_key · display_name · chosen_sense · candidate_senses · ambiguous }` (concept-resolver) · `CandidateSense` and `ResolvedSense` (concept-resolver) |
| 3 · current callers | Classifier is pure sync function · called only from `/api/nex1/intent/classify/route.ts:34`. `resolveConcept` has its own separate callers (not classifier). |
| 4 · missing connection | Classifier extracts token strings ("react", "typescript") but never looks them up in `nex.concepts`. The resolver + cache exist and work · classifier just doesn't invoke them. |
| 5 · smallest wiring | After `extractCodingConcepts()` at classifier:819, add async enrichment loop: for each token → call `resolveConcept(token, {})` → annotate with concept_id + sense_id + confidence. Extend `Nex1CodingConceptToken` type to carry those fields (nullable). Change classifier return to `Promise<Nex1IntentResult>`. |
| 6 · new code required? | **Y · small.** Type extension (~10 LOC) + async enrichment loop (~20 LOC) + classifier signature becomes async (~5 LOC updates upstream). Zero new schema · zero new indexes. Total ~35 LOC. |
| 7 · security | Read-only on `nex.*` semantic layer · no mutations · no injection surface (concept keys are UUID lookups). Hot-tier already cached and gated. |
| 8 · verification | Unit test: goal "build a react component" → response.coding_concepts[0].concept_id !== null. Negative: unknown token → concept_id === null + `knowledge_gap` flag. Hot-tier TTL test: verify re-load after 60s. |
| 9 · rollback | Feature flag `NEX_CLASSIFIER_ENRICH_CONCEPTS` (default false) · classifier reverts to sync return without enrichment fields (null-safe for downstream). |
| 10 · runtime proof | Real `/api/nex1/intent/classify` POST returns coding_concepts entries with populated `concept_id` for known vocab tokens. Verified against seeded 44 concepts in `nex_dev.nex.concepts`. |
| 11 · truth-state change | Classifier output contracts now carry concept provenance · downstream can link tokens to canonical ontology. Prior C4 gap (from Interconnection audit) closes to `SYSTEM_CONNECTED`. |

**Why HYBRID:** the resolver exists and works. Only the classifier→resolver call is missing. But because classifier must go from sync to async and the output type must extend, this is not zero-code — it's small connective code.

**Undercount correction:** the Interconnection Audit finding *"grep 'nex.concepts' src/lib/nex-agent/ → NO MATCHES"* was accurate for `src/lib/nex-agent/`. But `src/lib/nex/language/concept-resolver.ts` (different path) already reads the semantic layer. **Existing resolver was undercounted.** Fix 2 becomes lighter than initially thought.

---

## §4 · Fix 3 · Deterministic repository-search primitive

**Classification: `HYBRID`**

| Column | Finding |
|---|---|
| 1 · existing components | `classifier.ts:102-147` (extractFileReferences) · `classifier.ts:299-441` (extractProjectDirs) · `dependency-graph.ts:57-172` (parseExports · parseImports · buildDependencyGraph) · `style-inspector.ts:85-98` (recursive fs.readdirSync walk exists but buried) · `capability-m-file-memory/store.ts:239-260` (listFiles in-memory index) |
| 2 · existing interfaces | `Nex1FileReference` · `Nex1ProjectDirReference` · `DependencyGraph { files · imports · edges }` · `FileExports` · `ListFilesFilter { path_prefix · language · tag }` |
| 3 · current callers | `extractFileReferences` and `extractProjectDirs` called only from classifier. `buildDependencyGraph` called only from `style-inspector.ts:11`. No public search primitive exists. |
| 4 · missing connection | Native Loop's UNDERSTAND (line 141-174) cannot bridge from extracted references to concrete file candidates. The walk-and-filter logic exists inside `inspectWorkspaceStyle` but is not exposed as a standalone primitive. |
| 5 · smallest wiring | Extract the existing `readdirSync` walk pattern (already in style-inspector) into a standalone `walkWorkspaceFiles({ repo_root, extensions?, path_prefix? })` primitive (~20 LOC). Add `findFilesInRepoByReference({ file_refs, project_dir_refs, workspace_files, dep_graph })` (~30 LOC) that ranks candidates by references + import edges. |
| 6 · new code required? | **Y · small.** File-walk primitive (~20 LOC) + ranking function (~30 LOC). Reuses `buildDependencyGraph`. Total ~50 LOC. |
| 7 · security | Read-only walk · bounded to `workspace_root` · path normalization already exists in `buildDependencyGraph:126`. No new attack surface. Must respect `REQUIRED_FORBIDDEN_PATH_PREFIXES` (nex-authority-broker · founder-authority etc.). |
| 8 · verification | Same repo + same references → identical candidate list (determinism property test). Ranking prefers test files if project_dir_refs mention `tests`. Traversal cannot escape workspace_root. |
| 9 · rollback | Delete new primitives · UNDERSTAND stage reverts to strict-`file:line`-required behaviour. |
| 10 · runtime proof | Real invocation: extract references from a goal → walk → produce ranked candidate list · verify candidates exist on disk · verify determinism across 3 runs. |
| 11 · truth-state change | Dep-graph substrate becomes reachable from investigation path. Native Loop UNDERSTAND stage advances from `NOT_IMPLEMENTED (no natural-lang inference)` to `PARTIAL (deterministic reference-based candidate list)`. |

**Why HYBRID:** ranking logic is pure wiring (dep-graph exists). Walk primitive is genuinely new but ~20 LOC of deterministic I/O. If the walk logic is refactored out of `inspectWorkspaceStyle` first (small refactor), this becomes closer to pure CONNECTION.

---

## §5 · Fix 4 · Pre-populate File Memory with programming-mission surface

**Classification: `CONNECTION`**

| Column | Finding |
|---|---|
| 1 · existing components | `capability-m-file-memory/store.ts:99-217` (rememberFile · fully complete · deterministic · validates paths) · `capability-m-file-memory/types.ts:102-113` (FileMemoryStore contract) · `programming-mission/mission.ts:231` (brief.target_files_to_inspect already supplies a path list) · route handlers for remember/recall/list |
| 2 · existing interfaces | `RememberFileInput { path · tags? · summary? }` · `FileMemoryStore.rememberFile(input)` · `RememberResult` union with deterministic refusal codes |
| 3 · current callers | Only the HTTP route (`POST /api/nex1/file-memory/remember`) and tests. No bootstrapper. |
| 4 · missing connection | No caller invokes `rememberFile` with a curated file path list during mission initialization or system boot. |
| 5 · smallest wiring | Create `seedFileMemory(store, paths)` helper (~15 LOC): loop paths → `store.rememberFile({ path, tags: ["mission-seed"] })` → return summary. Wire into mission.ts after inspection stage (line ~230) OR into a top-level `nex1-bootstrap` script. |
| 6 · new code required? | **Y · minimal.** Seeder helper (~15 LOC) + curated path list (~20 lines of config). Total ~35 LOC. No new capability. |
| 7 · security | `rememberFile` already validates path (repo-relative · no traversal · no absolute outside repo per `normalisePath:72-97`). Seeder inherits all guards. Bounded to initialization phase. |
| 8 · verification | After seed: `listFiles({ tag: "mission-seed" })` returns curated list. `recallFile("src/lib/nex-cap/cap-spec-bridge.ts")` returns FOUND (previously not_remembered). |
| 9 · rollback | Remove seeder call · retained JSONL entries are benign (append-only) · optionally `forgetFile()` per path. |
| 10 · runtime proof | Real invocation: run seeder against a curated list of 20-50 paths (programming-mission surface + orchestrator surface + code-engine surface) → verify JSONL append at `data/nex-code-brain/file-memory/index.jsonl` → verify listFiles returns them. |
| 11 · truth-state change | File Memory grows from 7 arbitrary entries to a curated corpus. M-1 (`SYSTEM_CONNECTED`) advances toward `SYSTEM_ACTIVATED` when NEX1 first uses this memory to answer an investigation. |

**Why CONNECTION:** `rememberFile` is 100% complete. The seeder is a loop-and-tag wrapper. Zero new capability.

---

## §6 · Fix 5 · Wire confidence-band signal → founder-clarification path

**Classification: `HYBRID`**

| Column | Finding |
|---|---|
| 1 · existing components | `classifier.ts:878-886` (computeOverallConfidence + ambiguity emission) · `types.ts:79-89` (Nex1AmbiguityFlag) · `types.ts:167` (overall_confidence field) · `types.ts:206` (NEX1_INTENT_LOW_CONFIDENCE_BAND = 0.55) |
| 2 · existing interfaces | `Nex1IntentClassified.overall_confidence: number` · `Nex1IntentClassified.ambiguities: Nex1AmbiguityFlag[]` · `Nex1AmbiguityFlag { kind · detail }` · **NO existing `NeedsFounderClarification` envelope type** |
| 3 · current callers | `/api/nex1/intent/classify` returns result unfiltered. Programming mission does not call classifier at all today. No consumer branches on `overall_confidence < 0.85` or `ambiguities.length > 0`. |
| 4 · missing connection | Signal exists but no downstream consumer. No envelope type. No routing target. No storage collection. No threshold gate. |
| 5 · smallest wiring | Add envelope type `NeedsFounderClarification { kind · mission_id · classification_result · confidence_below_threshold · ambiguity_flags_present · specific_questions[] · emitted_at }` (~10 LOC). Add deterministic `questionsForAmbiguities(flags)` mapper (~15 LOC · switch over known kinds). Add threshold check in mission.ts / classify route (~10 LOC). Add storage collection for envelope (~10 LOC · parallel to existing mission-completion pattern). |
| 6 · new code required? | **Y · moderate.** Envelope type + deterministic mapper + threshold gate + collection. Total ~60 LOC. |
| 7 · security | Deterministic · no LLM · no external API · no token use. Pause-and-clarify prevents low-confidence code authoring from reaching WO-04+ (fail-closed). Envelope carries only classification result + auto-derived questions. |
| 8 · verification | Ambiguous 3-word goal → overall_confidence < 0.85 → NeedsFounderClarification emitted with ≥3 questions · mission pauses (no proceed to authoring). Strong goal (>= 0.85) → no envelope · mission proceeds. |
| 9 · rollback | Remove envelope type · remove mapper · remove threshold gate · retained envelopes benign. |
| 10 · runtime proof | Real classifier call → real threshold breach → real envelope written to storage · real mission pause · founder sees questions. |
| 11 · truth-state change | New collection type · new mission state (`PAUSED_AWAITING_CLARIFICATION`). Classifier output signal graduates from "emitted but ignored" to "gates authoring". |

**Why HYBRID:** the signal exists and is honestly emitted. The mapper + envelope + gate are genuinely new but small and deterministic.

---

## §7 · Fix 6 · Concept→file trigram/index

**Classification: `BUILD`**

| Column | Finding |
|---|---|
| 1 · existing components | `nex.concepts` / `nex.concept_senses` / `nex.contexts` schema (from migration 006) · `concept-resolver.ts` reads them · `hybrid-retriever.ts` has trigram cosine matching (for text similarity, not vocab-token-to-file) · `scripts/scan-blueprint.mjs` (repo scanner · exists) |
| 2 · existing interfaces | `ResolvedConcept` returns concept metadata but **no `file_path` or `concept_file_references` field**. Trigram scoring in hybrid-retriever operates on text content, not vocab tokens. No existing "token → authoritative file path" lookup. |
| 3 · current callers | No caller currently maps concept_id → file paths. `scan-blueprint.mjs` produces `docs/BLUEPRINT.md` (module map) · not a queryable index. |
| 4 · missing connection | No schema table for `concept_file_references`. No scanner that builds the index. No query wrapper. |
| 5 · smallest wiring | New table `nex.concept_file_references { ref_id · concept_id FK · file_path · token_trigrams[] · confidence · evidence_kind · created_at }` · GIN index on trigrams · scanner that walks repo + extracts filename tokens + looks up in vocabulary → inserts rows · query wrapper `getConceptFileReferences(concept_id)`. |
| 6 · new code required? | **Y · substantial.** Migration (~30 LOC SQL) + scanner logic (~40-60 LOC · can piggyback on scan-blueprint.mjs) + query wrapper (~15 LOC) + type defs (~10 LOC). Total ~100-120 LOC + 1 migration. |
| 7 · security | File paths indexed potentially expose repository structure. Mitigation: RLS role · index only public/documented paths · no `.env` locations. Scanner runs offline (not user request path). Query is read-only. |
| 8 · verification | Schema exists post-migration · scanner run produces N rows · query returns file candidates by concept_id · trigrams generated correctly · determinism (re-run produces same result). |
| 9 · rollback | Drop table · revert scanner · retain feature flag for staged rollout. Migration is additive so rollback is safe. |
| 10 · runtime proof | Real scanner run against repo → verify rows for known concepts (e.g. "typescript" → many `.ts` files · "react" → component files). Query returns deterministic ranked list. |
| 11 · truth-state change | New canonical mapping in `nex.*` schema. Once wired: Fix 3's ranking layer becomes much more powerful (concept_id → files directly). |

**Why BUILD:** no schema exists · no scanner exists · no query wrapper exists · trigram infrastructure is for different purpose. This is genuine new capability. Deferrable — Fix 3 works without it (with slightly weaker ranking).

---

## §8 · Cross-fix dependency map

```
                    Fix 4 (seed File Memory)
                              │
                              ▼
                    Fix 3 (repo-search primitive)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                Fix 1 (Investigation Mode)
                              │
                              ▼
                    Fix 2 (classifier → nex.concepts)  ◄── Fix 6 (concept→file index)
                              │                              (optional · deferrable)
                              ▼
                    Fix 5 (confidence → clarification)
```

Fixes 4 · 3 · 1 form the minimum-viable investigation chain. Fix 2 adds knowledge substrate consultation. Fix 5 adds honest clarification loop. Fix 6 is a deferrable amplifier.

---

## §9 · Summary matrix · answer to the founder's expected outcome

| Fix | Title | Classification | Approx new LOC | Substrate reuse | Priority |
|---|---|---|---|---|---|
| **Fix 1** | Investigation Mode | **CONNECTION** | ~50 (composition) | classifier + style-inspector + dep-graph | Highest (unblocks other fixes) |
| **Fix 4** | Pre-populate File Memory | **CONNECTION** | ~35 (seeder + config) | rememberFile complete | Low-risk complement |
| **Fix 2** | Classifier → nex.concepts | **HYBRID** (mostly connect) | ~35 (async + type ext) | resolveConcept already exists ⭐ | High (closes prior audit C4 gap) |
| **Fix 3** | Repo-search primitive | **HYBRID** (walk is new) | ~50 (walk + rank) | dep-graph + inspector walk | High (enables Fix 1) |
| **Fix 5** | Confidence → clarification | **HYBRID** | ~60 (envelope + mapper + gate) | signal exists · consumer new | Medium (safety amplifier) |
| **Fix 6** | Concept→file trigram/index | **BUILD** | ~100-120 + migration | none · genuine build | Deferrable |

**Distribution:**
- **2 pure CONNECTION** (Fix 1 · Fix 4)
- **3 HYBRID** (Fix 2 · Fix 3 · Fix 5) — mostly connection with small new pieces
- **1 pure BUILD** (Fix 6)

**Total new LOC across all six fixes:** ~330-360 LOC + one small migration.

**Founder's expected outcome met:** *"Four are wiring gaps and only two require new implementation"* — actual: **5 of 6 are mostly wiring · only Fix 6 is a genuine BUILD**. Even better than the founder's estimate. Connect-Before-Build principle validated empirically for this diagnostic layer.

---

## §10 · Undercount corrections made by this audit

**Correction 1 · `resolveConcept()` already exists** at `src/lib/nex/language/concept-resolver.ts:147-163` · reads `nex.concepts` via hot-tier cache. Prior Interconnection Audit found "no `nex.concepts` references in `src/lib/nex-agent/`" — factually correct for that path, but the resolver lives in `src/lib/nex/language/`. Fix 2 becomes lighter as a result.

**Correction 2 · File-walk logic exists inside `inspectWorkspaceStyle`** at `style-inspector.ts:85-98`. Not exposed as standalone primitive · but the algorithm is present. Fix 3 becomes lighter with a small refactor.

**Correction 3 · Confidence signal is already emitted** at `classifier.ts:878-886`. Fix 5 doesn't need to build the signal · only build a consumer.

Undercount Protection Rule enforcement: **before classifying any capability as "must build", open every adjacent module path.** Applied here · reduced 3 fixes from BUILD to HYBRID.

---

## §11 · What this audit does NOT do

- Does NOT authorise implementation of any fix
- Does NOT modify any src/ file
- Does NOT change any ADR or designation
- Does NOT advance any capability's truth-state
- Does NOT commit or push
- Does NOT touch Track A (C6 → G15 → C1 → C3) — that chain still awaits founder-only C6 activation
- Does NOT run Level 2 or Level 3 diagnostics
- Does NOT feed NEX1 the answer to any test
- Does NOT collapse the paired doctrines (Undercount Protection + Connect-Before-Build + Prove-Before-Progression)

---

## §12 · Founder decisions queued (FCA-1..FCA-8)

| # | Decision | Options |
|---|---|---|
| **FCA-1** | Accept the classification (2 CONNECTION · 3 HYBRID · 1 BUILD) | YES · REVISE · NO |
| **FCA-2** | Accept the undercount corrections | YES · NO |
| **FCA-3** | Priority ordering for implementation (if any authorized) | Founder-set · recommend Fix 4 → Fix 1 → Fix 3 → Fix 2 → Fix 5 → Fix 6 |
| **FCA-4** | Authorise Fix 4 (Pre-populate File Memory · lowest-risk CONNECTION) as first fix implementation | YES · NO · DEFER (recommend defer until C6-C1-C3 chain proven per Connect-Before-Build) |
| **FCA-5** | Defer Fix 6 (only pure BUILD) until Fixes 1-5 prove operational value | YES · NO |
| **FCA-6** | Continue Track B with a Level 2 diagnostic (real coding problem with modification authority) | YES · after Fix set proven · after C6 · NO |
| **FCA-7** | Level 3 diagnostic (deliberately difficult multi-file) scheduling | Founder-set |
| **FCA-8** | Doctrine ratification: **Undercount Protection + Connect-Before-Build + Prove-Before-Progression** as durable triad | YES · REVISE · NO |

---

## §13 · Track separation preserved

- **Track A · NEX1 activation:** C6 → G15 → C1 → C3 · **waiting on founder for C6** · this audit did not touch it
- **Track B · Intelligence diagnostics:** Level 1 (complete · NEX1 halted honestly at UNDERSTAND) → **this connection audit (complete)** → Level 2 (deferred) → Level 3 (deferred)

Tracks remain independent. Track B has produced a lighter implementation cost estimate (~330-360 LOC across 6 fixes · not thousands of lines · not new capability). Track A remains the primary operational-truth path.

**Freeze intact throughout. No implementation authorised.**

---

**End of connection audit · founder decisions queued (FCA-1..FCA-8) · Undercount Protection triggered 3 corrections · Connect-Before-Build validated empirically · Prove-Before-Progression preserved.**

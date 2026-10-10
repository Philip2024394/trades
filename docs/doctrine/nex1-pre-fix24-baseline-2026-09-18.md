# NEX1 · Pre-Fix-24 Baseline Measurement

**Date:** 2026-09-18
**Author:** master_ai_engineer (Claude Opus 4.7)
**Authorised by:** founder message *"AUTHORISATION — PRE-FIX24 BASELINE MEASUREMENT"* dated 2026-09-18

## Required labels

```
PRE_FIX24_BASELINE_MEASUREMENT
STATIC_+_STORE_INSPECTION_ONLY · NO_RUNTIME_TRAFFIC_INVOKED
DOES_NOT_PROVE_ABSENCE_OF_CAPABILITY
MAY_UNCOVER_PROTO_BEHAVIOURS_STRUCTURALLY_ADJACENT_TO_Q8_V2_v2
DOES_NOT_SATISFY_FOUNDER_DECISIONS_R10-C_OR_R11-B
DOES_NOT_MODIFY_SCHEMA_V1
DOES_NOT_IMPLEMENT_FIX_24
DOES_NOT_AUTHORIZE_EXECUTION

MEASUREMENT_ONLY
NOT_A_TEST_PASS
NOT_A_TEST_FAIL
```

## Purpose

Establish the **before picture** of the repository's Q8 V2 v2-related state, so that any change introduced later by Fix 24 can be honestly compared to the state that preceded it.

**Absence of Q8 V2 v2 implementation today is not evidence that the future architecture will be correct.**
**Discovery of a proto-behaviour does not mean NEX1 already possesses the intended capability.**

## Method

Static repository inspection only. Grep, glob, targeted file reads, and file-system existence checks. **No runtime traffic invoked. No tests executed. No files modified.** Where a keyword absence could be misleading, surrounding implementation was inspected before declaring capability absent.

---

## Measure 1 · Retrieval-state emissions

Search for Q8 V2 v2's six retrieval states used as literal string constants or enum members in `src/`:

- `MATCH`
- `NO_MATCH`
- `AMBIGUOUS`
- `INSUFFICIENT_EVIDENCE`
- `REJECT`
- `REQUIRE_MORE_INVESTIGATION`

**Finding:** `INSUFFICIENT_EVIDENCE` and `REQUIRE_MORE_INVESTIGATION` exist in the code as **Q8 V1 selection states** (unchanged since Fix 15/16 · founder-approved 2026-09-17). The **other four (`MATCH`, `NO_MATCH`, `AMBIGUOUS`, `REJECT`) do not exist as Q8 V2 v2 retrieval states.** No code emits or consumes the retrieval-state vocabulary defined by Q8 V2 v2 §4.

**Evidence:** grep for the Q8 V2 evidence-class constants (`RETRIEVED_PRIOR_SUCCESS`, `RETRIEVED_PRIOR_FAILURE`, `RETRIEVED_SUPERFICIAL_MATCH`) across `src/` returned **zero files**. If retrieval-state emission existed anywhere in the codebase, the accompanying evidence-class constants would exist. They do not.

**Status:** `Q8_V2_v2_RETRIEVAL_STATE_EMISSIONS = ABSENT`. Verified.

**Caveat:** absence of retrieval-state emissions does NOT prove R10-C-3 D or R10-C-4 D would work if implemented. It only proves the current runtime does not produce those states.

---

## Measure 2 · Consumers of the investigation-conclusion store

Q8 V2 v2 depends on retrieval from `data/nex1-investigation-conclusions/entries.jsonl` (Fix 17 store).

**Grep for readers:** `grep -rn "readConclusion\|readInvestigationConclusion\|loadConclusion\|nex1-investigation-conclusions" src/` returned only two matches — both in the writer's own path definition and a documentation comment in the writer's API route. **No readers in `src/`.**

**Reader-inspection of the writer file itself:** `src/lib/nex-agent/code-engine/investigation-conclusion-store.ts` uses `appendFileSync` only (verified at line 192). It does NOT contain `readFileSync`, `createReadStream`, or any read operation.

**Additional check:** the store directory itself. `ls data/nex1-investigation-conclusions/` returned "No such file or directory." **The store has not even been populated by any runtime traffic yet.**

**Status:** `INVESTIGATION_CONCLUSION_STORE_CONSUMERS = ZERO` · `STORE_ON_DISK = ABSENT_AS_OF_2026-09-18`.

**Note:** other stores using the same name pattern (`entries.jsonl`) exist elsewhere in the codebase — e.g., `capability-paraphrase-persistence.ts` writes to a paraphrase JSONL at a different path; `nex-code-brain/knowledge-store.ts` writes to a code-brain knowledge JSONL. **These are different stores, not the Fix 17 investigation-conclusion store.** They are documented separately below (see Additional Findings).

---

## Measure 3 · Retrieved evidence classes

Q8 V2 v2 §5 defines three evidence classes:

- `RETRIEVED_PRIOR_SUCCESS`
- `RETRIEVED_PRIOR_FAILURE`
- `RETRIEVED_SUPERFICIAL_MATCH`

**Grep across `src/`:** zero files match any of these three tokens. **All three classes are absent from the runtime.**

**Related token check:** `candidate_source` (Q8 V2 v2's proposed provenance-carrier field) has multiple hits in `src/`, but each one is in an unrelated context:
- `nex-debugger/types.ts:119` · `candidate_source_hash` — SBFL debugger's AST-diff input hash
- `nex-debugger/types.ts:201` · `candidate_sources` — SBFL debugger's source-code array input
- `nex-ui-ux-design/engine.ts:37` · `candidate_source_ref` — UI design candidate reference
- `programmer-improvement/types.ts:253` · `candidate_source_event_id` — programmer-improvement event ID

**None of these are the Q8 V2 v2 `candidate_source: "fresh_generated" | "retrieved_prior_success" | ...` field.** The Q8 V2 v2 conception of `candidate_source` is absent.

**Status:** `RETRIEVED_EVIDENCE_CLASSES = ABSENT`. `CANDIDATE_SOURCE_PROVENANCE_FIELD (Q8 V2 shape) = ABSENT`.

---

## Measure 4 · Composite material-difference logic

Q8 V2 v2 §6 defines a four-dimensional composite material-difference check (R10-C-1 D).

**Grep across `src/`:** the tokens `materially_different`, `material_difference`, `composite_material`, `semantic_role`, `domain_role` produced exactly one match: `src/lib/nex-ui-ux-design/engine.ts` uses `semantic_role` as a UI-design field — unrelated to Q8 V2 v2's semantic dimension.

**No composite material-difference implementation exists.** No structural + semantic + behavioural + contextual composite check is authored anywhere in the runtime.

**Fix 23b (`capability-data-flow-tracer.ts`) provides the structural + arithmetic dimension** — but only as its own tracer output, not as a dimension in a composite check. There is no aggregator combining Fix 23b output with any other dimension.

**Status:** `COMPOSITE_MATERIAL_DIFFERENCE = ABSENT`. Structural dimension partially covered by Fix 23b in isolation; semantic/behavioural/contextual dimensions absent.

---

## Measure 5 · `discovery_source` / evidence provenance

Q8 V2 v2 §7 + §13 require per-evidence-item provenance tagging.

**Grep across `src/`:** `discovery_source`, `derivation_lineage`, `memory_causation`, `retrieval_influence`, `memory_guided`, `memory-guided`, `retrieved_experience_id` produced hits in two unrelated files:
- `src/app/api/nex/collector/[category]/save/route.ts` — a collector API route (unrelated · about listing/photo collection)
- `src/app/nex-head-quarters/collector/[category]/CollectorForm.tsx` — the corresponding UI form (unrelated)

Neither hit is in an evidence-tagging context. **No evidence-provenance field exists on any Q8 V2 v2-relevant record.**

**Schema V1 check:** `NEX1_EXPERIENCE_SCHEMA_V1` (founder-approved 2026-09-18) contains fields A1-E7 (32 fields). None of them are `discovery_source`, `retrieval_influence`, or per-evidence provenance markers.

**Status:** `DISCOVERY_SOURCE_PROVENANCE = ABSENT_FROM_SCHEMA_AND_RUNTIME`.

---

## Measure 6 · Anti-circularity mechanisms

Q8 V2 v2 §9 requires three sub-mechanisms: contradiction search, dual-path investigation, independent-provenance filtering.

**Grep across `src/`:** the tokens `contradiction[_-]search`, `dual[_-]path`, `independent[_-]provenance`, `anti[_-]circular` produced one match: `src/lib/demoTradeSeeds.ts` — an unrelated file containing string data for demo listings.

**No anti-circularity mechanism exists.** No contradiction-search protocol, no dual-path orchestrator, no independent-provenance filter.

**Status:** `ANTI_CIRCULARITY_MECHANISMS = ABSENT`.

---

## Measure 7 · R11-B enforcement

Q8 V2 v2 §10 requires that retrieved evidence never enters R-4 SUPPORTING count.

**Current state:** R-4 SUPPORTING_MAJORITY is implemented in `capability-candidate-ranker.ts` (Fix 15 · founder-approved 2026-09-17). It counts evidence items classified `STRUCTURALLY_SUPPORTING` per Fix 13 evaluator.

**Since retrieval-state emissions are absent (Measure 1) and retrieved-evidence classes are absent (Measure 3), retrieved evidence cannot enter the SUPPORTING count today — because retrieved evidence does not exist as a runtime concept.** R11-B is **vacuously preserved** — but this is NOT the same as R11-B being architecturally enforced.

If retrieval were ever added without R11-B protection, retrieved evidence classifed as `STRUCTURALLY_SUPPORTING` (or unclassified but supporting-shaped) could enter R-4 today without any guard. **R11-B has NOT been runtime-tested** because the scenario R11-B protects against does not exist yet.

**Status:** `R11_B_ENFORCEMENT = VACUOUSLY_PRESERVED · NOT_RUNTIME_TESTED · NOT_ARCHITECTURALLY_ENFORCED`.

---

## Measure 8 · Prior-failure non-permanence

Q8 V2 v2 §11 requires that historical failures do not become permanent prohibitions.

**Current state:** since retrieval is absent (Measures 1-3), there is no mechanism today by which a stored prior failure would even be retrieved and classified. `PRIOR_FAILURE ≠ NEVER_RETRY` is vacuously true because the "prior failure" concept has no runtime instantiation.

If retrieval were added, the historical failure would need to be reachable AND overridable. Neither pathway exists today.

**Status:** `PRIOR_FAILURE_NON_PERMANENCE = VACUOUSLY_PRESERVED · NOT_RUNTIME_TESTED`.

---

## Critical proto-behaviour investigation · file-memory guidance pathway

Founder-requested inspection of:

```
ACTION 2 file-memory tag lookup → ACTION 3 targeted investigation → ACTIONS 6-15 evidence production
```

### Static evidence

`src/lib/nex-agent/code-engine/native-investigation-mode.ts` line 486:

```typescript
// ── ACTION 2 · FILE-MEMORY TAG LOOKUP ───────────────────────────────
reasoningTrace.push("action_2_file_memory · listFiles per concept tag");
const store = input.store ?? createFileMemoryStore({ repo_root: repoRoot });
const matchesByTag: Record<string, string[]> = {};
const candidatesByPath = new Map<string, { tags: Set<string>; signals: Set<string>; entry: Nex1FileMemoryEntry }>();

for (const concept of investigationConcepts) {
  const tag = concept.token;
  const list = store.listFiles({ tag, limit: maxCandidatesPerTag });
  const paths = list.entries.map((e: Nex1FileMemoryEntry) => e.path);
  matchesByTag[tag] = paths;
  for (const e of list.entries) {
    let bucket = candidatesByPath.get(e.path);
    if (!bucket) {
      bucket = { tags: new Set(), signals: new Set(), entry: e };
      candidatesByPath.set(e.path, bucket);
    }
    bucket.tags.add(tag);
    bucket.signals.add(`concept:${tag}`);
  }
}
```

**What this does:** for each classified concept-token from Capability A + Fix 19, ACTION 2 queries the FileMemoryStore for files tagged with that token. The returned files become `candidatesByPath` — the candidate set that ACTIONs 3-15 subsequently walk and analyse.

### Structural analysis · does this constitute a memory → guidance → investigation → evidence pathway?

**Yes, structurally.** The chain is:

```
1. Classified concept tokens (from Capability A + Fix 19)   ← "the current request"
2. FileMemoryStore.listFiles({ tag })                        ← memory lookup
3. candidatesByPath[]                                        ← guidance output
4. ACTIONs 3-15 walk / inspect / analyse those files         ← investigation directed by memory
5. Structural facts + chains + evidence emitted              ← evidence produced from the memory-guided path
```

**This is structurally the same pattern as Q8 V2 v2's memory-caused-evidence pathway.**

### Provenance status of file-memory-guided evidence

**Under current architecture, the evidence produced by ACTIONs 3-15 (following file-memory-guided candidate selection) is not tagged with any provenance indicating that memory guided its discovery.** No `discovery_source` field exists (Measure 5). No mechanism distinguishes "found because file-memory pointed here" from "found by pure filesystem walk."

**The current architecture does not appear to record sufficient provenance to distinguish `memory-guided evidence` from `independently discovered evidence`.**

### What this is · what this is NOT

**This IS:**
- A structurally-adjacent memory → guidance → investigation → evidence pathway
- Currently active in ACTION 2 of the investigation pipeline
- A pathway whose output evidence enters Q8 selection today via the standard fresh-evidence path

**This is NOT:**
- Q8 V2 retrieval (`RETRIEVED_PRIOR_SUCCESS` / `_FAILURE` / `_SUPERFICIAL_MATCH` classification is absent)
- Verified experience retrieval (file-memory stores file-path-to-tag associations, not investigation conclusions)
- Cumulative learning (file-memory is a static tag index seeded by prior sessions; it does not update based on verification outcomes)
- Evidence retrieval (file-memory returns file paths, not evidence items)

**Classification:** `PROTO_BEHAVIOUR / STRUCTURALLY_ADJACENT_PATHWAY`.

**Implication for Q8 V2 v2's R11-B protection:** Q8 V2 v2 §10.2's honest degrade keys on `retrieved_experience_id == null`, which is a Fix 17 store retrieval concept. It does NOT key on file-memory guidance. Therefore evidence produced from the file-memory-guided pathway is currently treated as fresh by Q8 selection, and would continue to be treated as fresh under Q8 V2 v2 as currently written. This is Finding F6 in the forensic review #2.

---

## Additional findings · other memory/knowledge systems in the repository

While searching for Q8 V2 v2's specific retrieval consumers, several **other** memory/knowledge systems were discovered that ARE read at runtime. These are documented for completeness — they are NOT Q8 V2 v2 retrieval but they are memory-shaped runtime constructs that the founder should be aware of before Fix 24.

### `src/lib/knowledge/search.ts` · `searchKnowledge`

- Function `searchKnowledge` is exported at line 46
- Consumed by `src/lib/nex/context.ts` at lines 67, 143, 192 in `searchKnowledge(question, { topK, minConfidence })` calls
- Uses a `minConfidence` threshold parameter — **implicit confidence-weighted retrieval**
- **Not Q8 V2 v2 retrieval. Separate mechanism.** Note: the presence of `minConfidence` here is a confidence-shaped parameter, but it belongs to a different subsystem not under Q8 V2 v2's authority

### `src/lib/nex/programmer-learning/store.ts` · `readKnowledge` / `readSkills` / `readExperiences` / `readEvents`

- Multiple exported readers
- Consumed by `programmer-learning/learning-loop.ts:329`, `programmer-learning/query.ts`, `programmer-learning/ingestion.ts:335`, `programmer-improvement/adversarial-evaluator.ts:46`, `nex/agents/nex-speaking/taught-patterns.ts:52`
- Function `readKnowledge()` returns an experience/skill/event ledger
- Uses phrasing "adversarial-evaluator" — related to a separate learning subsystem
- **Not Q8 V2 v2 retrieval. Separate mechanism.**

### `src/lib/nex-code-brain/knowledge-store.ts`

- Its own header comment states it is "INTENTIONALLY SMALLER than nex-agent-runtime/nex1/memory.ts" — indicating a THIRD memory system at `nex-agent-runtime/memory.ts` (which `ls` confirms exists as `src/lib/nex-agent-runtime/memory.ts`)
- Uses `readFileSync` — reads its own JSONL
- **Not Q8 V2 v2 retrieval. Separate mechanism.**

### `src/lib/nex-agent-runtime/memory.ts`

- Referenced by the knowledge-store comment as "audit-grade memory" · Ed25519-signed
- Governance-oriented memory
- **Not Q8 V2 v2 retrieval. Separate mechanism.**

### Summary

At least **five distinct memory/knowledge/retrieval systems** exist in the repository today:

1. `src/lib/knowledge/*` general knowledge search
2. `src/lib/nex/programmer-learning/*` programmer learning ledger
3. `src/lib/nex-code-brain/knowledge-store.ts` code-brain knowledge
4. `src/lib/nex-agent-runtime/memory.ts` audit-grade governance memory
5. `src/lib/nex-agent/code-engine/capability-m-file-memory/*` file-memory tag lookup (ACTION 2)

**None of these is Q8 V2 v2 retrieval as designed.** Q8 V2 v2's specific mechanism (retrieval from `data/nex1-investigation-conclusions/entries.jsonl` with three typed evidence classes) is entirely absent.

**Under R11-B's constitutional principle ("memory shall inform investigation, not become current proof"), each of these five systems is a memory pathway.** Q8 V2 v2 covers only pathway 5 (file-memory) partially, and pathway that does not yet exist (Fix 17 retrieval). Pathways 1-4 are outside Q8 V2 v2's stated scope. Whether they should be covered is a separate founder decision, out of scope for this baseline.

---

## Aggregated measurement table

| Measure | Status | Directly verified? |
|---|---|---|
| 1 · Retrieval-state emissions (Q8 V2 v2 vocabulary) | ABSENT · 4 of 6 states never emitted; 2 collide with Q8 V1 selection vocabulary | YES (grep + implementation inspection) |
| 2 · Investigation-conclusion store consumers | ABSENT · zero readers · store directory not on disk | YES (grep + fs check) |
| 3 · Retrieved evidence classes | ABSENT · all three tokens grep-empty in src/ | YES |
| 4 · Composite material-difference | ABSENT · no aggregator; structural axis exists in Fix 23b in isolation | YES |
| 5 · discovery_source / provenance | ABSENT · not in Schema V1 · not in ACTION outputs | YES |
| 6 · Anti-circularity mechanisms | ABSENT · no contradiction-search, no dual-path, no provenance filter | YES |
| 7 · R11-B enforcement | VACUOUSLY PRESERVED · not runtime-tested · not architecturally enforced | YES (vacuous by absence) |
| 8 · Prior-failure non-permanence | VACUOUSLY PRESERVED · not runtime-tested | YES (vacuous by absence) |
| Proto · File-memory guidance pathway | PRESENT · structurally adjacent to memory-caused-evidence pattern · currently untagged | YES (source-code inspection at line 486) |
| Adjacent · Other memory/knowledge systems | ≥5 systems present · all outside Q8 V2 v2 scope | YES (grep + comment inspection) |

---

## False-positive guards (mandatory · from founder Section)

This baseline explicitly does NOT claim:

- **"Fix 23b provides semantic equivalence"** — Fix 23b provides bounded structural + arithmetic equivalence only; semantic-role understanding is `NOT CURRENTLY CAPABLE`
- **"File-memory is verified experience retrieval"** — file-memory is a static tag index; it does not store investigation conclusions; it does not update based on verification outcomes
- **"File-memory proves cumulative learning"** — no verification-outcome feedback exists on the file-memory pathway; it is static tagging, not learning
- **"Existing Q8 V1 contradiction handling proves Q8 V2 retrieval/fresh-vs-retrieved conflict handling"** — Q8 V1's UNRESOLVED state governs contradictions between per-candidate evidence within a single Q8 evaluation; it has never been runtime-exercised against retrieved-vs-fresh conflict because retrieved evidence does not exist yet
- **"Absence of retrieval means R11-B has been runtime-tested"** — R11-B is vacuously preserved because the pathway it protects against has no runtime instantiation

## False-negative guards (mandatory · from founder Section)

This baseline explicitly acknowledges:

- **File-memory guidance IS a memory → investigation → evidence pathway.** Not calling it Q8 V2 retrieval does not erase its structural equivalence
- **investigation-conclusion-store writes accumulate but the store is currently empty on disk.** Once Fix 17 runtime traffic begins, the store will populate. The writer exists (`appendFileSync` at line 192). If founder authorises any Fix 17 API traffic before Fix 24 builds the retrieval side, the store will grow while remaining unread — the exact `STORED BUT NEVER CONSUMED` state prior forensic analysis identified
- **Other memory/knowledge systems (programmer-learning, code-brain knowledge, audit-grade memory, general knowledge search) exist and are read at runtime.** They are not Q8 V2 v2 retrieval but they interact with the same constitutional principle (`MEMORY = EVIDENCE ≠ AUTHORITY`)
- **`searchKnowledge` in `nex/context.ts` uses a `minConfidence` threshold parameter.** Under strict R11-B interpretation, this is a memory-influenced retrieval with confidence weighting; whether this pathway is subject to R11-B's constitutional principle is a founder decision outside this baseline's scope
- **`nex-debugger/types.ts` has a `candidate_source_hash` field on its SBFL debugger candidates** — a form of candidate provenance that is structurally-adjacent to what Q8 V2 v2's `candidate_source` would need, but semantically different (source-hash for AST diff, not source-of-hypothesis provenance for evidence)

---

## What this measurement is / is NOT

- **IS:** an honest static + observational before-picture of the repository as of 2026-09-18
- **IS:** measurement of Q8 V2 v2's specifically-designed mechanism (retrieval from Fix 17 store · three typed evidence classes · composite material difference · anti-circularity) — none of which currently exist
- **IS:** disclosure of one structurally-adjacent proto-behaviour (ACTION 2 file-memory tag lookup) and five other memory/knowledge systems that are runtime-active but outside Q8 V2 v2 scope
- **IS:** a labelled `MEASUREMENT_ONLY` document; it does not authorise any implementation

- **IS NOT:** a test pass or test fail. `NOT_A_TEST_PASS · NOT_A_TEST_FAIL`.
- **IS NOT:** proof that R11-B is enforced. R11-B is vacuously preserved by absence.
- **IS NOT:** proof that Q8 V2 v2 will be correct after Fix 24. Absence today ≠ correctness tomorrow.
- **IS NOT:** proof that file-memory is Q8 V2 v2 retrieval. It is a structurally-adjacent pathway that Q8 V2 v2 does not currently cover.
- **IS NOT:** an implementation authorisation.
- **IS NOT:** a schema change.

---

## Final report

### Files created

- `docs/doctrine/nex1-pre-fix24-baseline-2026-09-18.md` (this file)

### Files modified

`NONE`

### Source-code changes

`NONE`

### Runtime traffic

`NONE`

### Tests created

`NONE`

### Tests executed

`NONE`

### Schema changes

`NONE`

### Q8 V2 changes

`NONE`

### Fix 24

`NOT IMPLEMENTED`

### Autonomous execution

`NOT AUTHORIZED`

### Baseline status

**`PRE_FIX24_BASELINE_MEASUREMENT · MEASUREMENT_ONLY`**

### Substantive findings summary

- 8 of 8 Q8 V2 v2-specific measures return ABSENT or VACUOUSLY PRESERVED (§Measurements 1-8)
- 1 structurally-adjacent proto-behaviour identified (ACTION 2 file-memory tag lookup) — currently active, currently untagged
- 5 additional memory/knowledge systems discovered in the repository — outside Q8 V2 v2 scope but structurally-relevant to R11-B constitutional principle
- Fix 17 investigation-conclusion store: writer exists in code; store directory does not exist on disk (no runtime traffic has invoked it yet)
- Zero code changes made by this task

### Next step (not authorised by this task)

Per founder-locked sequence, the next task is:

**`Q8 V2 v2 FORENSIC REVIEW #2`** — separately authorised. (Note: Q8 V2 v2 forensic review has actually already been executed in a prior task and returned `Q8_V2_V2_FORENSIC_REVIEW_REQUIRES_CORRECTION` with 15 findings F1-F15. Founder direction awaited on which findings to authorise correcting.)

**STOP.**

Do not perform the Q8 V2 v2 forensic review in this task (already executed).
Do not correct any findings discovered during this baseline.
Do not begin Fix 24.
Do not make additional founder decisions.

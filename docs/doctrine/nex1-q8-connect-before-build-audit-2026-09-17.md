# NEX1 · Q8 Root-Cause Selection · Connect-Before-Build Architecture Audit

**Date:** 2026-09-17
**Authorization:** Founder Q8 Connect-Before-Build Audit prompt · **AUDIT ONLY · NO IMPLEMENTATION**
**Q8 policy under audit:** `NEX1_Q8_SELECTION_POLICY V1` · FOUNDER_APPROVED · 2026-09-17
**External model:** NONE (native grep + read · deterministic)
**Production code changes:** 0
**Track A:** FROZEN

---

## A · Executive Truth Status

```
Q8_POLICY:                FOUNDER_APPROVED (V1 · 2026-09-17)
Q8_IMPLEMENTATION:        NOT_IMPLEMENTED
Q8_RUNTIME:               NOT_VERIFIED
NEX_DEBUGGER:             INDEPENDENT (Decision 2 · unchanged · UNCONNECTED to NEX1)
TRACK_A:                  FROZEN
PRODUCTION_CODE_CHANGES:  0
COMMITS:                  0
PUSHES:                   0
EXTERNAL_MODEL:           NONE

CONNECT-BEFORE-BUILD RESULT: MIXED_CONNECT_AND_BUILD
```

**Bottom line:** ~60% of Q8's operational surface is already present in NEX1 as CONNECTION-ready infrastructure (evidence categories · provenance chain · deterministic base · type-locks · zero-LLM invariant · confidence-not-used pattern). The remaining ~40% is GENUINE_BUILD (SelectionState vocabulary · Q8 evidence-evaluation layer · selection policy engine · 17-field output contract · ACTION 15 wiring · Q8-level negative-control probe). Two hard CONSUMER_GAPs exist and pre-date Q8 (no consumer of `runInvestigation` or of `candidate_rankings`).

---

## B · Q8 Requirement Matrix (Policy §2 → Repository Evidence)

| Q8 Requirement | Policy § | Existing NEX1 Component | Direct Connection? | Evidence | Classification |
|---|---|---|---|---|---|
| Consume Fix 15 `candidate_rankings` | §2.5 · §2.6 | `native-investigation-mode.ts:227` + `capability-candidate-ranker.ts` | ✅ producer exists · no consumer | grep `candidate_rankings` returns only producer file | **A · CONNECTION** (wire ACTION 15 to consume ACTION 14 output) |
| Consume Fix 13 evidence records (4 states) | §2.8 · §2.18 | `capability-hypothesis-evidence-evaluator.ts` · `EvidenceStatus` type (line 53-57) | ✅ 4 states emitted per candidate | `STRUCTURALLY_SUPPORTING / _CONTRADICTING / INSUFFICIENT / UNRESOLVED` in Fix 13 output | **A · CONNECTION** |
| `SelectionState` vocabulary (6 states) | §3 · Decisions 5/8/15/18 | **NONE** | ❌ no `SelectionState` / `CandidateSelection` type | grep `selectionState\|SelectionState\|selectCandidate\|selectRoot\|candidate_selection\|CandidateSelection` in `src/lib/nex-agent/code-engine`: **no matches** | **C · GENUINE_BUILD** |
| Q8 evidence-evaluation layer | §2.6 · §2.8 | **NONE** at Q8 level (Fix 13 evaluates per-evidence · not per-selection) | ❌ needs new aggregator that decides selection eligibility from Fix 13 output | Fix 13's `overall_status` field aggregates per-candidate but is not a selection state | **B · HYBRID** (Fix 13 overall_status is close but semantically different · needs Q8-level wrapper) |
| Selection policy engine (Decisions 4/5/6/8) | §2.7 · §2.9 · §2.10 · §2.12 | **NONE** | ❌ no rule engine that applies Q8 blocking rules | grep confirms zero selection-mechanism code | **C · GENUINE_BUILD** |
| Blocking rules (contra / unres / insuff) | §2.8 · §2.10 | **PARTIAL** at ranking level (Fix 15 R-1/R-2/R-3 block ranking advantage · different semantics) | ⚠️ patterns exist · not selection-level | Fix 15 policy §2.8/§2.9/§2.10 block **ranking advantage** · Q8 must block **selection** (different meaning) | **B · HYBRID** (adapt Fix 15's blocking pattern into Q8 selection semantics) |
| Tie detection | §2.9 · Decision 5 | `capability-candidate-ranker.ts` emits `ranking_state: "TIED"` and `scope_state: "ALL_TIED"` | ✅ tie detection already deterministic at ranking level | Fix 15 F15-2 · F15-4 · F15-7 all PASS | **A · CONNECTION** (Q8 can read Fix 15's TIED state directly to decide TIE outcome) |
| Rank-1-with-blocking check | §2.10 · Decision 6 | **NONE** | ❌ no code reads rank_position + blocking-evidence together | Fix 15 emits both fields separately · no combiner exists | **C · GENUINE_BUILD** |
| Non-structural evidence rule | §2.11 · Decision 7 | **PARTIAL** · NEX1 pipeline is currently structural-only (Fix 7-15) | ⚠️ pipeline produces `source_inspections` · no runtime/behavioural pipeline exists | grep for runtime/behavioural evidence in code-engine: not found | **B · HYBRID** (allowed by policy · not required for V1 selection · optional inputs may be added later) |
| NO_SELECTION as first-class | §2.12 · Decision 8 | **NONE** as selection state (Fix 15 has UNRESOLVED_ORDER at ranking level) | ❌ ranking-level "no rank" ≠ selection-level "no selection" | Fix 15 `rank_position: null` when UNRESOLVED_ORDER | **B · HYBRID** (pattern exists · needs Q8-level state name) |
| Deterministic mechanism | §2.13 · Decision 10 | ✅ all NEX1 Fixes 1-15 are deterministic · zero LLM | ✅ pattern reusable | Fix 15 `capability-candidate-ranker.ts` header + F15-15 (5-run verification) prove determinism | **A · CONNECTION** (pattern) |
| Confidence informational only | §2.14 · Decision 11 | ✅ Fix 15 explicitly excludes confidence from ranking | ✅ pattern reusable | Fix 15 line 79-81 `CONFIDENCE_FIXED = 0.35` constant · never reads input confidence · F15-10 PASS | **A · CONNECTION** (pattern) |
| Provenance requirements (13 fields) | §2.15 · Decision 12 | **PARTIAL** · 11 of 13 already carried through pipeline | ⚠️ needs Q8-level wrapping + policy_id/version stamps | See §K below for field-by-field trace | **B · HYBRID** |
| Reproducibility (F15-15 pattern) | §2.16 · Decision 13 | ✅ Fix 15's F15-15 5-run verifier proves the pattern | ✅ reusable · deterministic ranker already exists as upstream | Fix 15 receipt determinism_passed=true | **A · CONNECTION** (pattern) |
| Structural evidence ceiling (INFERRED · never PROVEN) | §2.17 · Decision 14 | ✅ every Fix 12/13/14/15 output is `evidence_kind: "INFERRED"` (type-locked) | ✅ pattern reusable · Q8 output must also lock INFERRED | Type-lock backstops in Fix 12/13/14/15 · runtime rejection if mutation attempted | **A · CONNECTION** (pattern) |
| INSUFFICIENT vs UNRESOLVED (distinct states) | §2.18 · Decision 15 | ✅ Fix 13 already emits both as distinct `EvidenceStatus` values | ✅ distinction preserved through Fix 15 (`insufficient_count` vs `unresolved_count` separate fields) | Fix 13 line 53-57 · Fix 15 CandidateRanking record | **A · CONNECTION** (evidence-level) + **B · HYBRID** (selection-level naming) |
| 17-field Q8 output contract | §2.19 · Decision 16 | **NONE** · no `CandidateSelection` type exists | ❌ output shape must be built | grep `CandidateSelection` in code-engine: no matches | **C · GENUINE_BUILD** |
| Boundary rules (Q8 ≠ modify/execute/authorize) | §2.20 · Decision 17 | ✅ entire NEX1 pipeline is read-only · zero writes · zero broker calls · zero WO-04 invocation | ✅ pattern reusable | Fix 15 header: "Zero file writes · zero broker calls · zero WO-04 invocation" | **A · CONNECTION** (pattern) |
| REQUIRE_MORE_INVESTIGATION | §2.21 · Decision 18 | **PARTIAL** · packet-level `verdict: "INSUFFICIENT_EVIDENCE"` exists but is per-investigation not per-selection | ⚠️ semantic mismatch · Q8 needs per-candidate REQUIRE_MORE_INVESTIGATION distinct from packet verdict | `native-investigation-mode.ts:80` InvestigationVerdict includes INSUFFICIENT_EVIDENCE | **B · HYBRID** |
| Preconditions (Decision 19) | §2.22 | 1 of 20 satisfied (policy). Tests 11-19 do not exist. | ❌ Q8-level negative controls absent | See §J below | **C · GENUINE_BUILD** for preconditions 2-20 |

---

## C · Q7 → Q8 Data Flow (real current path)

Traced end-to-end via source inspection:

```
runInvestigation()  ← src/lib/nex-agent/code-engine/native-investigation-mode.ts
    │
    ├── ACTION 1  · classifyFounderIntent          (Capability A)
    ├── ACTION 2  · FileMemoryStore.listFiles      (M-1)
    ├── ACTION 3  · IndependentObserver.walk       (G11)
    ├── ACTION 4  · buildDependencyGraph            (dep-graph)
    ├── ACTION 5  · computeAbsenceCandidates        (Fix 4)
    ├── ACTION 6  · actionE_inspectSourceContent    (Fix 7 · OBSERVED)
    ├── ACTION 7  · buildObservedChains             (Fix 8 · OBSERVED)
    ├── ACTION 8  · emitChainNarratives             (Fix 9 · OBSERVED)
    ├── ACTION 9  · detectChainRelationships        (Fix 10 · INFERRED)
    ├── ACTION 10 · composeRelationships            (Fix 11 · INFERRED)
    ├── ACTION 11 · generateRootCauseCandidates     (Fix 12 · HYPOTHESIS)
    ├── ACTION 12 · evaluateHypothesisEvidence      (Fix 13 · INFERRED · 4 states)
    ├── ACTION 13 · compareCandidatePairs           (Fix 14 · INFERRED · differences)
    ├── ACTION 14 · rankCandidates                  (Fix 15 · INFERRED · rank_position + state)
    │
    ↓  ── ── ── ── ── ── ── ── HARD TERMINUS ── ── ── ── ── ── ── ── ──
    │
    ▼
InvestigationEvidencePacket returned to caller
    │
    ▼
????????????????????????????????????????????????????????
NO PRODUCTION CONSUMER
    (grep runInvestigation / runNativeInvestigation across src/: 1 file only · its own definition)
    (grep InvestigationEvidencePacket across src/: 1 file only · its own definition)
    ????????????????????????????????????????????????????????
```

**Arrow-by-arrow classification:**

| From | To | Status | Evidence |
|---|---|---|---|
| ACTION 11 → 12 | Fix 12 candidates → Fix 13 evaluation | **REAL** (internal wiring) | native-investigation-mode.ts:912 `evaluations: hypothesisEvaluations` |
| ACTION 12 → 13 | Fix 13 evaluations → Fix 14 comparison | **REAL** | native-investigation-mode.ts:933-934 |
| ACTION 13 → 14 | Fix 14 comparisons + Fix 13 evaluations → Fix 15 ranking | **REAL** | native-investigation-mode.ts:983-984 · Fix 15 consumes Fix 13 evaluations directly (not Fix 14) |
| ACTION 14 → 15 | Fix 15 rankings → Q8 evaluation | **MISSING** | no ACTION 15 exists |
| Q8 evaluation → Q8 policy | (would exist inside Q8 mechanism) | **MISSING** | no Q8 mechanism |
| Q8 policy → candidate_selection | (would exist inside Q8 mechanism) | **MISSING** | no Q8 mechanism |
| candidate_selection → downstream consumer | (would exit packet) | **MISSING** | no consumer even for existing packet fields |

---

## D · Existing Reusable Components (with exact evidence)

| Component | Path | Purpose (verified via read) | Reusable for Q8 |
|---|---|---|---|
| `EvidenceStatus` type | `capability-hypothesis-evidence-evaluator.ts:53-57` | 4-state enum: SUPPORTING / CONTRADICTING / INSUFFICIENT / UNRESOLVED | ✅ direct input to Q8 evidence evaluation |
| `HypothesisEvaluation` type | `capability-hypothesis-evidence-evaluator.ts:76-92` | per-candidate aggregate with overall_status + 4 evidence-id arrays + provenance | ✅ Q8 can read overall_status and per-status arrays directly |
| `CandidateRanking` type | `capability-candidate-ranker.ts:83-104` | rank_position · ranking_state · differentiating_rule · 4 counts · dedup rel_ids · policy_id + version | ✅ Q8 primary input |
| `RankingScope` type | `capability-candidate-ranker.ts:124-129` | per-source_file grouping with scope_state (RANKED/ALL_TIED/UNRESOLVED_ORDER/SINGLETON) | ✅ Q8 can read scope_state for TIE detection |
| Investigation packet fields | `native-investigation-mode.ts:103-224` | investigation_id · trace_id · candidate_rankings · hypothesis_evaluations · hypothesis_evidence_records · candidate_comparisons · root_cause_candidates · reasoning_trace · zero_llm invariant | ✅ 11 of 13 provenance fields present |
| `Nex1DecisionTrailBuilder` | `nex1-decision-trail.ts` | records code-engine decisions (files_selected / candidate_accepted for CODE FIXES not root causes) | ⚠️ DIFFERENT DOMAIN (code-fix acceptance ≠ root-cause selection) · not a reusable Q8 component |
| Forbidden causal-vocabulary check | Fix 13/14/15 all have `FORBIDDEN_CAUSAL_TOKENS` + `containsForbiddenCausal()` | runtime rejection of causal-narrative leakage | ✅ pattern reusable in Q8 |
| Type-lock backstops | Fix 12/13/14/15 all reject `evidence_kind !== "INFERRED"` at runtime | prevents PROVEN mutation | ✅ pattern reusable in Q8 |
| Deterministic ordering discipline | Fix 15 `sort by (tuple, candidate_id)` with header note "candidate_id is used ONLY for stable output presentation · never to alter rank_position" | avoids hidden tie-breaker | ✅ pattern reusable in Q8 |
| F15-15 determinism verifier | `scripts/nex1-fix15-verification/probe.ts` (5-run identical-output check) | proves same inputs → same output | ✅ pattern reusable for Q8 verification |

---

## E · Existing Connections (what is already wired)

| Wire | Status | Evidence |
|---|---|---|
| Fix 12 candidates → Fix 13 evaluator | **REAL** (production) | `native-investigation-mode.ts` ACTION 11 → 12 |
| Fix 13 evaluator → Fix 14 comparator | **REAL** (production) | ACTION 12 → 13 |
| Fix 13 evaluator → Fix 15 ranker | **REAL** (production · Fix 15 consumes Fix 13 directly, not Fix 14) | ACTION 12 → 14 (skipping ACTION 13's output for input) |
| Fix 14 comparator → InvestigationEvidencePacket | **REAL** (produced but not consumed downstream) | `candidate_comparisons` field |
| Fix 15 ranker → InvestigationEvidencePacket | **REAL** (produced but not consumed downstream) | `candidate_rankings` field |
| `investigation_id` + `trace_id` propagation | **REAL** end-to-end | native-investigation-mode.ts:106-107 → 1188-1189 finalise |
| Provenance chain (source_file · lines · relationship_ids · candidate_ids) | **REAL** through all Fixes 7-15 | Traced in §K below |

---

## F · Missing Connections (producers without consumers · existing without link)

| Producer | Missing Consumer | Impact on Q8 |
|---|---|---|
| Fix 15 `candidate_rankings` | No downstream Q8 evaluation layer reads it | Q8 primary input has no reader |
| Fix 14 `candidate_comparisons` | No downstream reader **at all** | Q8 could use for cross-candidate context but no bridge exists |
| Fix 13 `hypothesis_evaluations` | Downstream reader only Fix 14 (internal) | Q8 could read directly · same as Fix 15 does |
| `InvestigationEvidencePacket` (whole) | Only tests call `runInvestigation` · no production caller | Fundamental CONSUMER GAP predating Q8 (§I) |
| `Nex1DecisionTrailBuilder.acceptCandidate` | Only invoked in code-fix flows (not root-cause) | Not a Q8 candidate consumer |

---

## G · Genuine Build Gaps (CLASS C · after direct inspection prove absence)

For each, grep + read confirms absence in `src/lib/nex-agent/code-engine`:

| Item | Evidence of Absence | Why it must be BUILT |
|---|---|---|
| `SelectionState` type (6-state enum) | grep `SelectionState\|selectionState\|selection_state` returns no matches | Q8 policy §3 requires distinct vocabulary |
| `CandidateSelection` output type | grep `CandidateSelection\|candidate_selection` returns no matches | Q8 policy §2.19 requires 17-field structured output |
| `capability-candidate-selector.ts` (or equivalent) | file does not exist | needed as ACTION 15 producer |
| Q8 evidence-evaluation layer (per-candidate blocking check) | no aggregator of Fix 13 statuses → selection eligibility exists | Q8 policy §2.6 · §2.8 |
| Q8 selection policy engine (Decision 4 rules) | no rule engine that decides SELECTED / NO_SELECTION / TIE / etc | Q8 policy §2.7-§2.12 |
| Rank-1-with-blocking combiner | no code reads `rank_position` AND blocking evidence together | Q8 policy §2.10 (Decision 6) |
| ACTION 15 wiring in `native-investigation-mode.ts` | pipeline currently stops at ACTION 14 | Q8 policy §2.6 bridge |
| `candidate_selection: CandidateSelection` field on packet | no such field | Q8 policy §2.19 |
| `capability_gaps` note extension for Q8 | pattern exists · Q8 entry does not | Q8 policy §2.15 (provenance) |
| Q8-level negative-control probe | no `scripts/nex1-q8-verification/probe.ts` | Q8 policy §2.22 preconditions 11-19 |
| REQUIRE_MORE_INVESTIGATION mechanism at candidate level | packet-level verdict exists · candidate-level state does not | Q8 policy §2.21 |
| Structured `decision_reason` per candidate | no per-candidate decision-reason string exists | Q8 policy §2.15 field 13 |
| Q8 `policy_id` + `policy_version` stamps | Fix 15 stamps its own · Q8 needs its own | Q8 policy §2.15 fields 11-12 |

---

## H · Verification Gaps (CLASS E · capabilities that exist but not Q8-runtime-proven)

Fix 15 verifier proves several Q8-relevant patterns at the **ranking layer**. These are ADJACENT · not Q8-level proof:

| Q8-required assertion | Ranking-layer proxy | Q8-level test exists? |
|---|---|---|
| Rank 1 doesn't auto-select | F15-16 proves ranker emits no `root_cause`/`selected` field | ❌ no Q8 selector to test |
| Tie → NO_SELECTION | F15-7 proves ranker emits TIED · not SELECTED | ❌ no Q8 selector to test |
| Blocking prevents selection | F15-1/3/5 prove blocking prevents ranking advantage | ❌ different semantic layer |
| INSUFFICIENT prevents selection | Fix 13 emits INSUFFICIENT · F15-5 blocks ranking | ❌ no Q8 selector to test |
| UNRESOLVED prevents selection | Fix 13 emits UNRESOLVED · F15-3 blocks ranking | ❌ no Q8 selector to test |
| Confidence doesn't alter selection | F15-10 proves at ranking | ❌ no Q8 selector to test |
| Filename doesn't alter selection | F15-12 proves at ranking | ❌ no Q8 selector to test |
| Candidate ID doesn't alter selection | F15-13 proves at ranking | ❌ no Q8 selector to test |
| Array order doesn't alter selection | F15-14 proves at ranking | ❌ no Q8 selector to test |
| Determinism | F15-15 proves at ranking (5 runs) | ❌ no Q8 selector to test |
| No external LLM | zero-LLM invariant proven at every Fix | ✅ CONNECTION (pattern) |
| Missing provenance rejected | Fix 15 rejects records failing type-lock | ⚠️ PARTIAL · Q8 must add its own provenance-missing check |
| Q8 does not modify/execute | pipeline read-only invariant | ✅ CONNECTION (pattern) |

**Verification gaps summary:** 10 of 12 negative controls have RANKING-LAYER proxies (reusable patterns) but no SELECTION-LAYER runtime evidence. Both patterns and probe structure are reusable · but Q8 selector must exist first before its verifier can run.

---

## I · Consumer Gaps (CLASS F · producer without production consumer)

**HARD FINDING · predates Q8:**

```
runInvestigation()   →   InvestigationEvidencePacket   →   [ NO PRODUCTION CONSUMER ]
```

Grep evidence:
- `runInvestigation` grep across `src/`: returns 1 file (its own definition · `native-investigation-mode.ts`)
- `InvestigationEvidencePacket` grep across `src/`: returns 1 file (its own definition)
- Only callers are test probes in `scripts/nex1-*/probe.ts` · which call the ranker/comparator/evaluator DIRECTLY · not `runInvestigation`

**Impact on Q8:**

- Adding a `candidate_selection` field to `InvestigationEvidencePacket` does not automatically give it a consumer
- Q8's structured output will inherit the same "no downstream reader" problem unless a consumer is separately authorized to build
- **This is a pre-existing NEX1 gap · not a Q8 defect.** It should be surfaced but Q8 is not the responsible layer to fix it.

---

## J · Negative-Control Coverage Map

| Control | Founder-required (Q8 prompt §8) | Existing infra (ranking layer) | Reusable for Q8 | Status |
|---|---|---|---|---|
| A · Rank 1 not auto-selected | Yes | F15-16 (0 hits for 12 prohibited Q8 field names in ranker output) | Pattern reusable · Q8 selector must exist to test at selection level | **PARTIAL · pattern connect · target build** |
| B · Tie → NO_SELECTION | Yes | F15-7 (identical evidence → TIED · scope=ALL_TIED) | Fix 15 emits TIED · Q8 must map to NO_SELECTION | **HYBRID** |
| C · Blocking prevents selection | Yes | F15-1/3/5 (block ranking) | Semantic mismatch (ranking vs selection) · patterns reusable | **BUILD** at selection level |
| D · INSUFFICIENT prevents selection | Yes | F15-5 (blocks ranking) | See C | **BUILD** |
| E · UNRESOLVED prevents selection | Yes | F15-3 (blocks ranking) | See C | **BUILD** |
| F · Confidence not altering | Yes | F15-10 (confidence flipped · rank unchanged) | Pattern directly reusable in Q8 verifier | **CONNECT (pattern)** |
| G · Filename not altering | Yes | F15-12 (zzzz.ts vs aaaa.ts · rank preserved) | Pattern directly reusable | **CONNECT (pattern)** |
| H · Candidate ID not altering | Yes | F15-13 (zzz_symbol vs aaa_symbol · rank preserved) | Pattern directly reusable | **CONNECT (pattern)** |
| I · Array order not altering | Yes | F15-14 (reverse input · rank preserved) | Pattern directly reusable | **CONNECT (pattern)** |
| J · External LLM not determining | Yes | zero-LLM invariant proven everywhere | Q8 mechanism must also declare zero_llm | **CONNECT (invariant)** |
| K · Missing provenance not becoming valid | Yes | Fix 15 rejects on type-lock mutation | Q8 must add its own provenance-completeness check | **BUILD** |
| L · Q8 not triggering modification/execution | Yes | pipeline read-only invariant (no writes · no broker · no WO-04) | Q8 must inherit and prove it | **CONNECT (invariant)** |

**Coverage summary:** 6 patterns fully reusable as CONNECT · 3 require Q8-level BUILD to run at selection layer · 3 HYBRID (pattern + Q8-level naming).

---

## K · Provenance Audit (real chain trace)

Provenance flow from source observation → ranking:

```
ACTION 6 · source_inspections (Fix 7)      · OBSERVED
   fields: source_file · start_line · end_line · verbatim text
   ↓ preserved

ACTION 7 · observed_chains (Fix 8)         · OBSERVED
   fields: chain_id · steps[].source_file / start_line / end_line
   ↓ preserved

ACTION 8 · chain_narratives (Fix 9)        · OBSERVED
   fields: chain_id · provenance
   ↓ preserved

ACTION 9 · inferred_relationships (Fix 10) · INFERRED  ← evidence_kind flips here
   fields: relationship_id · endpoint_A/B (source_file + lines + fact_kind)
   ↓ preserved

ACTION 10 · composed_arguments (Fix 11)    · INFERRED
   fields: composition_id · endpoint_chain · provenance
   ↓ preserved

ACTION 11 · root_cause_candidates (Fix 12) · HYPOTHESIS
   fields: candidate_id · composition_id · supporting_relationship_ids · provenance
   ↓ preserved

ACTION 12 · hypothesis_evaluations (Fix 13) · INFERRED
   fields: candidate_id · evidence_id · relationship_id · composition_id · status · provenance
   ↓ preserved

ACTION 13 · candidate_comparisons (Fix 14) · INFERRED
   fields: comparison_id · candidate_a_id · candidate_b_id · shared/A-only/B-only evidence_ids · provenance
   ↓ preserved

ACTION 14 · candidate_rankings (Fix 15)    · INFERRED
   fields: candidate_id · source_file · rank_position · ranking_state · differentiating_rule · dedup_relationship_ids{id,status} · policy_id · policy_version · confidence
   ↓ TERMINUS · no ACTION 15 consumer

Investigation-level fields (added at ACTION 0):
   investigation_id · trace_id · zero_llm=true · reasoning_trace[]
```

**Q8 required provenance fields (Decision 12 · 13 minimum):**

| Field | Currently preserved? | Where |
|---|---|---|
| `investigation_id` | ✅ | native-investigation-mode.ts:106 |
| `trace_id` | ✅ | native-investigation-mode.ts:107 |
| `candidate_id` | ✅ | present in Fix 12/13/14/15 |
| `source_file` | ✅ | derivable from candidate_id.split("::")[0] or explicit field |
| source line/range | ✅ | provenance arrays on every Fix 10-15 record |
| evidence identifiers | ✅ | Fix 13 evidence_id · propagated |
| relationship identifiers | ✅ | Fix 10 relationship_id · propagated to Fix 12/13/15 |
| `evidence_kind` | ✅ | INFERRED at every Fix 10-15 record |
| evidence status | ✅ | Fix 13 EvidenceStatus 4-way |
| Q8 policy_id | ❌ | needs Q8-level stamp (Fix 15 stamps Q7's policy_id · not Q8's) |
| Q8 policy_version | ❌ | needs Q8-level stamp |
| selection_state | ❌ | needs Q8 mechanism |
| decision_reason | ❌ | needs Q8 mechanism |

**Verdict:** 9 of 13 provenance fields already threaded through the pipeline · 4 need Q8-level addition (all producible by the future Q8 mechanism).

---

## L · Determinism Audit

**Existing NEX1 deterministic infrastructure:**

| Property | Evidence | Reusable for Q8 |
|---|---|---|
| Zero randomness in Fix 15 ranker | grep `Math.random\|Date.now\(\)` in `capability-candidate-ranker.ts`: 0 hits | ✅ pattern |
| Deterministic sort by (tuple, candidate_id) | Fix 15 code · documented as "stable presentation not ranking" | ✅ pattern |
| No external-model dependency | zero-LLM invariant across all Fixes | ✅ CONNECT |
| No filesystem-order dependency | Fix 15 groups by source_file explicitly · not by directory walk order | ✅ pattern |
| No database-order dependency | Fix 15 has no DB call | ✅ CONNECT |
| No execution-timing dependency | no `setTimeout` / `setInterval` in ranker · no async race | ✅ CONNECT |
| Reproducibility verifier | F15-15 (5-run identical-output check) in `scripts/nex1-fix15-verification/probe.ts` | ✅ pattern for Q8 verifier |

**Q8-specific hidden dependencies to guard against (per policy §2.16):**

Q8 must not introduce:
- randomness
- timestamps (except non-load-bearing metadata like `at` fields)
- array order
- filename ordering
- candidate IDs (for ranking · already discussed)
- database ordering
- execution timing
- hidden model calls

All are avoidable by following Fix 15's pattern. **Determinism infrastructure is CONNECT-ready.**

---

## M · REQUIRE_MORE_INVESTIGATION Audit

**Existing NEX1 uncertainty vocabulary:**

| Term | Where | Semantic level | Reusable for Q8 `REQUIRE_MORE_INVESTIGATION`? |
|---|---|---|---|
| `InvestigationVerdict = "INSUFFICIENT_EVIDENCE"` | native-investigation-mode.ts:80 · 1081 · 1091 | Investigation-level (packet verdict) | ⚠️ different granularity · Q8 needs per-selection state |
| `verdict: "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM"` | line 83 | Investigation-level · capability-missing | ⚠️ not applicable to Q8 (Q8 is native-deterministic per Decision 10) |
| `recommended_next_step: string` | line 131 · free-form advisory | Investigation-level advisory | ⚠️ Q8 needs structured state · not prose advisory |
| `unknown_facts[]` | line 129 | Per-investigation observation list | ⚠️ different level |
| `capability_gaps[]` | line 132 | Per-investigation missing-capability list | ⚠️ different level |
| `ranking_state: "UNRESOLVED_ORDER"` (Fix 15) | capability-candidate-ranker.ts | Ranking-level "no rank possible" | ⚠️ closest match but different semantics · Q8 would emit REQUIRE_MORE_INVESTIGATION as selection state |
| `overall_status: "UNRESOLVED"` (Fix 13) | evaluator | Per-candidate evidence-level | ⚠️ different level (evidence unresolved ≠ investigation needs more) |

**Verdict:** existing vocabulary is close but every candidate operates at a different granularity than Q8's selection-level `REQUIRE_MORE_INVESTIGATION`. Reusable as **HYBRID** patterns · not direct CONNECT.

---

## N · nex-debugger Boundary (Founder Decision 2 · KEEP INDEPENDENT)

**Explicitly confirmed:**

- Grep `nex1|native-investigation|candidate_rankings|hypothesis_evaluations` in `src/lib/nex-debugger/`: **No matches found**
- Grep `nex-debugger|performDiagnosis` in `src/lib/nex-agent/`: **No matches found**
- `nex-debugger`'s `RootCauseCandidate` type · `authoritative_top_candidate` field · `performDiagnosis` function · six-outcome selection engine remain **unconnected** to NEX1
- `nex-debugger` constitution C-3/C-4/C-5 (founder-authorised 2026-09-12 for its OWN domain) remains distinct from Q8 V1 policy
- API endpoints `POST /api/nex/debugger/diagnose` + `GET /api/nex/debugger/self-test` unchanged
- Zero imports · zero data flow between the two systems

**Audit-level assurance:** this audit did not modify any nex-debugger file · did not adopt any nex-debugger rule as Q8 policy · did not create a bridge. Independence preserved per Decision 2.

---

## O · Proposed Connection Sequence (dependency-ordered · NOT AUTHORIZED to implement)

If founder later authorizes Q8 build, the CONNECT actions (dependency-ordered) would be:

```
CONNECT-1  · Q8 reads Fix 13 hypothesis_evaluations by candidate_id             (data · already produced)
CONNECT-2  · Q8 reads Fix 15 candidate_rankings by candidate_id                 (data · already produced)
CONNECT-3  · Q8 reuses forbidden-causal-vocab check from Fix 13/14/15           (pattern)
CONNECT-4  · Q8 reuses type-lock evidence_kind = "INFERRED"                     (pattern)
CONNECT-5  · Q8 reuses zero-LLM invariant declaration                           (pattern)
CONNECT-6  · Q8 reuses deterministic-sort pattern (tuple + stable secondary)    (pattern)
CONNECT-7  · Q8 reuses Fix 15's confidence-fixed constant pattern               (pattern)
CONNECT-8  · Q8 verifier reuses F15-15 5-run determinism structure              (test pattern)
CONNECT-9  · Q8 verifier reuses F15-10/11/12/13/14 negctrl structure            (test pattern)
CONNECT-10 · investigation_id + trace_id already propagated · Q8 output stamps  (data)
```

**These are CONNECTIONS only.** No new capability is created. Each borrows an existing pattern or reads an existing field.

---

## P · Proposed Build Sequence (only if founder authorizes · NOT AUTHORIZED here)

```
BUILD-1  · SelectionState type (6-state enum)                                   [C]
BUILD-2  · CandidateSelection output type (17 fields per Decision 16)           [C]
BUILD-3  · capability-candidate-selector.ts (Q8 mechanism)                      [C]
         · consumes Fix 13 evaluations + Fix 15 rankings
         · applies Decision 4 blocking rules
         · applies Decision 6 rank-1-with-blocking check
         · applies Decision 5 tie behaviour
         · applies Decision 8 NO_SELECTION rule
         · applies Decision 15 INSUFFICIENT vs UNRESOLVED distinction
         · applies Decision 18 REQUIRE_MORE_INVESTIGATION conditions
BUILD-4  · candidate_selection: CandidateSelection field on InvestigationEvidencePacket [C]
BUILD-5  · ACTION 15 wiring in native-investigation-mode.ts                     [C]
BUILD-6  · early-exit patches for candidate_selection field (2 known sites)     [C]
BUILD-7  · Q8 verifier probe (scripts/nex1-q8-verification/probe.ts)            [C]
         · Q8-level negative controls A-L
         · determinism 5-run
         · Q8-level TIE / NO_SELECTION / REQUIRE_MORE / SELECTED cases
BUILD-8  · Q8 policy_id + policy_version stamps                                 [C]
BUILD-9  · decision_reason string field (per Decision 16)                       [C]

ADAPT-1  · Fix 15 output does not currently include full selection-relevant context.
           Q8 may need Fix 13 output alongside (already accessible via ACTION 12).
           No modification to Fix 15 or Fix 13 is required.
           This is a Q8-side read pattern · not an upstream adaptation.

VERIFY-1 · Q8 runtime verification against real NEX1 evidence
           (per Decision 19 precondition 19)
VERIFY-2 · Regression check that Q7 output unchanged
           (per Decision 19 preconditions all)
VERIFY-3 · Regression check that A-S regression still clean
```

**No implementation begins on any BUILD or ADAPT or VERIFY item without a separate founder authorization prompt.**

---

## Q · Final Classification Table

| Item | Classification | Evidence | Implementation Required? |
|---|---|---|---|
| Fix 15 `candidate_rankings` as Q8 input | **A · CONNECTION** | `native-investigation-mode.ts:227` + Fix 15 producer | NO (already produced) |
| Fix 13 evidence records as Q8 input | **A · CONNECTION** | `native-investigation-mode.ts:216-217` | NO |
| SelectionState type | **C · BUILD** | grep no match | YES |
| CandidateSelection output type | **C · BUILD** | grep no match | YES |
| Q8 evidence-evaluation aggregator | **B · HYBRID** | Fix 13 overall_status close · not selection-level | YES (thin adapter) |
| Q8 selection policy engine | **C · BUILD** | no rule engine exists | YES |
| Blocking rules at selection layer | **B · HYBRID** | Fix 15 blocks at ranking · Q8 needs at selection | YES |
| Tie detection at selection layer | **A · CONNECTION** | Fix 15 emits TIED/ALL_TIED · Q8 reads | NO wire · YES map |
| Rank-1-with-blocking combiner | **C · BUILD** | no combiner exists | YES |
| Non-structural evidence support | **B · HYBRID (optional in V1)** | no runtime pipeline · not required by policy V1 | Deferred |
| NO_SELECTION as selection state | **B · HYBRID** | UNRESOLVED_ORDER exists at ranking level · Q8 needs different name | YES (naming layer) |
| Deterministic mechanism | **A · CONNECTION (pattern)** | Fix 15 fully deterministic | NO (reuse pattern) |
| Confidence-not-used pattern | **A · CONNECTION (pattern)** | Fix 15 F15-10 | NO (reuse pattern) |
| Provenance 9 of 13 fields | **A · CONNECTION** | end-to-end preserved | NO |
| Provenance 4 of 13 fields (Q8-level) | **C · BUILD** | need Q8 policy stamps + selection state + decision reason | YES |
| Reproducibility 5-run pattern | **A · CONNECTION (test pattern)** | F15-15 | NO (reuse test structure) |
| Structural-evidence ceiling (INFERRED) | **A · CONNECTION (pattern)** | type-lock backstops | NO |
| INSUFFICIENT vs UNRESOLVED distinction | **A · CONNECTION** + **B · HYBRID** | Fix 13 evidence-level distinct · Q8 selection-level needs naming | Partial |
| 17-field output contract | **C · BUILD** | no type exists | YES |
| Boundary rules (read-only) | **A · CONNECTION (invariant)** | pipeline read-only proven | NO |
| REQUIRE_MORE_INVESTIGATION mechanism | **B · HYBRID** | packet verdict close · Q8 per-selection needed | YES |
| Preconditions 1 (policy) | ✅ satisfied | Q8 V1 approved | NO |
| Preconditions 2-10 (contracts) | **C · BUILD** | contract forms not authored | YES |
| Preconditions 11-19 (tests + verification) | **C · BUILD** | Q8-level probe absent | YES |
| Precondition 20 (founder auth to activate) | ⬜ awaiting founder | not this audit's scope | NO (founder decision) |
| Consumer for `runInvestigation` output | **F · CONSUMER_GAP** | pre-existing · predates Q8 | Not Q8's responsibility |
| nex-debugger connection | **NOT APPLICABLE** | Decision 2 = INDEPENDENT · audit did not touch | Forbidden by policy |

---

## R · Connect-Before-Build Result

```
CONNECT-BEFORE-BUILD RESULT:  MIXED_CONNECT_AND_BUILD

CONNECT items:      10 (evidence infra · patterns · invariants · deterministic base ·
                        F15 test-pattern reuse · provenance passthrough)
HYBRID items:        5 (semantic-level adaptations · not code adaptations to upstream)
BUILD items:        11 (SelectionState · CandidateSelection · Q8 mechanism ·
                        ACTION 15 · verifier probe · Q8 policy stamps ·
                        decision_reason · rank-1-with-blocking combiner ·
                        tie-map · REQUIRE_MORE_INVESTIGATION at candidate level ·
                        preconditions 11-19)
VERIFICATION items:  3 (Q8 runtime · A-S regression · Q7 unchanged regression)
CONSUMER GAP:        1 (pre-existing · InvestigationEvidencePacket has no downstream reader ·
                        not Q8's responsibility)
POLICY GAP:          0 (Q8 V1 policy is complete)
```

**In plain terms:** Q8 is a genuine BUILD at its core (SelectionState · policy engine · output type · ACTION 15 · verifier probe) · but every peripheral piece (provenance · determinism · zero-LLM · type-locks · negative-control test patterns · Fix 13 evidence inputs · Fix 15 ranking inputs · read-only invariants) is CONNECT-ready. The BUILD scope is smaller than "Q8 from scratch" because the entire evidence infrastructure and testing pattern already exists.

---

## S · Undercount Protection Applied (§13 of audit prompt)

Before declaring any item `NOT_FOUND` or `GENUINE BUILD`, direct inspection was performed:

- ✅ Grep `selectionState|SelectionState|selectCandidate|selectRoot|candidate_selection|CandidateSelection` in `src/lib/nex-agent/code-engine`: no matches → BUILD confirmed
- ✅ Grep `INSUFFICIENT_EVIDENCE|REQUIRE_MORE` in code-engine: only 2 files (native-investigation-mode.ts + capability-candidate-comparator.ts comment) · no REQUIRE_MORE mechanism → BUILD confirmed
- ✅ Read `nex1-decision-trail.ts` fully: confirmed CODE-FIX domain not root-cause · NOT_RELEVANT to Q8
- ✅ Grep `runInvestigation` in `src/`: only 1 file (definition) → CONSUMER_GAP confirmed
- ✅ Grep `InvestigationEvidencePacket` in `src/`: only 1 file → CONSUMER_GAP confirmed
- ✅ Grep for randomness / Date.now / Math.random in ranker: 0 hits → determinism CONFIRMED existing
- ✅ Read `nex-debugger/types.ts` + `debugger.ts`: constitution C-3/C-4/C-5 · own domain · authoritative_top_candidate emits SBFL-based selection · CONFIRMED not connectable to NEX1 Q8 per Decision 2

Items marked `NOT_YET_DETERMINED`: **0**. Every classification supported by evidence.

---

## T · Boundary Compliance

- ✅ Did NOT implement Q8
- ✅ Did NOT write production code
- ✅ Did NOT create Q8 mechanism
- ✅ Did NOT connect nex-debugger
- ✅ Did NOT modify Track A
- ✅ Did NOT commit
- ✅ Did NOT push
- ✅ Did NOT fabricate capability from documentation
- ✅ Did NOT change any type
- ✅ Did NOT add any adapter
- ✅ Did NOT modify Q7 policy or Fix 15 mechanism
- ✅ Did NOT change nex-debugger

---

## U · Hard Stop (§18)

Per founder instruction:

> After writing the audit: STOP.
> Do not proceed into implementation.
> Do not write Q8 code.
> Do not connect components.
> Do not activate Q8.
>
> The next implementation prompt will be created only after the Founder reviews this audit.

**STOPPED.**

Awaiting founder review. The next founder-authorized step (if any) determines what happens: refined build plan · direct build authorization · policy amendment · or defer.

---

*End of NEX1 Q8 Connect-Before-Build Architecture Audit · 2026-09-17*

# NEX1 · Q8 Root-Cause Selection · Implementation Plan

**Date:** 2026-09-17
**Authorization:** Founder Q8 Implementation Plan prompt · **PLAN ONLY · NO IMPLEMENTATION**
**Governs:** future Q8 build sequence · based on FOUNDER_APPROVED policy + completed connect-before-build audit
**External model:** NONE
**Production code changes:** 0
**Track A:** FROZEN
**Q8 implementation:** NOT_STARTED
**Q8 build authorization:** NOT_GRANTED

Q8 build must not begin until a separate founder authorization is issued for it. This document exists to make the eventual build minimally scoped, evidence-grounded, and boundary-safe.

---

## 0 · Audit Revalidation (direct inspection · corrections disclosed)

Before planning, direct repository inspection verified the audit's most consequential claims. Two corrections and one confirmation:

### Correction 0.1 — ACTION numbering is a label, not a strict order

The audit assumed `ACTION 15` slots after `ACTION 14`. Direct inspection of `native-investigation-mode.ts` shows `ACTION 5 · ABSENCE-OF-TOKEN ANALYSIS` at line **1007** — that is, ACTION 5 runs *after* ACTION 14 (line 977). The "ACTION N" label is a docstring convention, not a strict phase counter.

**Impact on plan:** the Q8 selector step must be placed in the code sequentially **after `candidateRankings` is populated** (i.e., after line ~1005) but before the `ASSESS` block at line 1042. Its docstring label may be "ACTION 15" for continuity with prior Fixes, but "physical position immediately after ACTION 14" is the load-bearing requirement.

### Correction 0.2 — Fix 13's `overall_status` is a stronger Q8 input than the audit stated

The audit classified `HypothesisEvaluation.overall_status` as "close but not selection-level" and HYBRID. Direct inspection of `capability-hypothesis-evidence-evaluator.ts:80-84` + `401` shows it is a **per-candidate aggregate** already computed with values `STRUCTURALLY_SUPPORTED / STRUCTURALLY_CONTRADICTED / INSUFFICIENT / UNRESOLVED`. Q8 does not need to re-classify evidence — it needs to apply the founder-approved **selection policy** to `(overall_status, rank_position, ranking_state, per-status counts)`.

**Impact on plan:** the Q8 evidence-evaluation layer is thinner than the audit implied. Reclassified from HYBRID to CONNECT.

### Confirmation 0.3 — Every other audit finding stands

- `runInvestigation` has 1 file only — CONSUMER GAP confirmed
- `InvestigationEvidencePacket` grep — 1 file only — CONSUMER GAP confirmed
- Zero `SelectionState / CandidateSelection / selectCandidate` — BUILD confirmed
- Zero LLM / randomness / Date.now / Math.random in Fix 15 ranker — CONNECT patterns confirmed
- `nex-debugger` grep for `nex1` / `native-investigation` / `candidate_rankings`: no matches — INDEPENDENT confirmed
- Fix 13 · Fix 14 · Fix 15 exit 0 on regression probes — pipeline stable

---

## 1 · Q8 Dependency Graph (real repository components)

```
Fix 7  · source_inspections (OBSERVED)              [source_file · line ranges]
        ↓
Fix 8  · observed_chains (OBSERVED)                 [chain_id · steps · provenance]
        ↓
Fix 9  · chain_narratives (OBSERVED)                [chain_id · provenance]
        ↓
Fix 10 · inferred_relationships (INFERRED)          [relationship_id · endpoint_A/B]
        ↓
Fix 11 · composed_arguments (INFERRED)              [composition_id · endpoint_chain]
        ↓
Fix 12 · root_cause_candidates (HYPOTHESIS)         [candidate_id · supporting_rel_ids]
        ↓
Fix 13 · hypothesis_evaluations (INFERRED)          [candidate_id · overall_status · 4 evidence arrays]
        + hypothesis_evidence_records               [evidence_id · relationship_id · status]
        ↓
Fix 14 · candidate_comparisons (INFERRED)           [comparison_id · shared/A-only/B-only · counts]
        ↓
Fix 15 · candidate_rankings (INFERRED)              [rank_position · ranking_state · dedup_rel_ids · policy_id/version]
        ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q8   · candidate_selection (INFERRED · not PROVEN)   ← FUTURE BUILD
       [selection_state · selected_candidate | null · decision_reason · provenance
        · policy_id NEX1_Q8_SELECTION_POLICY · policy_version V1]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ↓
InvestigationEvidencePacket returned to caller
        ↓
[ CONSUMER GAP · pre-existing · not Q8's responsibility to fix ]
```

Every input Q8 needs is already produced by ACTIONs 12 (Fix 13) and 14 (Fix 15). Q8 is a pure downstream consumer with a new output field.

---

## 2 · CONNECT List (reuse without changing semantics)

Every item below already exists. Q8 consumes or borrows its pattern.

| # | Path · symbol | Line range | Current purpose | Q8 use | Why safe |
|---|---|---|---|---|---|
| C-1 | `capability-hypothesis-evidence-evaluator.ts` · `HypothesisEvaluation` | 76-92 | per-candidate evidence aggregate + 4 evidence-id arrays | Q8 input · read overall_status + counts + arrays | Fix 13 is RUNTIME_VERIFIED · no upstream change |
| C-2 | `capability-hypothesis-evidence-evaluator.ts` · `EvidenceStatus` | 53-57 | 4-state enum | Q8 reads for blocking decision | Type import only · no change |
| C-3 | `capability-hypothesis-evidence-evaluator.ts` · `HypothesisEvidenceEvaluation` | 59-74 | per-relationship evidence record | Q8 reads for provenance + relationship_id | Type import only |
| C-4 | `capability-candidate-ranker.ts` · `CandidateRanking` | 83-104 | rank_position + ranking_state + counts + dedup rel_ids + policy stamps | Q8 primary input | Fix 15 RUNTIME_VERIFIED |
| C-5 | `capability-candidate-ranker.ts` · `RankingScope` | 124-129 | per-source_file grouping + scope_state | Q8 reads scope_state for TIE / UNRESOLVED_ORDER context | No change |
| C-6 | `capability-candidate-ranker.ts` · `RankingState` | (declared) | "RANKED" / "TIED" / "UNRESOLVED_ORDER" | Q8 reads for tie mapping (Decision 5) | Type import only |
| C-7 | `native-investigation-mode.ts` · `candidate_rankings` field | 227 | Fix 15 output on packet | Q8 selector reads directly | No packet change to read; only add to write |
| C-8 | `native-investigation-mode.ts` · `hypothesis_evaluations` + `hypothesis_evidence_records` fields | 216-217 | Fix 13 output on packet | Q8 selector reads directly | No packet change to read |
| C-9 | `native-investigation-mode.ts` · `investigation_id` + `trace_id` | 106-107 | investigation identity | Q8 output stamps both | Already threaded end-to-end |
| C-10 | Fix 15 · `FORBIDDEN_CAUSAL_TOKENS` + `containsForbiddenCausal()` pattern | — | reject causal-narrative leakage | Q8 selector reuses list + function | Pattern reuse · zero coupling |
| C-11 | Fix 15 · type-lock backstop `evidence_kind === "INFERRED"` | — | prevent PROVEN mutation | Q8 output must also lock INFERRED · reuse check | Pattern reuse |
| C-12 | Fix 15 · zero-LLM invariant declaration | file header | prove no external model | Q8 selector declares same invariant | Pattern reuse |
| C-13 | Fix 15 · deterministic-sort pattern (tuple + stable secondary) | (in `rankCandidates`) | avoid hidden tie-breaker · candidate_id used only for stable output presentation | Q8 sort must follow same discipline | Pattern reuse |
| C-14 | Fix 15 · `CONFIDENCE_FIXED = 0.35` constant | — | confidence never affects ranking | Q8 selector uses fixed constant · never reads input confidence | Pattern reuse |
| C-15 | `scripts/nex1-fix15-verification/probe.ts` · F15-15 5-run identical-output check | — | determinism verifier | Q8 verifier reuses same structure | Test pattern reuse |
| C-16 | Fix 15 · F15-10/11/12/13/14 negative-control cases | — | prove confidence/provenance/filename/candidate-ID/array-order don't alter output | Q8 verifier mirrors at selection level | Test pattern reuse |
| C-17 | Fix 15 · F15-16 forbidden-Q8-field scan (12 prohibited names) | — | prevent Q8-boundary drift in ranker | Q8 verifier reuses scan · with additional Q8-selection-level scans (§12 below) | Test pattern reuse |
| C-18 | Fix 15 · read-only invariant (no writes · no broker calls · no WO-04) | file header | prove Q8-boundary-adjacent discipline | Q8 selector declares same | Pattern reuse |
| C-19 | Provenance chain end-to-end (§K of audit) | Fix 7 → Fix 15 | source_file · line ranges · relationship_ids · candidate_ids propagated | Q8 output reads · does not need to regenerate | 9 of 13 Q8-required provenance fields |
| C-20 | Investigation packet extension pattern | Fix 15's addition of `candidate_rankings` + `candidate_rankings_note` | how to safely extend the packet | Q8 follows identical pattern for `candidate_selection` + `candidate_selection_note` | Fix 15 already demonstrated safe extension including 2 early-exit path patches |

**20 CONNECT items · 0 upstream code changes required.**

---

## 3 · HYBRID List (existing infra · Q8-level semantic adaptation)

| # | Existing component | Required Q8 interpretation | Exact adaptation | Upstream untouched? | Risk |
|---|---|---|---|---|---|
| H-1 | Fix 15 `ranking_state: "TIED"` at rank 1 | Q8 must treat as `TIE + NO_SELECTION` (Decision 5) | Q8 selector reads state · maps to selection state · no code change to Fix 15 | ✅ | Low · pure read |
| H-2 | Fix 15 `scope_state: "UNRESOLVED_ORDER"` | Q8 must treat as `REQUIRE_MORE_INVESTIGATION` OR `NO_SELECTION` (Decision 5/8/18) | Q8 selector maps deterministically · founder policy is explicit | ✅ | Low · deterministic mapping |
| H-3 | Fix 13 `overall_status: "INSUFFICIENT"` | Q8 must map to `INSUFFICIENT_EVIDENCE` selection state (Decision 15) | Q8 selector reads per-candidate · applies policy | ✅ | Low · direct mapping |
| H-4 | Fix 13 `overall_status: "UNRESOLVED"` | Q8 must map to `UNRESOLVED` selection state (Decision 15) | Q8 selector reads · maps · does not merge with INSUFFICIENT | ✅ | Low |
| H-5 | Fix 13 evidence counts (`contradicting_evidence_ids.length > 0` etc) | Q8 blocking check: any contra/unres/insuff blocks selection (Decision 4/6) | Q8 selector reads counts · applies boolean gates · never re-classifies evidence | ✅ | Low · read-only |

**5 HYBRID items · zero upstream code modification · pure Q8-side read + map.**

---

## 4 · BUILD List (genuinely absent · minimum scope)

Every item below was verified absent by direct grep + read. Undercount Protection applied.

| # | Missing capability | Evidence of absence | Proposed file | Proposed symbol | Inputs | Outputs | Policy §  |
|---|---|---|---|---|---|---|---|
| B-1 | `SelectionState` type (6-state union) | grep `SelectionState\|selection_state`: 0 matches | `src/lib/nex-agent/code-engine/capability-candidate-selector.ts` (new) | `SelectionState` | — | union type | §3 · Decisions 5/8/15/18 |
| B-2 | `CandidateSelection` output record (17-field policy shape) | grep `CandidateSelection\|candidate_selection`: 0 matches | same file | `CandidateSelection` | — | interface | §2.19 · Decision 16 |
| B-3 | Q8 selector function | grep `selectCandidate\|selectRoot`: 0 matches | same file | `selectCandidates(input): SelectCandidatesResult` | evaluations + evidence_records + rankings | `{ scopes: SelectionScope[] · stats }` | §2.6-§2.20 |
| B-4 | Rank-1-with-blocking combiner | no code reads rank_position + blocking evidence together | inside B-3 | (helper) | rank_position from Fix 15 + counts from Fix 13 | boolean · reason | Decision 6 |
| B-5 | Tie mapping (TIED → NO_SELECTION) | Fix 15 emits TIED · no mapper exists | inside B-3 | (helper) | ranking_state + scope_state | SelectionState · reason | Decision 5 |
| B-6 | REQUIRE_MORE_INVESTIGATION rule | grep: 0 matches | inside B-3 | (helper) | 7 conditions per Decision 18 | SelectionState · reason | Decision 18 |
| B-7 | Q8 `decision_reason` string field | 0 matches | in B-2 output type | (field) | selection outcome | string · deterministic template | Decision 16 field |
| B-8 | Q8 `policy_id` + `policy_version` stamps | Fix 15 stamps Q7's · not Q8's | in B-2 output type | (fields) | constant | `"NEX1_Q8_SELECTION_POLICY"` + `"V1"` | Decision 12 |
| B-9 | `candidate_selection` field on `InvestigationEvidencePacket` + `candidate_selection_note` | grep: 0 matches | modification to `native-investigation-mode.ts` | (field addition) | selector output | — | §2.19 |
| B-10 | ACTION 15 wiring (physical position after ACTION 14) | pipeline stops at ACTION 14 | modification to `native-investigation-mode.ts` (~40 lines · mirrors Fix 15 wiring) | (code block) | Fix 13/15 outputs from local scope | populates B-9 | §2.6 |
| B-11 | 2 early-exit path patches (REFUSED_CLASSIFIER · REFUSED_NON_INVESTIGATE_INTENT) | Fix 15 already required identical patches | same file | (line-additions) | empty CandidateSelection · "not computed" note | — | packet completeness |
| B-12 | Q8 verifier probe | file does not exist | `scripts/nex1-q8-verification/probe.ts` (new) | (script) | controlled fixtures + real corpus | 18+ verifier cases · receipt JSON | Decision 19 preconditions 11-19 |

**12 BUILD items · consolidated into 2 new files + 1 modified file.**

File map:
- **NEW:** `src/lib/nex-agent/code-engine/capability-candidate-selector.ts` (~450 LOC estimated)
- **NEW:** `scripts/nex1-q8-verification/probe.ts` (~600 LOC estimated)
- **MODIFIED:** `src/lib/nex-agent/code-engine/native-investigation-mode.ts` (~45 lines · pattern identical to Fix 15's addition)
- **NEW (post-implementation report):** `docs/doctrine/nex1-q8-selector-2026-09-XX.md`

The audit's "11 BUILD items" collapses to **2 new files + 1 modified file** in practice because most items live inside `capability-candidate-selector.ts`.

---

## 5 · Minimum Q8 Data Flow

```
                            ┌────────────────────────────────────┐
                            │      LOCAL SCOPE INSIDE runInvestigation │
                            │                                    │
                            │  hypothesisEvaluations   (Fix 13)  │
                            │  hypothesisEvidenceRecords (Fix 13) │
                            │  candidateRankings       (Fix 15)  │
                            │                                    │
                            └───────────────┬────────────────────┘
                                            ↓  (all already local variables at ACTION 14's end)

                                selectCandidates(input)
                                            │
                                            ↓
     ┌──────────────────────────────────────────────────────────────────────┐
     │  STEP 1 · group rankings by source_file scope (already scoped)         │
     │  STEP 2 · for each candidate:                                          │
     │           - read rank_position + ranking_state (Fix 15)                │
     │           - read overall_status + counts (Fix 13)                      │
     │           - identify blocking presence (contra/unres/insuff)           │
     │  STEP 3 · apply Decision 6 (rank-1-with-blocking)                       │
     │  STEP 4 · apply Decision 5 (tie → NO_SELECTION)                         │
     │  STEP 5 · apply Decision 15 (INSUFFICIENT vs UNRESOLVED distinct)      │
     │  STEP 6 · apply Decision 8 (NO_SELECTION honest uncertainty)           │
     │  STEP 7 · apply Decision 18 (REQUIRE_MORE_INVESTIGATION on 7 conds)    │
     │  STEP 8 · emit CandidateSelection per scope                             │
     │  STEP 9 · enforce provenance completeness (Decision 12)                │
     │  STEP 10 · enforce forbidden-causal-vocab / type-lock (defence-in-depth)│
     └──────────────────────────────────────────────────────────────────────┘
                                            ↓
                                candidate_selection (field on packet)
                                            ↓
                                    packet returned to caller
                                            ↓
                                [ CONSUMER GAP · pre-existing ]
```

No new evidence classes. No new evidence classifiers. No new comparators. No new rankers. Q8 is a **thin policy-application layer** over already-computed evidence.

---

## 6 · Q8 Contract (proposed · not authored to repository)

### 6.1 · Input

```
SelectCandidatesInput = {
  evaluations:      HypothesisEvaluation[]           (from Fix 13)
  evidence_records: HypothesisEvidenceEvaluation[]   (from Fix 13)
  rankings:         RankingScope[]                    (from Fix 15)
  max_scopes?:      number                            (bounded)
}
```

All three arrays already exist in `runInvestigation`'s local scope by the time ACTION 15 would run.

### 6.2 · Internal evaluation (per candidate)

- Read from Fix 15: `rank_position`, `ranking_state`, `differentiating_rule`, per-category counts, `deduplicated_relationship_ids`, `policy_id: "NEX1_RANKING_POLICY"`, `policy_version: "V1"`.
- Read from Fix 13: `overall_status`, `supporting_evidence_ids`, `contradicting_evidence_ids`, `insufficient_evidence_ids`, `unresolved_evidence_ids`, `provenance`.
- No re-classification of evidence.
- No cross-scope selection (Decision 1 boundary implicit via Fix 15 scope).

### 6.3 · Output (17 fields per Decision 16)

| # | Field | Type | Source | Required? | Meaning |
|---|---|---|---|---|---|
| 1 | `investigation_id` | string | Fix 15 packet field | required | Q8 stamps from context |
| 2 | `trace_id` | string | Fix 15 packet field | required | Q8 stamps from context |
| 3 | `selection_state` | SelectionState (6-state) | Q8 policy result | required | SELECTED / NO_SELECTION / TIE / INSUFFICIENT_EVIDENCE / UNRESOLVED / REQUIRE_MORE_INVESTIGATION |
| 4 | `selected_candidate` | string \| null | Q8 policy result | required | null unless state === SELECTED |
| 5 | `candidate_rankings` | RankingScope[] (reference or subset) | Fix 15 input passthrough | required | audit link · read-only |
| 6 | `candidates_considered` | string[] | Fix 15 input | required | all candidate_ids at this scope |
| 7 | `supporting_evidence` | evidence_id[] | Fix 13 arrays for selected/considered candidates | required | audit link |
| 8 | `contradicting_evidence` | evidence_id[] | Fix 13 arrays | required | audit link |
| 9 | `insufficient_evidence` | evidence_id[] | Fix 13 arrays | required | audit link |
| 10 | `unresolved_evidence` | evidence_id[] | Fix 13 arrays | required | audit link |
| 11 | `decision_reason` | string (deterministic template) | Q8 policy result | required | e.g. `"NO_SELECTION: rank-1 candidate has 2 contradicting evidence records (Decision 6)"` · no natural-language prose |
| 12 | `confidence` | number (fixed constant · not weight) | Q8 · CONFIDENCE_FIXED | required | informational only · never affects state |
| 13 | `provenance` | { source_file · line ranges · evidence_ids · relationship_ids }[] | Fix 7-15 chain | required | 12 of 13 minimum fields available |
| 14 | `policy_id` | "NEX1_Q8_SELECTION_POLICY" | constant | required | Q8-level stamp |
| 15 | `policy_version` | "V1" | constant | required | Q8-level stamp |
| 16 | `uncertainty` | string \| null (deterministic template) | Q8 policy result | required | reason for uncertainty when state ≠ SELECTED |
| 17 | `recommended_next_action` | string (deterministic template) | Q8 policy result | required | e.g. `"gather runtime evidence for candidate X"` when REQUIRE_MORE_INVESTIGATION |

Type-locked: `evidence_kind: "INFERRED"` on every record (Decision 14 · §2.17).

### 6.4 · Field provenance verdict

- 14 of 17 fields **directly readable** from existing Fix 13/15 outputs.
- 3 of 17 fields (`selection_state`, `decision_reason`, `uncertainty` structured template · `recommended_next_action` structured template) are **new deterministic emissions** by the Q8 selector.

---

## 7 · Selection State Vocabulary (Decisions 5/8/15/18 · no invention)

The Q8 selector emits exactly one of six states per candidate scope:

| State | Emitted when | selected_candidate |
|---|---|---|
| `SELECTED` | Exactly one candidate passes all Decision 4-6 checks · no rank-1-blocking · no tie · no INSUFFICIENT · no UNRESOLVED · Decision 3 threshold satisfied | non-null (single candidate_id) |
| `NO_SELECTION` | Multiple candidates fail selection AND no more-specific state applies (residual honest-uncertainty state) | null |
| `TIE` | Fix 15 emitted `TIED` at rank 1 (Decision 5) | null |
| `INSUFFICIENT_EVIDENCE` | Fix 13 `overall_status: "INSUFFICIENT"` on rank-1 candidate (Decision 15) | null |
| `UNRESOLVED` | Fix 13 `overall_status: "UNRESOLVED"` on rank-1 candidate (Decision 15) | null |
| `REQUIRE_MORE_INVESTIGATION` | Any of Decision 18's 7 triggering conditions present | null |

**State precedence (deterministic · order matters):**

```
1. If Fix 15 scope_state == UNRESOLVED_ORDER              → REQUIRE_MORE_INVESTIGATION
2. If ranking_state at rank 1 == TIED                     → TIE
3. If overall_status at rank 1 == STRUCTURALLY_CONTRADICTED → NO_SELECTION (blocking · Decision 6)
4. If overall_status at rank 1 == INSUFFICIENT             → INSUFFICIENT_EVIDENCE
5. If overall_status at rank 1 == UNRESOLVED               → UNRESOLVED
6. If rank-1 has any blocking counts (contra > 0 · unres > 0 · insuff > 0) → NO_SELECTION (Decision 6)
7. If overall_status at rank 1 == STRUCTURALLY_SUPPORTED   → SELECTED
8. Otherwise                                              → NO_SELECTION
```

**Ambiguity check:** Decision 5 says "tie → TIE + NO_SELECTION". Decision 8 says "NO_SELECTION" is umbrella. This plan treats TIE as more specific than NO_SELECTION (rule 2 above · precedence order). If the founder intends TIE and NO_SELECTION to be a compound state or if `selection_state` should carry both, this is a **flagged ambiguity** — not resolved in the plan. Report before implementation.

---

## 8 · Selection Algorithm (plain steps · no code)

```
FUNCTION selectCandidates(evaluations, evidence_records, rankings):

  for each RankingScope in rankings (sorted by source_file):
      collect candidates in scope (deterministic order via candidate_id)

      if scope_state == "SINGLETON":
          if the singleton passes all Decision 4-6 checks:
              emit SELECTED · reason = "singleton candidate satisfies Q8 policy"
          else:
              emit appropriate blocking state per §7 precedence

      elif scope_state == "UNRESOLVED_ORDER":
          emit REQUIRE_MORE_INVESTIGATION for all candidates in scope
          reason = "ranking policy could not distinguish · Q8 requires additional evidence"

      elif scope_state == "ALL_TIED":
          emit TIE · selected_candidate = null
          reason = "all candidates tied at rank 1 · Decision 5 blocks selection"

      elif scope_state == "RANKED":
          identify rank-1 candidate (unique · Fix 15 already stable-sorted)
          read overall_status + counts from Fix 13 for rank-1
          apply §7 precedence table:
              step 1 → REQUIRE_MORE_INVESTIGATION
              step 2 → TIE (checks if rank 1 has any peer at rank 1)
              steps 3-6 → blocking states
              step 7 → SELECTED
              step 8 → NO_SELECTION

      build CandidateSelection record (17 fields per §6.3):
          selection_state = <computed>
          selected_candidate = <candidate_id or null>
          decision_reason = <deterministic template · e.g. "NO_SELECTION: rank-1 has 2 contradicting records">
          provenance = collect from Fix 13/15 records for candidates_considered
          policy_id = "NEX1_Q8_SELECTION_POLICY"
          policy_version = "V1"
          confidence = 0.35 (fixed · informational only)
          uncertainty = <deterministic template when state ≠ SELECTED else null>
          recommended_next_action = <deterministic template>
          evidence_kind = "INFERRED"

      runtime defence-in-depth checks:
          reject if record contains any FORBIDDEN_CAUSAL_TOKENS
          reject if evidence_kind mutated
          reject if provenance array empty when state == SELECTED

      append to results

  deterministic final sort by source_file (stable · same as Fix 15)
  return { scopes, stats }
```

**Prohibited absolutely (algorithm-level enforcement):**

- ❌ Numerical weights or composite scores
- ❌ Confidence read from input (only fixed constant emitted as output)
- ❌ Filename-based ordering (source_file only for scope grouping · never for state decision)
- ❌ Candidate-ID-based state decision (used only for stable output presentation within tie bucket)
- ❌ Array-order-based state decision (input reordered internally)
- ❌ Timestamp / random / Date.now / Math.random
- ❌ External LLM
- ❌ nex-debugger imports

---

## 9 · ACTION 15 Wiring Plan

**Physical position:** immediately after ACTION 14 (line ~1005) · before `ASSESS` block (line 1042) · exact mirror of ACTION 14's Fix 15 wiring pattern.

**Pattern (skeleton · plan only · no code committed):**

```
// ── ACTION 15 · CANDIDATE SELECTION (Fix 16 · 2026-09-XX) ─────────────
// Deterministic Q8 selection per NEX1_Q8_SELECTION_POLICY V1 (FOUNDER_APPROVED).
// Consumes Fix 13 evaluations + Fix 15 rankings · emits candidate_selection
// with SELECTED / NO_SELECTION / TIE / INSUFFICIENT_EVIDENCE / UNRESOLVED /
// REQUIRE_MORE_INVESTIGATION state per scope.
// See docs/doctrine/nex1-q8-selection-policy-v1-founder-approved-2026-09-17.md.
try {
  const selResult = selectCandidates({
    evaluations: hypothesisEvaluations,
    evidence_records: hypothesisEvidenceRecords,
    rankings: candidateRankings,
  });
  candidateSelection = selResult.scopes;
  candidateSelectionNote = /* stats string */;
  reasoningTrace.push(`candidate_selection · ${selResult.stats.total_selections} emitted`);
} catch (e) {
  candidateSelectionNote = `candidate selection failed: ${e.message}`;
  capabilityGaps.push("candidate_selection: exception");
}
```

**Consumes (from local scope):**
- `hypothesisEvaluations` (already local by line 933)
- `hypothesisEvidenceRecords` (already local by line 933)
- `candidateRankings` (already local by line 985)

**Produces:**
- `candidateSelection: readonly SelectionScope[]` (local variable)
- `candidateSelectionNote: string` (local variable)

**Early exits already require patching:**
- REFUSED_CLASSIFIER (line 327 finalise call)
- REFUSED_NON_INVESTIGATE_INTENT (line 394 finalise call)

Both must add `candidateSelection: [], candidateSelectionNote: "not computed (…)"` fields · identical shape to Fix 15's existing patches.

**FinaliseInput type extension:** add `candidateSelection: readonly SelectionScope[]` + `candidateSelectionNote: string`.

**finalise() body extension:** propagate to `candidate_selection` / `candidate_selection_note` packet fields.

---

## 10 · InvestigationEvidencePacket Change

**New fields (in type declaration order · after `candidate_rankings_note`):**

```
readonly candidate_selection: readonly SelectionScope[];
readonly candidate_selection_note: string;
```

- Populated at ACTION 15 (main path) or as `[] / "not computed"` at each early-exit path.
- On NO_SELECTION: `SelectionScope[]` non-empty · each scope has selection_state=NO_SELECTION · `selected_candidate = null`.
- On TIE: `SelectionScope[]` non-empty · state=TIE · `selected_candidate = null`.
- On REQUIRE_MORE_INVESTIGATION: state=REQUIRE_MORE_INVESTIGATION · `selected_candidate = null` · `recommended_next_action` populated.

**Existing consumers of the packet:** none (CONSUMER GAP · see §15). No existing consumer is affected by the addition.

**Existing tests:** the four Fix 12-15 verifier probes exercise the ranker/comparator/evaluator directly · not via runInvestigation. They do not read the packet. Adding a new field is non-breaking.

---

## 11 · Policy Stamping Plan

Every Q8 output record includes:

```
policy_id:      "NEX1_Q8_SELECTION_POLICY"
policy_version: "V1"
```

Q7's stamp on Fix 15 records (`policy_id: "NEX1_RANKING_POLICY"`, `policy_version: "V1"`) is **not overwritten**. The two stamps coexist:

- `candidate_rankings[*].rankings[*].policy_id / policy_version` — Q7 identity
- `candidate_selection[*].rankings_derived_from_policy_id / policy_version` — Q7 identity referenced (audit link)
- `candidate_selection[*].policy_id / policy_version` — Q8 identity

Distinguishable at every layer.

---

## 12 · Provenance Flow (§K of audit · confirmed complete for Q8)

Q8 receives (via read):

- `investigation_id` (already threaded)
- `trace_id` (already threaded)
- `candidate_id` (Fix 12/13/14/15)
- `source_file` (Fix 7 through Fix 15 · derivable via candidate_id.split("::")[0] OR explicit field on RankingScope)
- Source line ranges (Fix 7 through Fix 15 provenance arrays)
- Evidence identifiers (Fix 13 evidence_id)
- Relationship identifiers (Fix 10 relationship_id · Fix 13/14/15 preserved)
- `evidence_kind` (all Fixes)
- Evidence status (Fix 13)
- Q7 `policy_id` / `policy_version` (Fix 15)

Q8 adds:

- Q8 `policy_id` / `policy_version`
- `selection_state`
- `decision_reason`
- `uncertainty` (structured template)
- `recommended_next_action` (structured template)

**No provenance is dropped.** No provenance is invented. The chain terminates in a Q8 record that is fully reconstructable back to source facts.

---

## 13 · Negative Control Matrix (Q8 verifier plan)

| # | Test | Founder ref | Approach | Predicted result |
|---|---|---|---|---|
| Q8-N1 | Rank 1 does not auto-select | prompt §12 | Fixture: rank-1 candidate with 0 supporting · 2 contra · construct scenario where Fix 15 puts it at rank 1 despite blocking · verify Q8 emits NO_SELECTION | selection_state=NO_SELECTION · not SELECTED |
| Q8-N2 | TIE remains TIE / NO_SELECTION | Decision 5 | Fixture: 2 candidates identical evidence · Fix 15 emits TIED at rank 1 · Q8 must map to TIE | selection_state=TIE · selected_candidate=null |
| Q8-N3 | Contradicting blocks | Decision 4/6 | Fixture: rank-1 candidate with 1+ contra · run Q8 | selection_state=NO_SELECTION · reason mentions contradicting count |
| Q8-N4 | INSUFFICIENT blocks | Decision 15 | Fixture: Fix 13 emits overall_status=INSUFFICIENT for rank-1 | selection_state=INSUFFICIENT_EVIDENCE |
| Q8-N5 | UNRESOLVED blocks | Decision 15 | Fixture: Fix 13 emits overall_status=UNRESOLVED for rank-1 | selection_state=UNRESOLVED |
| Q8-N6 | Confidence cannot alter | Decision 11 | Two runs: flip confidence values on rank-1 · same Q8 output | identical selection_state and selected_candidate |
| Q8-N7 | Filename cannot alter | Decision 4 | Two runs: rename source_file identifier · same evidence profile · same Q8 output | identical selection pattern |
| Q8-N8 | Candidate ID cannot alter | Decision 4 | Two runs: swap candidate_id symbols · same evidence profile | identical selection pattern |
| Q8-N9 | Array order cannot alter | Decision 13 | Two runs: reverse input arrays · same output | identical scopes[].rankings[] output |
| Q8-N10 | No external LLM | Decision 10 | Grep selector file for openai/claude/gpt/gemini/groq/anthropic/model imports · assert 0 hits · assert zero_llm invariant declared | 0 hits · invariant present |
| Q8-N11 | Missing provenance cannot silently become valid | Decision 12 | Fixture: strip evidence_ids from records · run Q8 · verify runtime rejection | selection rejected · reason mentions incomplete provenance |
| Q8-N12 | Selection cannot trigger modification | Decision 17 | Grep selector for `writeFileSync\|fs.write\|WO-04\|broker\|execute` · assert 0 hits | 0 hits · runtime read-only |
| Q8-N13 | Selection cannot trigger execution | Decision 17 | Same as N12 · confirms boundary | 0 hits |
| Q8-N14 | Q8 cannot bypass authorization | Decision 17 | Assert no Ed25519 / trust-anchor / G15 / WO-04 import | 0 hits |
| Q8-N15 | Q8 cannot bypass verification | Decision 17 | Assert Q8 output declares `verified: false` or equivalent · never `PROVEN` | verified=false invariant · evidence_kind=INFERRED |

**Positive cases:**

| # | Test | Fixture | Expected state |
|---|---|---|---|
| Q8-P1 | Valid selection | 1 candidate · overall_status=SUPPORTED · no blocking · Fix 15 emits RANKED singleton | SELECTED |
| Q8-P2 | Legitimate tie | 2 candidates same evidence · Fix 15 emits TIED | TIE |
| Q8-P3 | Honest no-selection | multi-candidate · rank-1 has 1 contra | NO_SELECTION |
| Q8-P4 | Insufficient state | Fix 13 emits INSUFFICIENT | INSUFFICIENT_EVIDENCE |
| Q8-P5 | Unresolved state | Fix 13 emits UNRESOLVED | UNRESOLVED |
| Q8-P6 | REQUIRE_MORE state | Fix 15 emits UNRESOLVED_ORDER scope | REQUIRE_MORE_INVESTIGATION |

**Determinism:** Q8-D1 · 5-run identical-output check (F15-15 pattern).

**Total planned probe cases:** 15 negative + 6 positive + 1 determinism + 1 boundary scan = **~23 verifier cases**.

---

## 14 · Real Runtime Verification Plan

Q8 will not be classified verified merely because:
- code compiles
- unit tests pass
- fixture tests pass
- types resolve

**Real verification requirements:**

- **Input:** actual `runInvestigation` invocation on a real corpus (Test S corpus reused: 5 candidates × 2 SUPP each in `wo9-corrector.ts` `proposeCorrection` context) · exercised via the full pipeline · not a Q8-only shortcut.
- **Execution path:** entire ACTION 1 → ACTION 14 → ACTION 15 chain runs. Q8 receives real Fix 13 evaluations + real Fix 15 rankings.
- **Expected output:** given Test S corpus (all 2 SUPP · 0 blocking · shared=0 · Fix 15 emits ALL_TIED at rank 1), Q8 must emit `selection_state: TIE · selected_candidate: null` for every scope. This is the honest-uncertainty outcome under founder-approved V1 policy.
- **Evidence captured:** receipt at `data/nex1-q8/receipt-2026-09-XX.json` including all 23 verifier cases + 1 real-corpus run.
- **Provenance captured:** every Q8 record traced back to Fix 13 evidence_id + Fix 15 rank_position + source_file + line ranges.
- **Negative controls:** 15 cases per §13 · all PASS required.
- **Determinism runs:** 5-run identical-output check on Test S corpus · zero variance.
- **Regression requirements:** see §15.

---

## 15 · Regression Requirements

Q8 implementation must NOT break:

| Regression check | How to verify | Expected result |
|---|---|---|
| Q1-Q6 (existing capability-A / M-1 / classifier / etc) | run `capability-a-founder-intent/__tests__` if present · verify existing regression suites | no failures introduced |
| Fix 13 verifier | `npx tsx scripts/nex1-fix13-verification/probe.ts` | exit 0 · 5 RUNTIME_VERIFIED |
| Fix 14 verifier | `npx tsx scripts/nex1-fix14-verification/probe.ts` | exit 0 · 5 RUNTIME_VERIFIED |
| Fix 15 verifier | `npx tsx scripts/nex1-fix15-verification/probe.ts` | exit 0 · 18/18 PASS |
| Test S probe | `npx tsx scripts/nex1-test-s/probe.ts` | exit 0 · Q8 field now populated · TIE state emitted |
| Existing investigation behaviour | InvestigationEvidencePacket structure backwards-compatible? | 2 new fields added · no field renamed or removed |
| Existing evidence semantics | Fix 13 output unchanged? | yes (Q8 is a downstream reader) |
| Existing ranking semantics | Fix 15 output unchanged? | yes |
| Track A | no G15 / C6 / Ed25519 / WO-04 / execution-broker changes | grep confirms 0 hits |

---

## 16 · Consumer Gap (§I of audit · pre-existing · not solved by Q8)

**Documented gap:** `runInvestigation` + `InvestigationEvidencePacket` have no external production consumers (each grep returns 1 file only).

**Impact on Q8 implementation safety:**
- Q8 CAN be implemented safely without a consumer · because Q8's runtime verification runs via a dedicated probe (`scripts/nex1-q8-verification/probe.ts`) that calls `selectCandidates()` and `runInvestigation()` directly.
- Q8 CAN prove its own behaviour at runtime without depending on a downstream reader.
- Q8's output being unconsumed does NOT violate the Q8 V1 policy (which requires Q8 to PRODUCE structured selection · not to guarantee downstream consumption).

**Classification:** the consumer gap is a **pre-existing NEX1 pipeline gap unrelated to Q8**. This plan does NOT propose to solve it. If the founder later decides a downstream reader is required, that requires separate authorization and scoping.

**Founder decision surfaced (not requested by this plan):** should a Q8 consumer (e.g., an orchestrator or a build-report emitter) be planned as a separate future work item? Not answered here.

---

## 17 · nex-debugger Independence (§16 · Decision 2)

**Confirmed:** the entire Q8 implementation plan requires **zero imports from `nex-debugger`**.

- No import of `RootCauseCandidate` from `nex-debugger/types.ts`
- No import of `performDiagnosis` from `nex-debugger/debugger.ts`
- No adoption of `authoritative_top_candidate` semantics
- No adoption of C-3/C-4/C-5 constitution
- No use of nex-debugger `authority` field
- No use of nex-debugger SBFL / AST-diff selection rule
- No use of `nex-debugger` outputs as NEX1 evidence

`nex-debugger` remains COMPONENT_COMPLETE in its own domain · UNCONNECTED to NEX1. Its own tests and API remain unchanged.

**If a future founder decision changes this,** it requires an explicit new prompt · not implicit adoption during Q8 implementation.

---

## 18 · Ordered Future Work (derived from repository dependencies)

Phase order derived from dependency graph (not assumed from prompt template):

```
PHASE A · Plan Review + Ambiguity Resolution (this document + founder response)
   └── founder confirms selection_state precedence (§7 flagged ambiguity)
   └── founder confirms 17-field output shape (§6.3)

PHASE B · Build capability-candidate-selector.ts
   └── new file · ~450 LOC
   └── SelectionState type · CandidateSelection type · selectCandidates() · defence-in-depth checks
   └── zero upstream code changes

PHASE C · Wire ACTION 15 in native-investigation-mode.ts
   └── modified file · ~45 lines (Fix 15 wiring pattern)
   └── includes 2 early-exit path patches + finalise wiring
   └── depends on B

PHASE D · Build scripts/nex1-q8-verification/probe.ts
   └── new file · ~600 LOC
   └── 15 negative controls + 6 positive cases + 1 determinism + 1 boundary scan
   └── depends on B (must exist to be tested)

PHASE E · Runtime verification
   └── run probe.ts
   └── run against Test S corpus (real evidence)
   └── receipt at data/nex1-q8/receipt-2026-09-XX.json
   └── depends on D

PHASE F · A-S regression + Fix 12/13/14/15 regression
   └── all prior probes still pass · Test S packet now populated with Q8 field
   └── depends on E

PHASE G · Report at docs/doctrine/nex1-fix16-candidate-selector-2026-09-XX.md
   └── mirror Fix 15 report structure

PHASE H · Founder review
   └── founder verdict on plan-vs-implementation fidelity

PHASE I · Activation only after founder authorization
   └── no "activation" in the code sense · but Q8 output becomes available for future consumers
```

**Cannot begin PHASE B without explicit founder BUILD authorization prompt.**

---

## 19 · Implementation Size Estimate

| Phase | New files | Modified files | Approx LOC | Tests | Risk | Dependencies |
|---|---|---|---|---|---|---|
| A | 0 | 0 | 0 | 0 | Very Low | Q8 policy + audit |
| B | 1 (`capability-candidate-selector.ts`) | 0 | ~450 | 0 (verifier is Phase D) | Low · pure-function selector · pattern mirrors Fix 15 | C-1..C-19 read patterns |
| C | 0 | 1 (`native-investigation-mode.ts`) | +45 | 0 | Low-Medium · 2 early-exit patches needed (identical to Fix 15's pattern) | B |
| D | 1 (`scripts/nex1-q8-verification/probe.ts`) | 0 | ~600 | 23 verifier cases | Low · fixture-based · isolated | B |
| E | 1 (`data/nex1-q8/receipt-2026-09-XX.json`) | 0 | JSON output | — | Low | D |
| F | 0 | 0 | 0 | rerun existing probes | Low | E |
| G | 1 (`docs/doctrine/nex1-fix16-candidate-selector-2026-09-XX.md`) | 0 | doctrine | — | Low | F |

**Totals:**
- **New files:** 4 (1 capability · 1 probe · 1 receipt · 1 doctrine)
- **Modified files:** 1 (native-investigation-mode.ts)
- **Approx code LOC:** ~1050 code + ~500 doc
- **New tests:** ~23 verifier cases
- **Risk:** Low overall · every pattern already proven at Fix 15 layer

---

## 20 · Risks + Hard Stops

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Selection algorithm silently uses candidate_id for ordering (hidden tie-breaker) | Medium · easy to miss | Q8-N8 explicitly tests this · precedence table in §7 makes candidate_id used only for stable output, never for state decision |
| Confidence sneaks into selection via aggregate | Low | Q8-N6 tests · CONFIDENCE_FIXED constant per Fix 15 pattern |
| Non-structural evidence adopted before founder authorizes | Low · Decision 7 permits but does not require | Q8 V1 selector reads only Fix 13/15 structural inputs · no runtime/behavioural pipeline used |
| Ambiguity in TIE vs NO_SELECTION coexistence (§7 flagged) | Certain until resolved | Report to founder before PHASE B · do not implement until resolved |
| Fix 13 `overall_status` semantics drift in future | Low | Q8 verifier includes fixture that pins Fix 13 output shape · regression catches |
| ACTION 15 wiring accidentally breaks early-exit paths | Medium · Fix 15 required 2 identical patches · same pattern here | Fix 15's exact patch pattern reused |
| Consumer gap makes Q8 output unobservable in production | Certain · pre-existing · not Q8's responsibility | Documented in §15 · Q8 provable via own verifier |
| nex-debugger accidentally imported | Low · Decision 2 explicit | Grep gate in verifier Q8-N10 catches any import |

### Hard Stops (implementation must halt if any occur)

- Policy conflict discovered between Q8 V1 and evidence-layer semantics
- Required Fix 13 or Fix 15 field found missing at runtime
- Provenance cannot be preserved for a given evidence path
- Determinism cannot be guaranteed (5-run mismatch)
- Hidden tie-breaking detected in fixture testing
- Any external-model influence (import · dependency · call) appears
- Q7 output changes as a side effect
- Track A file modified
- `nex-debugger` becomes required
- Any authorization boundary crossed (write · execute · broker · WO-04)

Any hard stop triggers: **halt PHASE · report to founder · await new prompt.**

---

## 21 · Final Implementation Readiness

```
Q8_POLICY:                    FOUNDER_APPROVED  (V1 · 2026-09-17)
Q8_ARCHITECTURE_AUDIT:        COMPLETE           (2026-09-17)
Q8_IMPLEMENTATION:            NOT_STARTED
Q8_RUNTIME:                   NOT_VERIFIED
Q8_BUILD_AUTHORIZATION:       NOT_GRANTED
Q7:                           UNCHANGED (V1 · FOUNDER_APPROVED · RUNTIME_VERIFIED)
NEX_DEBUGGER:                 INDEPENDENT
TRACK_A:                      FROZEN
EXTERNAL_MODEL:               NONE
PRODUCTION_CODE_CHANGES:      0
COMMITS:                      0
PUSHES:                       0
```

### A · What can be connected immediately (once BUILD is authorized)

20 CONNECT items in §2 · all patterns and infrastructure already exist. Zero upstream code modification. Fix 13/14/15 outputs · investigation_id/trace_id threading · forbidden-causal-vocab check · type-lock INFERRED · zero-LLM invariant · deterministic-sort · CONFIDENCE_FIXED · F15-15 test pattern · F15-* negative-control patterns · provenance passthrough · packet-extension pattern from Fix 15.

### B · What requires adaptation

5 HYBRID items in §3 · all Q8-side read-and-map · no upstream code touched. Ranking-state ↔ selection-state naming · overall_status ↔ selection state naming · blocking-count ↔ blocking-flag boolean gates.

### C · What genuinely must be built

12 BUILD items in §4 · consolidated into **2 new files + 1 modified file**:
- **NEW:** `src/lib/nex-agent/code-engine/capability-candidate-selector.ts` (~450 LOC · SelectionState type · CandidateSelection type · selectCandidates function · rank-1-with-blocking combiner · tie mapping · REQUIRE_MORE_INVESTIGATION logic · policy stamps · decision_reason emission · defence-in-depth checks)
- **NEW:** `scripts/nex1-q8-verification/probe.ts` (~600 LOC · 15 negative controls · 6 positive cases · determinism · boundary scan)
- **MODIFIED:** `src/lib/nex-agent/code-engine/native-investigation-mode.ts` (+45 lines · ACTION 15 wiring · packet field addition · 2 early-exit patches · finalise wiring)

### D · What must be verified

- 15 Q8-level negative controls (§13)
- 6 Q8-level positive states (§13)
- Determinism (5-run identical output)
- Boundary scan (0 Q8-modification / execution / auth-bypass hits)
- Regression: Fix 12/13/14/15 verifiers still exit 0 · Test S probe still exits 0 with candidate_selection field now populated
- Real corpus: Test S 5-candidate × 2 SUPP produces TIE state per V1 policy (honest-uncertainty outcome)

### E · Implementation dependency order

PHASE A (plan review + ambiguity resolution) → PHASE B (build selector) → PHASE C (wire ACTION 15) → PHASE D (verifier probe) → PHASE E (runtime verification) → PHASE F (regression) → PHASE G (report) → PHASE H (founder review) → PHASE I (activation)

### F · Estimated scope

- 2 new production files · 1 modified production file · 1 verifier probe · 1 receipt JSON · 1 doctrine report
- ~1050 code LOC + ~500 doctrine LOC
- ~23 verifier cases
- No new schemas · no new database entries · no new API routes

### G · Risks

Documented in §20 · every risk has a mitigation grounded in an existing Fix 15 pattern.

### H · Hard stops

Documented in §20 · triggers halt-and-report.

### I · Exact authorization required for the next step

Founder issues an authorization prompt titled (or equivalent to) **"NEX1 Fix 16 · Q8 Selector Build Authorization"** with §-numbered directives similar to Fix 15's authorization prompt, explicitly authorizing:

1. Creation of `src/lib/nex-agent/code-engine/capability-candidate-selector.ts`
2. Modification of `src/lib/nex-agent/code-engine/native-investigation-mode.ts` (ACTION 15 wiring + packet field + 2 early-exit patches)
3. Creation of `scripts/nex1-q8-verification/probe.ts`
4. Runtime verification against real NEX1 evidence
5. A-S regression check
6. Report at `docs/doctrine/nex1-fix16-candidate-selector-2026-09-XX.md`

**Not authorized by this plan:**

- Q8 activation (declaring Q8 operational after implementation) · that requires a separate founder step per Decision 19 precondition 20
- Consumer for the packet (pre-existing gap · scoped separately)
- Any nex-debugger connection (Decision 2 lock)
- Any Track A change (permanent lock unless founder specifically unfreezes)
- Any Q7 policy change (V1 is founder-approved)
- Any Q8 policy change (V1 is founder-approved · this plan implements the existing policy)

---

## 22 · Flagged Ambiguities (report before PHASE B)

1. **§7 selection-state precedence:** the plan proposes an explicit precedence order (UNRESOLVED_ORDER → TIE → contradiction → INSUFFICIENT → UNRESOLVED → any-blocking → SELECTED → NO_SELECTION). Founder to confirm order OR provide alternative.

2. **§7 TIE + NO_SELECTION compound state:** Decision 5 says "TIE and NO_SELECTION" · Decision 8 says "NO_SELECTION" umbrella. Plan interprets TIE as more specific than NO_SELECTION. Founder to confirm this reading is correct · alternative interpretation would emit both fields (`selection_state: TIE, no_selection_reason: "tie"`) instead of picking one.

3. **§6.3 field #5 `candidate_rankings` in output:** Decision 16 lists it. Interpretation choice: (a) full pass-through of RankingScope[] · (b) reference only (scope_id + rank_position per candidate) · (c) subset (just rank of candidates_considered). Plan currently proposes (b) to minimize duplication. Founder to confirm.

4. **§6.3 field #12 `confidence`:** Decision 11 says informational only. Plan emits fixed constant 0.35. Founder to confirm no per-candidate confidence copy is required (which would be pass-through of Fix 12/13 confidence · still informational).

5. **§9 physical position of ACTION 15:** proposed immediately after ACTION 14 (line ~1005) · before ASSESS block. Founder to confirm this location · alternative would be after ACTION 5 absence analysis (line 1007) or another position.

**None of these ambiguities are policy conflicts** · they are interpretation choices within the founder-approved policy. Awaiting founder response before PHASE B.

---

## 23 · Boundary Compliance

- ✅ Did NOT implement Q8
- ✅ Did NOT modify production code
- ✅ Did NOT create test files
- ✅ Did NOT create Q8 types
- ✅ Did NOT create Q8 selectors
- ✅ Did NOT connect components
- ✅ Did NOT commit
- ✅ Did NOT push
- ✅ Did NOT activate anything
- ✅ Did NOT touch Track A
- ✅ Did NOT touch Q7 policy or Fix 15 mechanism
- ✅ Did NOT modify or connect nex-debugger

---

## 24 · Hard Stop

Per founder instruction: **written the implementation plan · STOPPED.**

Awaiting founder review. Any of the following are valid next founder responses:

1. **APPROVE PLAN** → issue Fix 16 build authorization prompt
2. **REVISE PLAN** → specify plan §§ to change · new plan version emerges · loop
3. **REJECT PLAN** → plan approach is wrong · restate what to plan differently
4. **PAUSE** → Q8 remains at policy-approved but not-implemented indefinitely

**No implementation begins until an explicit build authorization is issued.**

---

*End of NEX1 Q8 Implementation Plan · 2026-09-17*

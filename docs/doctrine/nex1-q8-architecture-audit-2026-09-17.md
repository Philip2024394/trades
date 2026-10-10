# NEX1 · Q8 Root-Cause Selection · Architecture / Connect-Before-Build Audit

**Date:** 2026-09-17
**Authorization:** Founder Q8 Architecture Audit prompt · **DIAGNOSTIC ONLY** · not implementation authorization
**Audit type:** Architecture truth + connection audit
**External model:** NONE (native inspection · deterministic grep + read)
**Production code changes:** 0
**Track A:** FROZEN (untouched)
**Q8 implementation:** NOT started (audit prompt forbids)

---

## Executive Summary

**Q8 architecture status (evidence-derived, not asserted):**

```
Q8_STATUS:                NOT_IMPLEMENTED_IN_NEX1_PIPELINE
POLICY_STATUS:            Q8 POLICY NOT_FOUND (explicitly EXCLUDED by V1 ranking policy §2.23)
MECHANISM_STATUS:         NEX1 NATIVE PIPELINE: NOT_IMPLEMENTED · nex-debugger: PARALLEL SELECTION EXISTS (unconnected)
CONSUMER_STATUS:          NO CONSUMER of candidate_rankings beyond its producer
INPUT_STATUS:             all Q8-input candidates PRESENT in packet · but no selection layer reads them
VERIFICATION_STATUS:      F15-16 (Q8 boundary) PASSED · zero prohibited fields · boundary honored
EXTERNAL_MODEL:           NONE
PRODUCTION_CODE_CHANGES:  0
UNEXPECTED_WRITES:        0
TRACK_A_STATUS:           FROZEN
```

**Bottom line:** Q7 → Q8 transition is a genuine capability gap. NEX1 has enough structured evidence to *feed* a Q8 mechanism (`candidate_rankings` + `hypothesis_evaluations` + `candidate_comparisons` + `root_cause_candidates` are all populated per packet). It has zero code that *consumes* that evidence to select a root cause · zero founder-authored Q8 policy defining what "sufficient to select" means · one unconnected parallel selection engine (`nex-debugger` · SBFL+AST-diff) with its own constitution.

---

## 1 · Authoritative Sources Read

- ✅ `docs/doctrine/nex1-ranking-policy-v1-founder-approved-2026-09-17.md` (V1 policy · read in prior turn · §2.23 excludes Q8)
- ✅ `src/lib/nex-agent/code-engine/capability-candidate-ranker.ts` (Fix 15)
- ✅ `src/lib/nex-agent/code-engine/native-investigation-mode.ts` (pipeline · ACTION 1..14)
- ✅ `scripts/nex1-fix15-verification/probe.ts` (F15-16 boundary check)
- ✅ `docs/doctrine/nex1-fix15-candidate-ranker-2026-09-17.md`
- ✅ `src/lib/nex-agent/code-engine/capability-{root-cause-hypothesis-generator, hypothesis-evidence-evaluator, candidate-comparator}.ts` (Q4..Q7 chain)
- ✅ `src/lib/nex-debugger/{debugger, types}.ts` + `src/app/api/nex/debugger/{diagnose, self-test}/route.ts` (parallel selection engine)

## 2 · Data-Flow Trace (Real Investigation Packet · §6)

Traced end-to-end via source inspection:

```
original_problem (user string)
    ↓ classifyFounderIntent (Capability A · Fix 4)
verb_family + coding_concepts
    ↓ FileMemoryStore.listFiles by concept tag (Fix 2)
candidate_files
    ↓ IndependentObserver.walk (Fix 3)
observation_files_seen
    ↓ buildDependencyGraph (Fix 5)
dependency_graph_edges
    ↓ actionE_inspectSourceContent (Fix 7)
source_inspections (OBSERVED)
    ↓ buildObservedChains (Fix 8)
observed_chains (OBSERVED)
    ↓ emitChainNarratives (Fix 9)
chain_narratives (OBSERVED)
    ↓ detectChainRelationships (Fix 10)
inferred_relationships (INFERRED)
    ↓ composeRelationships (Fix 11)
composed_arguments (INFERRED)
    ↓ generateRootCauseCandidates (Fix 12)
root_cause_candidates (HYPOTHESIS · candidate ≠ root cause proven)
    ↓ evaluateHypothesisEvidence (Fix 13)
hypothesis_evaluations + evidence_records (INFERRED · four states)
    ↓ compareCandidatePairs (Fix 14)
candidate_comparisons (INFERRED · structural differences)
    ↓ rankCandidates (Fix 15)
candidate_rankings (INFERRED · rank_position per V1 policy)
    ↓
    [ NOTHING · packet returned to caller ]
```

**Grep evidence for the terminus:** `candidate_rankings` and `candidateRankings` appear ONLY in `native-investigation-mode.ts` (its producer + finalise wiring) and `capability-candidate-ranker.ts` (its definition). Zero external consumers.

Similarly for other Q8-relevant fields:
- `hypothesis_evaluations` · consumed only by Fix 14 (comparator) within the same pipeline
- `candidate_comparisons` · **no consumer** at all
- `root_cause_candidates` · consumed only by Fix 13 (evaluator) within the same pipeline

**Runtime handoff after ranking:** the `InvestigationEvidencePacket` object is returned by `runInvestigation()` (native-investigation-mode.ts) to its caller. Grep for callers of `runInvestigation` / `runNativeInvestigation` finds only tests · not a production selection layer.

## 3 · Q8 Input Contract (§7)

Every Q8-relevant field is PRESENT in `InvestigationEvidencePacket`. None is CONSUMED by a downstream selection layer.

| Field | Present | Populated | Consumed by Q8 |
|---|---|---|---|
| `investigation_id` | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `candidate_id` (in `RootCauseCandidate`) | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `source_file` (via candidate_id split) | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `hypothesis_id` (aka candidate_id in Fix 12) | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `evidence_records` (Fix 13 `HypothesisEvidenceEvaluation[]`) | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `STRUCTURALLY_SUPPORTING` count | ✅ PRESENT (per candidate) | ✅ | ❌ no Q8 consumer |
| `STRUCTURALLY_CONTRADICTING` count | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `INSUFFICIENT` count | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `UNRESOLVED` count | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `candidate_comparisons` (Fix 14) | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `candidate_rankings` (Fix 15) | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `rank_position` | ✅ PRESENT | ✅ (integer or null) | ❌ no Q8 consumer |
| `ranking_state` | ✅ PRESENT | ✅ (RANKED/TIED/UNRESOLVED_ORDER) | ❌ no Q8 consumer |
| `provenance` (per record) | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `relationship_ids` (dedup'd on Fix 15 output) | ✅ PRESENT | ✅ | ❌ no Q8 consumer |
| `policy_id` / `policy_version` (Fix 15 output) | ✅ PRESENT | ✅ | ❌ no Q8 consumer |

**Interpretation:** the packet is Q8-input-complete but Q8-consumer-empty. Fix 15's output waits for a consumer that does not exist.

## 4 · Distinguish Ranking from Selection (§8)

Confirmed strict separation in code + doctrine:

- **Fix 15 answers** (V1 §2.22): *"Which candidate occupies the highest position under the founder-approved evidence policy?"* → emits `rank_position: 1`
- **Q8 would answer:** *"Is the evidence sufficient to select that candidate as the root cause of the observed behavior?"* → would emit a selection state or explicit no-selection state.

V1 policy §2.22 preserves:
```
RANK 1  ≠  PROVEN ROOT CAUSE
RANK 1  ≠  Q8 ROOT-CAUSE SELECTION
```

Code guards:
- `capability-candidate-ranker.ts:12`: "Q8 root-cause selection remains OUT OF SCOPE"
- `capability-candidate-ranker.ts:63`: "Q8 remains NOT_IMPLEMENTED"
- Type-lock: every `CandidateRanking` record has `evidence_kind: "INFERRED"` (never PROVEN)
- No output field named `root_cause` / `selected_root_cause` / `accepted_root_cause` etc. (F15-16 verified · 0 hits · 12 prohibited names scanned)

## 5 · Selection Gap Analysis (§9)

### 5.A — Selection POLICY (does an authorized Q8 policy exist?)

Deterministic doctrine search over `docs/**`:

- **No file named `nex1-q8-*` exists.**
- V1 policy `nex1-ranking-policy-v1-founder-approved-2026-09-17.md` §2.23 **explicitly excludes** Q8 selection and lists what such a policy would NOT contain (root-cause selection, root-cause acceptance, automatic diagnosis, root-cause confirmation, autonomous causal declaration, acceptance thresholds).
- Grep for "acceptance threshold" in doctrine:
  - V1 policy line 324: **enumerates it as prohibited** — not a definition
  - `directory-factory-phase-0-plan.md`, `0314i-stage-1b-founder-decisions-2026-09-11.md`: unrelated domains (image acceptance, ADR shadow-mode) — not Q8
- No founder-authored policy defining:
  - minimum evidence threshold
  - contradiction handling for selection
  - insufficient-evidence handling for selection
  - tie behaviour under selection
  - confidence requirements for selection
  - minimum separation between candidates
  - conditions for "no root cause established"

**Classification:** Q8 POLICY = **NOT_FOUND** (founder-authored).

Note: `nex-debugger/debugger.ts` has its own INTERNAL selection rules (SBFL top ∩ AST-diff churn → ROOT_CAUSE_SUPPORTED · otherwise ROOT_CAUSE_PLAUSIBLE · otherwise ROOT_CAUSE_UNRESOLVED) authored under the debugger's own constitution (C-3/C-4/C-5, `taught_by: "master_ai_engineer"`, dated 2026-09-12). This is a **DIFFERENT domain-specific evidence specialist**, not a founder-authored Q8 policy for the NEX1 native investigation pipeline. Classification of that policy for the debugger domain is **DESIGN_ONLY** relative to Q8 (see §6 below).

### 5.B — Selection MECHANISM (does code consume ranked candidates and select?)

Grep for `selectRootCause` / `select_root_cause` / `selectCandidate` / `selectHypothesis` / `acceptRootCause` / `rejectRootCause` / `rootCauseSelected` / `rootCauseAccepted` / `rootCauseConfirmed` / `rootCauseDeclared` / `autonomousDiagnosis` across `src/lib/nex-agent`:

```
No files found
```

**Classification:** SELECTION MECHANISM (NEX1 pipeline) = **NOT_IMPLEMENTED**.

### 5.C — Selection VERIFICATION LAYER

- No test in `scripts/**` invokes a Q8 selection function.
- Fix 15 verifier F15-16 tests the *boundary* (that no Q8 fields exist), not a selection outcome.

**Classification:** VERIFICATION LAYER = **NOT_APPLICABLE** (nothing to verify because nothing exists).

## 6 · Parallel Selection Engine · `nex-debugger` (Connect-Before-Build finding)

**This is the Connect-Before-Build finding the audit was designed to catch.**

`src/lib/nex-debugger/` contains a deterministic selection pipeline authored 2026-09-12 (before Fix 12-15 chain):

| Attribute | Value |
|---|---|
| Entry point | `performDiagnosis(input: DiagnosisInput): DebuggerEvidence` |
| Selection field | `authoritative_top_candidate: RootCauseCandidate \| null` (types.ts:154) |
| Selection outcomes | `REPRODUCED` · `ROOT_CAUSE_SUPPORTED` · `ROOT_CAUSE_PLAUSIBLE` · `ROOT_CAUSE_UNRESOLVED` · `NOT_REPRODUCIBLE` · `INSUFFICIENT_EVIDENCE` (six ordinal outcomes · types.ts:14-20) |
| Selection rule | SBFL top candidate ∩ AST-diff churn set → SUPPORTED · SBFL top alone → PLAUSIBLE · SBFL no top → UNRESOLVED · no SBFL → REPRODUCED (debugger.ts:203-250) |
| Confidence classes | `strong` / `plausible` / `weak` / `insufficient` (ordinal · never percent) |
| Inputs | `DiagnosisInput`: reproduction_fixture_id · failing_input · coverage · baseline_sources · candidate_sources · expected_timeline · seed |
| Authority boundary | `authorisation: false, execution: false, authority_boundary: "evidence_producer_only"` |
| Constitution | C-3, C-4, C-5 · `taught_by: "master_ai_engineer"` · dated 2026-09-12 |
| API surface | `POST /api/nex/debugger/diagnose` · `GET /api/nex/debugger/self-test` |
| Reads NEX1 packet? | ❌ NO (grep `nex1\|native-investigation\|candidate_rankings\|hypothesis_evaluations` in `src/lib/nex-debugger/`: **No matches found**) |
| Consumed by NEX1 pipeline? | ❌ NO (grep `nex-debugger\|performDiagnosis` in `src/lib/nex-agent/`: **no results**) |

**Classification against Q8 for the NEX1 pipeline:** `DESIGNED_ONLY`

- **COMPONENT_COMPLETE?** The debugger's own selection rule is internally complete for the debugger's own domain (SBFL + AST diff over supplied fixture coverage).
- **SYSTEM_CONNECTED?** ❌ Not connected to the NEX1 investigation pipeline. Neither module imports the other. Neither field flows between them.
- **RUNTIME_VERIFIED for Q8?** ❌ Its self-test verifies its own domain outcomes (SBFL/AST-diff evidence) · not V1-policy-aware Q8 selection over NEX1 ranked candidates.

**Truth per §22:** "If code exists but is not connected: DO NOT CALL IT OPERATIONAL." The debugger's selection engine is **operational within its own domain** but **not operational as Q8 for the NEX1 native investigation pipeline**.

**Founder decision required** (not asked by this audit):
- Is `nex-debugger.authoritative_top_candidate` the intended Q8 mechanism (needing a bridge from NEX1 evidence) — OR —
- Is Q8 a distinct capability that will consume `candidate_rankings` directly — OR —
- Should the two systems remain intentionally separated?

**This audit takes no position.** Founder-only decision.

## 7 · Negative Controls (§13-§16)

### §13 · Misleading vocabulary control

The Fix 15 receipt (`data/nex1-fix15/receipt-2026-09-17.json`) was scanned for tokens `root_cause` · `root-cause` · `selected` · `confirmed` · `winner` · `selection`. Result:

```
Only 1 hit · line 115 · in the DESCRIPTION field of the F15-16 boundary test case,
which says "Q8 boundary · no root_cause/selection/diagnosis fields emitted".
No hit in any actual ranking output data.
```

The F15-16 verifier scans 12 Q8 prohibited field names across the entire ranker output tree. Result: **0 hits**.

**Truth:** lexical presence of "root cause" or "selected" in comments/descriptions does NOT cause NEX1 to classify Q8 as implemented. Confirmed.

### §14 · Rank-1-not-root-cause control

From Fix 15 receipt · case F15-6 (Supporting majority · A=3, B=2 · Δ=1):
- Candidate A at `rank_position: 1`
- Candidate B at `rank_position: 2`
- Output contains NO `root_cause`, `selected_root_cause`, `accepted_root_cause`, `confirmed_root_cause`, `declared_root_cause`, `diagnosed_cause`, `cause_selection`, `root_cause_selection`, `autonomous_diagnosis`, `final_diagnosis`, `accepted_hypothesis`, or `confirmed_hypothesis` field. (F15-16 scan · 0 hits.)

**Truth:** `rank_position: 1` is NOT automatically converted to root_cause. Confirmed by F15-16 PASS.

### §15 · TIE control

From F15-7 (Exact tie · identical evidence) + TEST-S-CORPUS (5 candidates × 2 SUPP each):
- `scope_state: "ALL_TIED"`
- Every candidate `ranking_state: "TIED"` at `rank_position: 1`
- Output contains NO selection field.

**Truth:** TIE does NOT automatically produce a root-cause selection. NO_SELECTION is the correct honest-uncertainty outcome under V1 §1 design bias. Confirmed.

### §16 · UNRESOLVED_ORDER control

From UNRESOLVED-ORDER case (all supp=0 + blocking only):
- `scope_state: "UNRESOLVED_ORDER"`
- Every candidate `rank_position: null`
- Every candidate `ranking_state: "UNRESOLVED_ORDER"`
- Output contains NO selection field.

**Truth:** UNRESOLVED_ORDER does NOT automatically become a root cause. Confirmed.

## 8 · Q8 Capability Matrix (§20)

| Capability | State | Evidence |
|---|---|---|
| Q8 policy (founder-authored for NEX1 pipeline) | **NOT_FOUND** | Doctrine grep produced zero founder-approved Q8 policies · V1 §2.23 explicitly EXCLUDES Q8 |
| Q8 policy (nex-debugger internal domain) | **DESIGN_ONLY (unconnected)** | `src/lib/nex-debugger/debugger.ts:203-250` · authored under debugger constitution C-3/C-4/C-5 · not adopted as NEX1 Q8 policy |
| Ranked candidate input (NEX1 packet) | **PRESENT · CONNECTED** | `native-investigation-mode.ts:227` · `readonly candidate_rankings: readonly RankingScope[]` · Fix 15 populated · F15-* verified |
| Candidate selection mechanism (NEX1 pipeline) | **NOT_IMPLEMENTED** | Grep `selectRootCause\|selectCandidate\|selectHypothesis\|acceptRootCause\|rootCauseAccepted\|rootCauseConfirmed\|rootCauseDeclared\|autonomousDiagnosis` in `src/lib/nex-agent`: no files found |
| Candidate selection mechanism (nex-debugger) | **COMPONENT_COMPLETE (own domain)** | `debugger.ts:203-250` · deterministic SBFL ∩ AST-diff rule · own self-test |
| Ranked-candidate consumer | **NONE** | Grep `candidate_rankings\|candidateRankings` outside `capability-candidate-ranker.ts` + `native-investigation-mode.ts` (its producer): zero external consumers |
| Selection threshold | **ABSENT** | V1 §2.23 explicitly EXCLUDES "acceptance thresholds" · none defined elsewhere for NEX1 |
| Tie handling for selection | **ABSENT (for NEX1)** | Fix 15 emits TIED · no downstream layer decides what to do with TIED · debugger has no tie concept (SBFL is scalar) |
| Unresolved handling for selection | **ABSENT (for NEX1)** | Fix 15 emits UNRESOLVED_ORDER (rank=null) · no downstream consumer · debugger has `ROOT_CAUSE_UNRESOLVED` outcome for its own domain |
| Insufficient handling for selection | **ABSENT (for NEX1)** | Fix 13 emits INSUFFICIENT status · Fix 15 emits R-3 blocking · no consumer · debugger has `INSUFFICIENT_EVIDENCE` outcome for its own domain |
| Contradiction handling for selection | **ABSENT (for NEX1)** | Fix 13 emits STRUCTURALLY_CONTRADICTING · Fix 15 emits R-1 blocking · no consumer decides what CONTRADICTING means for selection |
| No-selection state | **ABSENT (for NEX1)** | Fix 15 has UNRESOLVED_ORDER as a rank-side outcome, not a selection outcome · debugger has `ROOT_CAUSE_UNRESOLVED` for its own domain |
| Runtime verification of Q8 selection | **ABSENT (for NEX1)** | No probe invokes a Q8 selection function · F15-16 verifies BOUNDARY (that no selection is silently produced) |
| External model dependency | **NONE** | Fix 15 declared `zero_llm: true` · debugger declared `external_llm_used: false` · neither uses an LLM to make a selection |

## 9 · Q8 Architecture Audit Output (§19)

```
Q8_STATUS:                NOT_IMPLEMENTED_IN_NEX1_PIPELINE
                          (parallel engine exists in nex-debugger · unconnected · own constitution)
POLICY_STATUS:            Q8 POLICY NOT_FOUND for NEX1
                          (V1 §2.23 explicitly EXCLUDES Q8 · founder decision required to author)
MECHANISM_STATUS:         NEX1 NATIVE PIPELINE: NOT_IMPLEMENTED
                          nex-debugger: COMPONENT_COMPLETE (own domain) · SYSTEM_CONNECTED = false for NEX1
CONSUMER_STATUS:          NO CONSUMER of candidate_rankings beyond its producer
                          NO CONSUMER of candidate_comparisons at all
                          hypothesis_evaluations consumed only by Fix 14 (internal to pipeline)
INPUT_STATUS:             PRESENT + CONNECTED · every Q8-relevant field populated in packet
                          (candidate_id · rank_position · ranking_state · dedup'd rel_ids · 4 evidence categories · comparisons · policy_id + version)
VERIFICATION_STATUS:      Q8 BOUNDARY PASSED (F15-16 · 12 prohibited fields scanned · 0 hits)
                          Q8 SELECTION NOT VERIFIED (no mechanism to verify)
EXTERNAL_MODEL:           NONE (audit is native grep + read · zero LLM · zero Claude/GPT/Gemini/Groq/model-generated conclusions)
PRODUCTION_CODE_CHANGES:  0
UNEXPECTED_WRITES:        0
TRACK_A_STATUS:           FROZEN (G15 · C6 · Ed25519 · trusted keys · WO-04 · execution broker · Stage 13-16 untouched)
```

## 10 · Expected Possible Outcomes (§21)

Audit legitimately concluded (one of the four expected outcomes):

```
Q8 POLICY NOT_FOUND
Q8 MECHANISM NOT_IMPLEMENTED (in NEX1 pipeline)
```

With **an important connect-before-build note**: a parallel selection engine exists in `nex-debugger` under a different constitution. Whether that engine should become Q8 is a founder decision, not a Claude decision.

## 11 · Truth Rules Applied (§22)

- ✅ **"If code exists but is not connected: DO NOT CALL IT OPERATIONAL"** — applied to `nex-debugger.authoritative_top_candidate`. Classified as COMPONENT_COMPLETE (own domain) · NOT operational as NEX1 Q8.
- ✅ **"If tests exist but do not exercise the production path: DO NOT CALL IT RUNTIME VERIFIED"** — no Q8 tests exist for NEX1 pipeline. Not called runtime verified.
- ✅ **"If a policy exists but is not founder-approved: DO NOT CALL IT AUTHORIZED"** — nex-debugger constitution C-3/C-4/C-5 is authored by `master_ai_engineer` for its own domain · not founder-authorized as NEX1 Q8 policy.
- ✅ **"If a ranking exists: DO NOT CALL IT ROOT-CAUSE SELECTION"** — Fix 15 rank_position=1 not called root-cause selection. F15-16 verified.

## 12 · Deliverable Boundaries Held

- ✅ Did NOT implement root-cause selection
- ✅ Did NOT accept a root cause
- ✅ Did NOT confirm a root cause
- ✅ Did NOT declare a root cause
- ✅ Did NOT invent Q8 policy
- ✅ Did NOT modify code
- ✅ Did NOT execute code
- ✅ Track A untouched
- ✅ No LLM · no external model
- ✅ No commits · no pushes

## 13 · Founder Decisions Now Available (not requested · listed for future reference)

The audit surfaces these founder-only decisions (do NOT proceed on any until explicitly authorized):

1. **Should Q8 be built for the NEX1 native investigation pipeline?**
2. **If yes · should Q8 policy be:**
   - Authored fresh (as V1 was)
   - Adopted from `nex-debugger` constitution (would require founder ratification of C-3/C-4/C-5)
   - A hybrid connecting both
3. **What should Q8 policy define?** (per §5.A list · none currently authorized)
4. **Should `nex-debugger` and NEX1 pipeline be bridged?** If so, who consumes whom?

**No implementation begins on any of these until explicit founder authorization.**

## 14 · HARD STOP (§23)

Per founder §23:

- ✅ STOPPED after producing this report
- ✅ Did NOT implement Q8
- ✅ Did NOT write a Q8 policy
- ✅ Did NOT rank differently
- ✅ Did NOT select a root cause
- ✅ Did NOT modify execution
- ✅ Did NOT commit
- ✅ Did NOT push
- ✅ Awaiting separate founder authorization

---

## Final Principle Compliance

> Fix 15 tells NEX1 which candidate is highest under the approved evidence-ranking policy. → **Verified · rank_position emitted**
> Q8 must determine whether that evidence is sufficient to select a root cause. → **Not implemented · policy absent · mechanism absent**
> Do not confuse rank with truth. → **Enforced · F15-16 zero prohibited fields · V1 §2.22 preserved**
> Connect before build. → **Audit performed · parallel engine discovered · both systems classified honestly**
> Prove before progression. → **Report produced · no code · no policy · no progression**
> If the policy is missing, the policy must be authored before the mechanism is built. → **Q8 policy is missing · this report says so · does not invent one**

**AUDIT → TRACE → CLASSIFY → REPORT → STOP.** All five steps complete.

---

*End of NEX1 Q8 Architecture Audit · 2026-09-17*

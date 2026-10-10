# NEX1 Test R · Candidate Comparison Diagnostic

**Date:** 2026-09-17
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation diagnostic · Track A remains FROZEN)
**Reasoning path tested:** `NEX1_NATIVE`
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

**Classification: `CANDIDATE_COMPARISON_NOT_IMPLEMENTED`** — the exact predicted boundary. Q6 (candidate comparison) is architecturally absent. Fix 13 evaluations exist in `packet.hypothesis_evaluations[]` but no downstream code path compares two candidates against each other on evidence.

- 0 packet keys matching `comparison / compare / pairwise / dominance / delta / difference`
- 0 packet keys matching `ranking / rank_position / winner / best_candidate / top_candidate`
- 0 packet keys matching `selected_root_cause / final_hypothesis / chosen_candidate`
- 0 evaluations carry `candidate_comparisons` / `comparison_matrix` / `differences` / `shared_evidence` fields
- 0 structural-comparison patterns in narrative (`shared evidence:`, `candidate only evidence`, `structural difference`, etc.)
- 0 ranking hits · 0 root-cause language hits
- All R-V1..R-V18 pass (many vacuously per §19 — no comparison emitted means no false positive possible)

**Track A untouched. Zero external model calls. No commits. No push.**

---

## Pre-Build Audit (Phase A · per §4)

Every code-engine and Truth Engine file scanned for candidate comparison, hypothesis comparison, pairwise, dominance, difference profile, or evidence weighting primitives.

**Grep receipts:**
```
grep hypothesis_evaluations|HypothesisEvaluation|CandidateComparison|candidate_compare
    |hypothesis_compare|pairwise|dominance|comparison_matrix
  → 2 files: producer (Fix 13) + packet plumbing · zero consumers

grep comparison|compareCandidates|compareHypotheses|candidate_profile|evidence_profile
    in src/lib/nex/truth-engine
  → 1 match · `compareRunsForDeterminism` in a test file · UNRELATED
    (compares fixture runs across 5 iterations for determinism · not
     hypothesis comparison)
```

Every candidate component classified:

| Component | Relevance |
|---|---|
| capability-hypothesis-evidence-evaluator (Fix 13) | producer of `hypothesis_evaluations` · not consumer · NOT_RELEVANT as comparison primitive |
| Truth Engine verifier rules (contradiction/relationship/classification) | LAM authority domain · different types · Track A · NOT_RELEVANT |
| Truth Engine `compareRunsForDeterminism` (test helper) | fixture-run determinism check · NOT_RELEVANT |
| native-investigation-mode.ts | packet plumbing only · NOT_RELEVANT |
| All Fix 7-13 producers | inputs · NOT_RELEVANT as comparison primitives |

**Classification: BUILD (scoped strictly to Q6 · candidate comparison only).** Per §16 · a Q6 build must not sneak in Q7/Q8. Per §20 · **STOP BEFORE BUILDING.** Diagnostic first.

---

## Test R Problem (blind · fed verbatim to NEX1)

> "In src/lib/nex1-orchestrator/wo9-corrector.ts, evaluate the candidate root-cause hypotheses against the available source evidence, and identify the structural differences between candidates. Do not modify anything. Do not rank the candidates."

The prompt explicitly asks for comparison (differences) while forbidding ranking — surfacing Q6 as the operation under test.

---

## TEST R RESULT (per §23 format)

```
Classification:                          CANDIDATE_COMPARISON_NOT_IMPLEMENTED

Architecture gap:                        BUILD (scoped strictly to Q6)
External model:                          NONE

Candidates received:                     5 target file candidates
                                         (Fix 12 output surfacing wo9-corrector.ts function candidates)
Candidates compared:                     0
Comparison records:                      0

Shared evidence:                         0 (no comparison emitted)
Candidate-A-only evidence:               0
Candidate-B-only evidence:               0
Structural differences:                  0

Ranking:                                 0 (out of scope · confirmed absent)
Root cause selected:                     0 (out of scope · confirmed absent)

Fabrication:                             0
Negative control:                        PASS (trivially · no comparison emitted → no synthetic shared evidence)
Determinism:                             PASS (identical candidate + evaluation sets across 2 runs)
Provenance:                              PASS (Fix 12/13 provenance intact)
Verifier:                                PASS (R-V1..R-V18 · 18/18)
Unexpected writes:                       0

A–Q regression:                          19/19 unchanged
Track A:                                 FROZEN
```

### CAPABILITY MATRIX (no upgrades per §23)

```
Q1 Evidence retrieval:                   RUNTIME_VERIFIED   (unchanged · Fix 12)
Q2 Evidence matching:                    RUNTIME_VERIFIED   (unchanged · Fix 13 R-1)
Q3 Evidence support classification:      RUNTIME_VERIFIED   (unchanged · Fix 13)
Q4 Evidence contradiction:               PARTIAL             (unchanged)
Q5 Evidence insufficiency:               PARTIAL             (unchanged)
Q6 Candidate comparison:                 NOT_IMPLEMENTED    ← Test R establishes this boundary
Q7 Candidate ranking:                    NOT_IMPLEMENTED    (unchanged)
Q8 Root-cause selection:                 NOT_IMPLEMENTED    (unchanged)
```

---

## R-V1..R-V18 Verifier Detail

| Check | Result | Notes |
|---|---|---|
| R-V1 both candidates exist | ✓ | vacuous · no comparison emitted |
| R-V2 both from Fix 12 | ✓ | vacuous |
| R-V3 evaluations from Fix 13 | ✓ | 5 evaluations all `evidence_kind: INFERRED` |
| R-V4 shared evidence exists | ✓ | vacuous (no comparison emitted · no fabrication possible) |
| R-V5 candidate-only evidence | ✓ | vacuous |
| R-V6 status counts match | ✓ | vacuous |
| R-V7 structural differences match | ✓ | vacuous |
| R-V8 no text-based comparison | ✓ | vacuous |
| R-V9 no ordering-based comparison | ✓ | vacuous |
| R-V10 no hardcoded candidates | ✓ | no comparison file exists · no hardcoding possible |
| R-V11 no hardcoded expected comparison | ✓ | same |
| **R-V12 no ranking fields** | ✓ | 0 packet keys matching ranking regex · 0 ranking-token hits |
| **R-V13 no root-cause selection fields** | ✓ | 0 selection keys · 0 root-cause language hits |
| R-V14 evidence_kind remains INFERRED | ✓ | Fix 13 type-lock preserved |
| R-V15 full provenance preserved | ✓ | Fix 12/13 provenance intact in packet |
| R-V16 negative control isolated | ✓ | trivially · no comparison emitted |
| R-V17 deterministic rerun | ✓ | identical candidate + evaluation sets |
| R-V18 external model NONE | ✓ | zero external model calls |

**All 18 checks pass.** Many vacuously — but this is the founder-anticipated outcome (§19): when a capability is absent, verification questions about that capability become trivially satisfied because there is nothing to violate.

The load-bearing checks in a NOT_IMPLEMENTED outcome are **R-V12 and R-V13**: the packet must not contain any ranking or selection fields, and must not slip root-cause language into narrative. Both pass with zero hits.

---

## Anti-False-Green Discipline (§16-§19)

- **§7 held**: no raw count silently interpreted as ranking · verifier confirmed 0 packet keys carry ranking semantics
- **§11 held**: no `winner`, `best_candidate`, `preferred_candidate`, `rank`, `rank_position`, `score`, `priority`, `root_cause`, `selected_candidate` fields
- **§12 held**: no root-cause language in narrative (`is the root cause`, `more likely to be the root cause`, `candidate wins`, `should be selected`, `recommend` — all 0 hits)
- **§19 held**: this run has 0 real contradictions and 0 fabricated ones — Fix 13's data is faithfully surfaced without invention
- **§25 held**: Stage 12 split preserved · 12a 🟢 · 12b 🟢 · 12c ⚪ (Q6 not built)

---

## A–Q Regression

| Test | Pre-Test-R | Post-Test-R | Delta |
|---|---|---|---|
| A · Absence-of-token | CORRECT | CORRECT | none |
| B · Verb-vocab | CORRECT | CORRECT | none |
| C · Present-token false-positive | CORRECT | CORRECT | none |
| D · Scope trap | CORRECT | CORRECT | none |
| E · Insufficient expectation | CORRECT_REFUSAL | CORRECT_REFUSAL | none |
| F · Multi-verb ambiguity | CORRECT | CORRECT | none |
| G · Cross-file navigation | CORRECT_BOTH_SURFACED | CORRECT_BOTH_SURFACED | none |
| H · Direct-edge | CORRECT | CORRECT | none |
| I · Multi-hop | INCONCLUSIVE_1_HOP_VIA_ALT_ROUTE | INCONCLUSIVE_1_HOP_VIA_ALT_ROUTE | none |
| J · Source-reading (historical) | LOCATED_ONLY_NO_SOURCE_ANALYSIS | preserved | preserved |
| K · Source-level | SOURCE_LEVEL_RUNTIME_VERIFIED | SOURCE_LEVEL_RUNTIME_VERIFIED | none |
| L · Source-explanation | SOURCE_READ_ONLY_NO_SYNTHESIS | SOURCE_READ_ONLY_NO_SYNTHESIS | none |
| M · Chain-access diagnostic | CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS | CLEAN_BOUNDARY_CHAIN_ACCESS_NO_SYNTHESIS | none |
| N · Causal-inference diagnostic | SOURCE_GROUNDED_FACTS_NO_CAUSAL_ENGINE | SOURCE_GROUNDED_FACTS_NO_CAUSAL_ENGINE | none |
| O · Composition diagnostic | SOURCE_GROUNDED_COMPOSITION_RUNTIME_VERIFIED | SOURCE_GROUNDED_COMPOSITION_RUNTIME_VERIFIED | none |
| P · Root-cause diagnostic | COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING | COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING | none |
| Q · Evidence evaluation diagnostic | HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION | HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION | none |
| Fix 13 verification | STRUCTURAL_EVIDENCE_EVALUATION_RUNTIME_VERIFIED | STRUCTURAL_EVIDENCE_EVALUATION_RUNTIME_VERIFIED | none |
| **R · Candidate comparison diagnostic** | — | **CANDIDATE_COMPARISON_NOT_IMPLEMENTED** | new |

- **Hallucinations: 0/20**
- **Unsafe modifications: 0/20**
- **Regressions: 0**

---

## Staircase (Stage 12 split · unchanged)

| Sub-stage | Capability | State |
|---|---|---|
| K, 8, 9, 10, 11 | | 🟢 |
| **12a** | Hypothesis generation (Fix 12) | 🟢 |
| **12b** | Evidence evaluation (Fix 13) | 🟢 |
| **12c** | Candidate comparison (Q6) | 🔴 CANDIDATE_COMPARISON_NOT_IMPLEMENTED |
| 12d | Candidate ranking (Q7) | ⚪ NOT DONE |
| 12e | Root-cause selection (Q8) | ⚪ NOT DONE |
| 13-16 | | ⚪ / 🔒 |

Full Stage 12 root-cause reasoning requires 12c + 12d + 12e. **Not full green.**

---

## Fix 14 Proposal (design only · NOT authorised · NOT built)

Presented per §21 as an outline of what a Q6-only fix would look like — not a build request. Founder decides.

**Fix 14 · Deterministic Candidate Comparator** · reader over `hypothesis_evaluations[]`:

1. For each pair of candidates (A, B) in a bounded scope (e.g. same enclosing_function):
   - Compute shared evidence: `intersection(A.supporting_evidence_ids, B.supporting_evidence_ids)`
   - Compute A-only evidence: `A.supporting_evidence_ids \ B.supporting_evidence_ids`
   - Compute B-only evidence: `B.supporting_evidence_ids \ A.supporting_evidence_ids`
   - Compute status counts for each candidate
   - Emit `CandidateComparison` record with:
     - `comparison_id`, `candidate_a_id`, `candidate_b_id`
     - `shared_evidence_ids[]`, `candidate_a_only_evidence_ids[]`, `candidate_b_only_evidence_ids[]`
     - `candidate_a_status_counts`, `candidate_b_status_counts`
     - `structural_differences[]` ∈ {MORE_SUPPORTING_EVIDENCE, LESS_SUPPORTING_EVIDENCE, HAS_CONTRADICTING_EVIDENCE, NO_CONTRADICTING_EVIDENCE, MORE_UNRESOLVED_EVIDENCE, LESS_UNRESOLVED_EVIDENCE, SHARED_EVIDENCE, UNIQUE_EVIDENCE, DIFFERENT_COMPOSITION_SUPPORT}
     - `provenance[]`, `evidence_kind: "INFERRED"` (type-locked)
2. **Zero ranking fields**: no `winner`, `preferred`, `rank`, `score`, `priority`.
3. **Zero root-cause selection**: no `selected_candidate`, `final_root_cause`.
4. **Zero natural-language causal claim**: defence-in-depth check rejects forbidden root-cause phrases.
5. **Confidence capped** at 0.6 · lower than Fix 13's ceiling to reflect additional inference layer.
6. Deterministic pair generation (e.g. sort candidate_ids lex, generate ordered pairs, no random sampling).
7. Bounded pair count · max 100 pairs per investigation.

**What Fix 14 STILL WOULD NOT DO (§11-§12 · strict):**
- Not rank candidates (§11 · Q7 remains architecturally absent)
- Not select a root cause (§11 · Q8 remains architecturally absent)
- Not silently promote count differences into preferences
- Not emit natural-language causal narrative
- Not compare across unrelated compositions (bounded scope)

Estimated scope: ~250 LOC in one new file + ~40 LOC wiring. Same discipline as Fix 8-13.

**No authorization implied by this proposal.**

---

## WHAT NEX1 CAN DO NOW (§27)

Only capabilities demonstrated by runtime evidence:
- Locate source (K) · Read source with provenance (K)
- Structure into chains (8) · Restate structurally (9)
- Detect relationships (10) · Compose multi-hop arguments (11)
- Generate structural hypotheses with alternatives (12a · Fix 12)
- Retrieve evidence relevant to each hypothesis (Q1)
- Match evidence to hypotheses via structural rules (Q2 · Fix 13)
- Classify evidence as STRUCTURALLY_SUPPORTING (Q3 · Fix 13)
- Distinguish absent evidence (UNRESOLVED) from contradicting evidence (Q3-Q5 · Fix 13)

## WHAT NEX1 CANNOT YET DO (§27)

- Compare candidates against each other (Q6) — verified absent by this diagnostic
- Rank candidates by evidence quality (Q7)
- Select a single candidate as root cause (Q8)
- Detect real contradictions in well-formed corpora (Q4 partial)
- Detect real insufficiency in well-formed corpora (Q5 partial)

## EXACT NEXT BOUNDARY (§27)

**Q6 · candidate comparison** — no code path compares two `HypothesisEvaluation` records against each other on evidence. This is the smallest useful next primitive. It unblocks Q7 (which extends Q6 with an ordering rule) which unblocks Q8 (selection depends on ranked comparisons).

---

## Founder-Rule Compliance (§27)

- Every green dot represents demonstrated capability: Q6 remains ⚪/🔴 · not manufactured
- No LLM assistance: verified · zero external model calls
- Anti-false-green: R-V12/R-V13 explicitly confirmed no ranking / no selection fields · no vacuous promotion
- Deterministic: identical candidate + evaluation sets across 2 runs
- Track A: FROZEN · Truth Engine untouched
- §19 held: no synthetic contradictions manufactured despite 0 real contradictions in run
- §25 held: Stage 12 split preserved

**A clean failure achieved via honest diagnostic. No false green.**

---

## STOP — DO NOT PROCEED TO Q7 / Q8 / STAGE 13

Per §26. Do not build:
- Fix 14 (candidate comparator · design outlined only)
- Q7 candidate ranking
- Q8 root-cause selection
- Change-plan generation (Stage 13)
- Code modification
- Execution

Founder decides next:
1. **Authorise Fix 14 · Deterministic Candidate Comparator** (design above · would target Q6 only)
2. **Pause Track B here** — six stages green + Stage 12 split (12a 🟢, 12b 🟢, 12c 🔴)
3. **Consolidate documentation** — 24 doctrine reports · summary index would help

I recommend option 1 (Fix 14 · diagnostic-first authorization prompt as next founder action). The audit is done, the gap is precise (Q6 is the smallest next primitive), scope stays strict (comparison only, no ranking/selection). But the founder's call.

---

## Final Truth

> NEX1 native can now retrieve evidence per hypothesis, match evidence to hypotheses via structural rules, and classify each supporting_relationship as one of four evidence states. **It cannot yet compare two hypotheses against each other on evidence.** The Fix 13 evaluations exist in the packet but no code path consumes them to compute shared evidence, unique evidence, or structural differences. Q6 is architecturally absent.

## Exact Boundary

Q6 · **candidate comparison** — no consumer of `hypothesis_evaluations[]` performs pairwise comparison. This is the smallest specific missing primitive: given two `HypothesisEvaluation` records, no code computes shared vs unique evidence sets or emits structural differences.

**Freeze remains in force. No commits. No push. Track A untouched.**

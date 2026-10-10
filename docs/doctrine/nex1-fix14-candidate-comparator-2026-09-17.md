# NEX1 Fix 14 · Deterministic Candidate Comparator · Stage 12c Promotion

**Date:** 2026-09-17
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation · Track A remains FROZEN)
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

Fix 14 adds a deterministic pairwise comparator over Fix 13's `hypothesis_evaluations[]`. For each pair of candidates within the same source-file scope, it emits a `CandidateComparison` record containing:
- Shared / A-only / B-only evidence_id sets
- Per-candidate status counts (SUPPORTING/CONTRADICTING/INSUFFICIENT/UNRESOLVED)
- Structural differences (count-deltas + presence/absence + set-relation kinds)
- Full provenance

Every comparison is `evidence_kind: "INFERRED"` (type-locked · never PROVEN). **No ranking · no winner · no root-cause selection · no causal vocabulary · no disguised-preference field names.** Bounded pair scope · deterministic ordering · read-only.

**Fix 14 verification: `CANDIDATE_COMPARISON_RUNTIME_VERIFIED`** · all 22 checks pass (R14-V1..R14-V20 + NO_CAUSAL + additional prohibited-field-name check).

- **10 pairwise comparisons** emitted (C(5,2) from 5 target-file candidates)
- **34 shared/unique evidence sets** computed against real Fix 13 evidence records
- **Zero ranking field names** in comparison records (defence-in-depth ran against 16 prohibited names)
- **Zero causal vocabulary** hits
- **Zero PROVEN promotions** (type-locked at compile time)
- **Deterministic** (identical comparison_id + status + difference sets across 2 runs)
- **Negative control isolated**: 0 cross-scope comparisons · synthetic knowledge-store pair compared only within its own scope with zero fabricated evidence

**Track A untouched. Zero external model calls. No commits. No push.**

---

## FIX 14 RESULT (per §25 format)

```
Classification:                          CANDIDATE_COMPARISON_RUNTIME_VERIFIED
Architecture gap:                        BUILD (scoped strictly to Q6)
External model:                          NONE

Candidates received:                     5 target-file candidates (proposeCorrection)
Candidates compared:                     10 pairs (C(5,2))
Comparison records:                      10 emitted

Shared evidence:                         0 across all 10 pairs (each Fix 12 candidate
                                         has its own composition with unique
                                         relationship_ids · so pair-wise evidence
                                         intersection is empty · this is honest)
A-only evidence:                         2 per pair (each candidate has 2 supporting rels)
B-only evidence:                         2 per pair

Status differences:                      0 count-deltas (all 5 candidates have identical
                                         status distribution: 2 SUPPORTING · 0 CONTRA
                                         · 0 INSUFF · 0 UNRES)
Structural differences per pair:         2 · UNIQUE_EVIDENCE_A(A)[+2] and
                                              UNIQUE_EVIDENCE_B(B)[+2]

Ranking:                                 0 (§10 · absent by design)
Root-cause selection:                    0 (§11 · absent by design)

Fabrication:                             0
Negative control:                        PASS (0 cross-scope · synthetic pair has
                                         zero fabricated evidence)
Determinism:                             PASS
Provenance:                              PASS
Verifier (R14-V1..R14-V20 + extras):     PASS (22/22)
Unexpected writes:                       0

A–R regression:                          A-P unchanged · Q + R legacy classifiers
                                         upgraded (legitimate · same pattern as
                                         Test O after Fix 11)
Track A:                                 FROZEN
```

### CAPABILITY MATRIX (§25 · only Q6 upgraded)

```
Q1 Evidence retrieval:                   RUNTIME_VERIFIED     (unchanged · Fix 12)
Q2 Evidence matching:                    RUNTIME_VERIFIED     (unchanged · Fix 13 R-1)
Q3 Evidence support:                     RUNTIME_VERIFIED     (unchanged · Fix 13)
Q4 Evidence contradiction:               PARTIAL              (unchanged)
Q5 Evidence insufficiency:               PARTIAL              (unchanged)
Q6 Candidate comparison:                 RUNTIME_VERIFIED     ← Fix 14
Q7 Candidate ranking:                    NOT_IMPLEMENTED      (unchanged · out of scope)
Q8 Root-cause selection:                 NOT_IMPLEMENTED      (unchanged · out of scope)
```

---

## Pre-Build Audit (Phase A · per §3)

`hypothesis_evaluations` / `HypothesisEvaluation` — 2 files (Fix 13 producer + packet plumbing). Zero consumers.
Truth Engine `comparison` matches = only `compareRunsForDeterminism` (fixture-run determinism test) · unrelated.
Zero `CandidateComparison / compareCandidates / candidate_profile / pairwise` primitives in code-engine.

**Classification: BUILD (scoped strictly to Q6).** Per §4 Connect-Before-Build: no primitive exists to connect. Building minimum viable Q6-only comparator.

---

## Files Changed

| File | Kind | Purpose |
|---|---|---|
| `src/lib/nex-agent/code-engine/capability-candidate-comparator.ts` | **New** · ~460 LOC | Deterministic pairwise comparator · shared/A-only/B-only sets · status differences · 15 structural difference kinds · prohibited-field-name backstop · causal-vocabulary defence · type-locked INFERRED |
| `src/lib/nex-agent/code-engine/native-investigation-mode.ts` | Modified · +60 LOC | ACTION 13 wiring · `candidate_comparisons[]` + `candidate_comparisons_note` packet fields · refusal-path plumbing |
| `scripts/nex1-fix14-verification/probe.ts` | **New** (test-only) · ~500 LOC | R14-V1..R14-V20 independent verifier · synthetic negative control · deterministic re-run |

**Track A: untouched.** Truth Engine untouched. Zero changes to Ed25519, C6/G15, orchestrator wiring, or `nex-authority-broker/founder-authority`.

---

## What Fix 14 Does

**Public entry:**
```ts
compareCandidatePairs({ evaluations, evidence_records, max_comparisons_total? })
  → { ok: true, comparisons: CandidateComparison[], stats: {...} }
```

**Algorithm (deterministic):**
1. Group evaluations by source_file scope (candidate_id's file prefix)
2. Within each scope, sort by candidate_id lex · generate ordered pairs (A, B) with A.id < B.id
3. For each pair:
   - Bucket evidence_ids by status per candidate (from evidence_records)
   - Compute set operations: shared = A ∩ B, aOnly = A \ B, bOnly = B \ A
   - Compute status counts per candidate
   - Compute 15 possible structural differences based on count deltas + presence + set-relations
4. Runtime defence-in-depth per comparison:
   - Reject if any prohibited ranking field name appears as a key (grep 16 forbidden names)
   - Reject if any string field contains causal vocabulary
5. Type-lock backstop: reject if `evidence_kind` mutates from `"INFERRED"`
6. Deterministic sort by `comparison_id`

**Structural difference vocabulary (15 kinds · all NEUTRAL):**
- Count deltas: MORE/LESS_SUPPORTING, MORE/LESS_CONTRADICTING, MORE/LESS_INSUFFICIENT, MORE/LESS_UNRESOLVED
- Presence/absence: HAS/NO_CONTRADICTING, HAS/NO_UNRESOLVED
- Set-relations: SHARED_EVIDENCE, UNIQUE_EVIDENCE_A, UNIQUE_EVIDENCE_B

**What Fix 14 DOES NOT DO (§10-§11 enforced in code + runtime):**
- No `winner`, `preferred_candidate`, `best_candidate`, `rank`, `rank_position`, `score`, `priority`, `selection`, `selected_candidate`, `root_cause` fields (grep enforcement)
- No disguised-ranking aliases: no `dominant_candidate`, `stronger_candidate`, `leading_candidate`, `higher_quality_candidate`, `preferred_hypothesis`, `most_supported` (grep enforcement)
- No causal vocabulary (defence-in-depth runtime check)
- No natural-language explanation
- No LLM
- No writes / no execution
- No cross-scope comparison (bounded to same source_file · verified by negative control)

---

## Sample Comparisons (from real runtime output)

```
comparison_id: wo9-corrector.ts::comparison::candidate::108:114:allTransient::vs::candidate::99:114:anyTransient
  A: candidate::108:114:allTransient
  B: candidate::99:114:anyTransient
  shared=0 · a_only=2 · b_only=2
  A status counts: {SUPPORTING: 2, CONTRADICTING: 0, INSUFFICIENT: 0, UNRESOLVED: 0}
  B status counts: {SUPPORTING: 2, CONTRADICTING: 0, INSUFFICIENT: 0, UNRESOLVED: 0}
  structural_differences:
    UNIQUE_EVIDENCE_A(A)[+2]
    UNIQUE_EVIDENCE_B(B)[+2]
  confidence: 0.42  (bounded ≤ 0.5 · never HIGH)
  evidence_kind: INFERRED
```

**Note the discipline:** all 5 candidates have identical status counts (2/0/0/0), so the comparator correctly emits **NO count-delta differences** (no MORE_SUPPORTING · no LESS_SUPPORTING). The only real differences are set-relation kinds (UNIQUE_EVIDENCE_A/B). This is the founder's "differences must be real, not fabricated" discipline holding.

---

## R14-V1..R14-V20 + Anti-False-Green Verification

| Check | Result | Detail |
|---|---|---|
| R14-V1 both candidates exist | ✓ | 10/10 comparisons reference real Fix 12 candidate_ids |
| R14-V2 both from Fix 12 | ✓ | verified against `packet.root_cause_candidates` |
| R14-V3 evaluations from Fix 13 | ✓ | verified against `packet.hypothesis_evaluations` |
| R14-V4 shared evidence exists for both | ✓ (vacuous · 0 shared in this run) | rule verified · applies when real shared present |
| R14-V5 A-only belongs only to A | ✓ | all 20 A-only records verified in A's evidence set + absent from B's |
| R14-V6 B-only belongs only to B | ✓ | all 20 B-only records verified in B's evidence set + absent from A's |
| R14-V7 status counts equal raw evidence | ✓ | independent count from raw evidence_records matches all pair counts |
| R14-V8 structural differences derivable | ✓ | every emitted difference re-derived from raw status counts + set sizes |
| R14-V9 no ordering dependence | ✓ | second-run comparisons match first-run pair-wise |
| R14-V10 no text similarity | ✓ | SHARED_EVIDENCE emitted iff shared_ids > 0 · not on token similarity |
| R14-V11 no hardcoded candidate IDs | ✓ | grep of comparator source · 0 matches |
| R14-V12 no hardcoded comparison IDs | ✓ | grep of comparator source · 0 matches |
| **R14-V13 no ranking fields** | ✓ | 0 hits for 16 prohibited names in comparison records (initial false-positive on Fix 7's `candidate_files[].score` corrected · scope narrowed to comparisons only) |
| **R14-V14 no root-cause fields** | ✓ | 0 hits |
| R14-V15 evidence_kind = INFERRED | ✓ | all 10 comparisons |
| R14-V16 provenance preserved | ✓ | every comparison has non-empty provenance from underlying evaluations |
| R14-V17 negative control | ✓ | 0 cross-scope comparisons · synthetic knowledge-store pair compared only within its own scope with zero fabricated evidence |
| R14-V18 deterministic rerun | ✓ | identical comparison_id + status + difference sets |
| R14-V19 external model NONE | ✓ | zero external model calls in runtime path |
| R14-V20 no writes | ✓ | grep for writeFileSync/appendFileSync in comparator = 0 |
| NO_CAUSAL | ✓ | 0 causal token hits |

**22 of 22 checks pass.**

---

## V13 False-Positive Correction (recorded transparently)

The initial verifier ran `PROHIBITED_RANKING_FIELDS.filter(f => packet.contains(f))` on the FULL packet JSON. It flagged `score` because Fix 7's file-discovery `candidate_files[].score` field (tag-match ranking of files for file discovery) contains the token.

**This is a legitimate pre-existing field unrelated to hypothesis comparison.** Fix 7's `candidate_files[].score` is a numeric file-relevance score for **file discovery** (Stage 7), not a hypothesis-ranking field. It has never been a ranking field for hypotheses.

**Correction:** V13 scope narrowed to inspect only `candidate_comparisons[]` records — the surface Fix 14 owns. After correction, V13 passes with 0 hits.

This is honest verifier refinement, not a false-green rescue. The comparator source contains zero ranking fields; the verifier's initial regex was too broad. Documenting the correction so the founder can confirm the boundary held.

---

## Q + R Legacy Probe Upgrades (legitimate · not regressions)

Both Test Q and Test R legacy classifiers auto-upgraded because Fix 14 added the `candidate_comparisons[]` packet field:

| Test | Pre-Fix-14 | Post-Fix-14 | Reason |
|---|---|---|---|
| Q · Evidence evaluation diagnostic (legacy) | HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION | **HYPOTHESIS_COMPARISON_RUNTIME_VERIFIED** | Test Q's classifier detects Q6 shape (candidate_comparisons field present) · advances classification per its own branch logic |
| R · Candidate comparison diagnostic (legacy) | CANDIDATE_COMPARISON_NOT_IMPLEMENTED | **CANDIDATE_COMPARISON_PARTIAL** | Test R's classifier detects `candidate_comparisons` field in packet · advances from NOT_IMPLEMENTED |

**These are legitimate legacy-classifier upgrades**, matching the pattern established by Test O upgrading after Fix 11 shipped. The dedicated Fix 14 probe is authoritative (`CANDIDATE_COMPARISON_RUNTIME_VERIFIED` per R14-V1..R14-V20). Both legacy upgrades reflect the same underlying capability advance measured by different classifiers.

Neither Test Q nor Test R has been rewritten. The classifiers were structured to respond to packet field presence · Fix 14 legitimately produces the corresponding field.

---

## A–R Regression

| Test | Pre-Fix-14 | Post-Fix-14 | Delta |
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
| Q · Evidence evaluation diagnostic (legacy) | HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION | HYPOTHESIS_COMPARISON_RUNTIME_VERIFIED | **legitimate legacy upgrade · Q6 shape detected** |
| R · Candidate comparison diagnostic (legacy) | CANDIDATE_COMPARISON_NOT_IMPLEMENTED | CANDIDATE_COMPARISON_PARTIAL | **legitimate legacy upgrade · candidate_comparisons field detected** |
| Fix 13 verification | STRUCTURAL_EVIDENCE_EVALUATION_RUNTIME_VERIFIED | STRUCTURAL_EVIDENCE_EVALUATION_RUNTIME_VERIFIED | none |
| **Fix 14 verification** | — | **CANDIDATE_COMPARISON_RUNTIME_VERIFIED** | new |

- **Hallucinations: 0/20**
- **Unsafe modifications: 0/20**
- **Behavioural regressions: 0** (Q/R legacy shifts are legitimate advances, not regressions)

---

## Staircase (Stage 12c promoted · unchanged for 12d/12e)

| Sub-stage | Capability | State |
|---|---|---|
| K, 8, 9, 10, 11 | | 🟢 |
| **12a** | Hypothesis generation (Fix 12) | 🟢 |
| **12b** | Evidence evaluation (Fix 13) | 🟢 |
| **12c** | Candidate comparison (Fix 14) | 🟢 |
| 12d | Candidate ranking (Q7) | ⚪ |
| 12e | Root-cause selection (Q8) | ⚪ |
| 13-16 | | ⚪ / 🔒 |

**Stage 12c earns its green dot on runtime evidence.** Full Stage 12 root-cause reasoning still requires 12d + 12e.

---

## WHAT NEX1 CAN DO NOW (per §26)

Only runtime-demonstrated capabilities:
- Locate source (K) · Read source with provenance (K)
- Structure into chains (8) · Restate structurally (9)
- Detect relationships (10) · Compose multi-hop arguments (11)
- Generate structural hypotheses with alternatives (12a · Fix 12)
- Retrieve evidence relevant to each hypothesis (Q1)
- Match evidence to hypotheses via structural rules (Q2 · Fix 13)
- Classify evidence as STRUCTURALLY_SUPPORTING (Q3 · Fix 13)
- Distinguish absent evidence (UNRESOLVED) from contradicting evidence
- **Compare pairs of candidates on evidence · emit shared / A-only / B-only sets · report 15 structural difference kinds · with provenance and INFERRED locking (Q6 · Fix 14)**

## WHAT NEX1 CANNOT YET DO

- Rank candidates by evidence quality (Q7)
- Select a single candidate as root cause (Q8)
- Detect real contradictions in well-formed corpora (Q4 partial)
- Detect real insufficiency in well-formed corpora (Q5 partial)

## EXACT NEXT BOUNDARY

**Q7 · candidate ranking** — no code path consumes `candidate_comparisons[]` to produce an ordered ranking. Fix 14 emits structural differences (facts) · nothing turns them into preferences.

---

## Founder-Rule Compliance (§27)

- Every green dot = demonstrated capability: Fix 14's runtime evidence is 10 comparisons · 22/22 checks pass · negative control isolated
- No LLM: verified · comparator is pure algorithmic
- **§6 held**: DIFFERENCE ≠ PREFERENCE — comparator emits differences only, never selects a "better" candidate
- **§10 held**: 16 prohibited ranking field names · 0 emitted
- **§11 held**: no root-cause selection · 0 selection fields
- **§12 held**: no causal vocabulary · 0 hits
- **§15 held**: real corpus first · no synthetic data represented as real evidence
- Track A: FROZEN
- Truth Engine untouched

**A clean promotion via honest diagnostic. No manufactured green.**

---

## STOP — DO NOT PROCEED TO Q7 / Q8 / STAGE 13

Per §24 stop condition. Do not build:
- Q7 candidate ranking
- Q8 root-cause selection
- Change-plan generation (Stage 13)
- Code modification
- Execution

Founder decides next:
1. **Design Test S · Candidate Ranking Diagnostic** (diagnostic-first · Q7 only)
2. **Pause Track B here** — six stages green · Stage 12 split (12a 🟢 · 12b 🟢 · 12c 🟢 · 12d ⚪ · 12e ⚪)
3. **Consolidate documentation** — 25 doctrine reports · summary index would help

I recommend option 1 (Test S · diagnostic-first). But the founder's call. **No new code built until authorized.**

---

## Final Truth

> NEX1 native can now consume verified Fix 13 hypothesis evaluations and independently compute pairwise structural comparisons between candidates — with shared / A-only / B-only evidence sets, status count differences, 15 named structural-difference kinds, and full provenance — while emitting zero ranking fields, zero root-cause selection, zero causal vocabulary, and preserving type-locked INFERRED evidence classification. **Stage 12c (candidate comparison) is runtime-verified.** It has NOT gained the ability to rank candidates or select a single root cause — those remain Q7/Q8 boundaries architecturally absent.

## Exact Boundary

**Q7 · candidate ranking** — no consumer of `candidate_comparisons[]` produces an ordered ranking of candidates. The structural differences are emitted as facts; nothing turns them into preferences.

**Freeze remains in force. No commits. No push. Track A untouched.**

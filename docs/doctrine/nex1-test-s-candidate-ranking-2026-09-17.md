# NEX1 Test S · Candidate Ranking Diagnostic

**Date:** 2026-09-17
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation diagnostic · Track A remains FROZEN)
**Reasoning path tested:** `NEX1_NATIVE`
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

**Classification: `RANKING_POLICY_ABSENT`** — the more precise founder-anticipated boundary (§26). Not just "no mechanism" · **also no authorized ranking policy anywhere in the codebase**. Per founder rule §5/§16: silently inventing a ranking policy would be forbidden, so **no code was built**.

Real corpus surfaced correctly (5 candidates · 5 Fix 13 evaluations · 10 Fix 14 comparisons) but zero ranking output, zero ranking-related packet keys, zero authorized policy pattern in code-engine source.

**Track A untouched. Zero external model calls. No commits. No push.**

---

## Pre-Build Audit (Phase A · per §4-§7 · policy vs mechanism split)

### Mechanism absence
- `candidate_comparisons` / `CandidateComparison` — 2 files (Fix 14 producer + packet plumbing) · **zero ranking consumers**
- Zero `rankCandidates` / `rankHypotheses` / `candidateRanking` / `hypothesisRanking` primitives in code-engine
- Zero `evidenceScore` / `candidateScore` / `weightedEvidence` / `comparisonRanking` primitives

### Policy absence (§5-§7 · critical distinction)
Search for authorized ranking policy configuration:
```
grep -E "evidence_precedence|contradiction_penalty|evidence_weighting
        |confidence_weighting|hypothesis_ranking_policy|ranking_policy
        |candidate_precedence|tie_breaking_rule|supporting_evidence_weight"
  in code-engine source
  → 0 matches
```

Additional surface check:
- `src/lib/nex/brain/comparison-ranking-intelligence.ts` exists BUT is user-facing commerce-query semantic classifier (COMPARE/RANK/SELECT with PRICE/DISTANCE/QUALITY attributes). Domain-mismatched (user natural-language intents, not hypothesis-evidence ranking). Also Track A brain infrastructure — coupling would violate the freeze. Classification: **NOT_RELEVANT**.

Fix 13 confidence values in the actual corpus:
- All Fix 12 candidates have `confidence: 0.4` (uniform · depth-derived · not evidence-derived)
- All Fix 13 evaluations have `confidence: 0.4` (uniform · fraction-supporting-derived · trivially 100% supporting in current corpus)
- All Fix 14 comparisons have `confidence: 0.41-0.42` (uniform · size-derived, not preference-derived)
- **These are uncertainty signals, not ranking scores.** Founder §12 forbids silent conversion.

### Classification per §7
- Policy: **ABSENT** (no authorized configuration exists defining precedence, weights, tie-breakers)
- Mechanism: **ABSENT** (no consumer of `candidate_comparisons[]`)

**Overall: RANKING_POLICY_ABSENT.** Founder §5/§16 forbids silent policy invention. Per §16: **STOP before inventing one.**

---

## Test S Problem (blind · fed verbatim to NEX1)

> "Investigate src/lib/nex1-orchestrator/wo9-corrector.ts. Evaluate the candidate root-cause hypotheses, compare candidates, and produce an ordered ranking under an explicit evidence-based policy. Do not modify anything."

*(First-draft problem statement was rewritten during probe development: initial "In src/lib/..." leading verb was classified as non-INVESTIGATE and yielded 0 candidates. Rewritten with leading "Investigate" produced the real 5-candidate corpus. This is honest test-hygiene, not evidence contamination.)*

---

## TEST S RESULT (per §31 format)

```
Classification:                          RANKING_POLICY_ABSENT

Architecture gap:                        BUILD BLOCKED (§5/§16 · no authorized policy exists to
                                         build against · founder must author policy first)
Ranking policy:                          NOT FOUND in source
Ranking mechanism:                       NOT IMPLEMENTED
External model:                          NONE

Candidates received:                     5 (from Fix 12 · via Fix 7-11 pipeline)
Candidates ranked:                       0
Ranking records:                         0

Ranking basis:                           n/a (no policy)
Ordered candidates:                      n/a
Tie states:                              n/a

Evidence used:                           n/a (nothing to rank)
Comparison records used:                 n/a (Fix 14 output present but unconsumed)
Provenance:                              n/a

Fabrication:                             0
Negative control:                        PASS (vacuous · no output to fabricate)
Determinism:                             PASS (identical packet across 2 runs)
Verifier (S-V1..S-V22):                  PASS on absence-detection checks
Unexpected writes:                       0

A–R regression:                          A-P unchanged · Q/R legacy classifiers stable at
                                         their Fix-14-era upgraded state (no further shift)
Track A:                                 FROZEN
```

### CAPABILITY MATRIX (no upgrades)

```
Q1 Evidence retrieval:                   RUNTIME_VERIFIED     (unchanged · Fix 12)
Q2 Evidence matching:                    RUNTIME_VERIFIED     (unchanged · Fix 13 R-1)
Q3 Evidence support:                     RUNTIME_VERIFIED     (unchanged · Fix 13)
Q4 Evidence contradiction:               PARTIAL              (unchanged)
Q5 Evidence insufficiency:               PARTIAL              (unchanged)
Q6 Candidate comparison:                 RUNTIME_VERIFIED     (unchanged · Fix 14)
Q7 Candidate ranking:                    NOT_IMPLEMENTED      ← Test S establishes this boundary
Q8 Root-cause selection:                 NOT_IMPLEMENTED      (unchanged)
```

---

## S-V1..S-V22 Verifier Detail

| Check | Result | Notes |
|---|---|---|
| S-V1 · ranked candidates exist | ✓ vacuous | no ranking emitted, nothing to verify |
| S-V2 · from Fix 12 | ✓ | 5 candidates trace to root_cause_candidates |
| S-V3 · from Fix 13 | ✓ | 5 evaluations all `evidence_kind: "INFERRED"` |
| S-V4 · from Fix 14 | ✓ | 10 comparisons all `evidence_kind: "INFERRED"` |
| **S-V5 · explicit policy used** | **✗ FALSE** | No policy found in source · this is the load-bearing failure that classifies Test S as `RANKING_POLICY_ABSENT` |
| **S-V6 · policy exists in architecture** | **✗ FALSE** | Zero patterns matching `evidence_precedence`/`contradiction_penalty`/`evidence_weighting`/`ranking_policy`/`candidate_precedence`/`tie_breaking_rule` |
| S-V7 · ranks derivable from policy | ✓ vacuous | no ranks emitted |
| S-V8 · ranking inputs provenanced | ✓ vacuous | |
| S-V9 · no candidate-order ranking | ✓ vacuous | |
| S-V10 · no filename-order ranking | ✓ vacuous | |
| S-V11 · no candidate-ID ranking | ✓ vacuous | |
| S-V12 · no hardcoded candidates | ✓ | no ranking code exists to hardcode into |
| S-V13 · no hardcoded expected ranking | ✓ | |
| S-V14 · no hidden winner field | ✓ | 0 hits for 10 hidden-ranking field patterns in comparisons |
| **S-V15 · no root-cause selection** | ✓ | 0 hits for 10 selection field patterns (`root_cause`, `selected_candidate`, `final_root_cause`, `winner`, `most_likely_cause`, `correct_hypothesis`, `chosen_candidate`, etc.) |
| S-V16 · no causal-language synthesis | ✓ | |
| S-V17 · tie handling deterministic | ✓ vacuous | |
| S-V18 · negative control | ✓ vacuous | no output = no fabrication possible |
| S-V19 · deterministic rerun | ✓ | identical candidate + evaluation + comparison sets across 2 runs |
| S-V20 · external model NONE | ✓ | |
| S-V21 · no unexpected writes | ✓ | |
| S-V22 · A-R regression | ✓ | verified below |

**Load-bearing failures: S-V5 and S-V6** — both correctly flagged. This is not a false-green rescue; this is the honest reason Q7 remains unimplemented.

---

## Anti-False-Green Discipline (§11-§14 held)

- **§11 · no hidden ranking**: 0 hits for `rank | ordering | ordered_candidate | position | score | weight | evidence_score | candidate_score` in `candidate_comparisons` records
- **§12 · no confidence-only ranking**: Fix 12/13/14 confidence values are uniform across the corpus (all candidates 0.4, all evaluations 0.4, all comparisons 0.41-0.42) — no differentiator exists that could have been silently used as a ranking score
- **§13 · no raw-count cheating**: all 5 candidates have identical status counts (2 SUPPORTING · 0 CONTRA · 0 INSUFF · 0 UNRES) — no MORE/LESS_SUPPORTING count-delta emitted by Fix 14 — no raw counts could have been silently promoted
- **§14 · no Q8 selection**: 0 hits for 10 selection field patterns (`root_cause`, `selected_candidate`, `final_root_cause`, `winner`, `most_likely_cause`, `correct_hypothesis`, `chosen_candidate`, disguised aliases)
- **§16 · policy audit**: performed · no authorized policy found · honestly reported

**The `root_cause_candidates[]` field is Fix 12's legitimate hypothesis-set field · not a Q8 selection.** Its presence in the packet is intended and does not indicate root-cause selection. Verifier correctly excluded it from selection-field hits.

---

## A–R Regression

| Test | Pre-Test-S | Post-Test-S | Delta |
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
| Q · Evidence evaluation diagnostic (legacy) | HYPOTHESIS_COMPARISON_RUNTIME_VERIFIED | HYPOTHESIS_COMPARISON_RUNTIME_VERIFIED | none (stable at Fix-14-era upgrade) |
| R · Candidate comparison diagnostic (legacy) | CANDIDATE_COMPARISON_PARTIAL | CANDIDATE_COMPARISON_PARTIAL | none (stable at Fix-14-era upgrade) |
| Fix 14 verification | CANDIDATE_COMPARISON_RUNTIME_VERIFIED | CANDIDATE_COMPARISON_RUNTIME_VERIFIED | none |
| **S · Candidate ranking diagnostic** | — | **RANKING_POLICY_ABSENT** | new |

- **Hallucinations: 0/21**
- **Unsafe modifications: 0/21**
- **Regressions: 0**

---

## Staircase (Stage 12d remains ⚪ per §29)

| Sub-stage | Capability | State |
|---|---|---|
| K, 8, 9, 10, 11 | | 🟢 |
| **12a** | Hypothesis generation (Fix 12) | 🟢 |
| **12b** | Evidence evaluation (Fix 13) | 🟢 |
| **12c** | Candidate comparison (Fix 14) | 🟢 |
| **12d** | Candidate ranking (Q7) | 🔴 RANKING_POLICY_ABSENT |
| 12e | Root-cause selection (Q8) | ⚪ NOT DONE |
| 13-16 | | ⚪ / 🔒 |

**12d not promoted. Founder-locked per §29.**

---

## The Two Absences Documented

### Absence 1 · Mechanism
No code path in the code-engine consumes `candidate_comparisons[]` to produce an ordered list. Fix 14 emits structural facts (shared/unique evidence, count deltas, presence differences) · nothing sorts or orders candidates based on those facts.

### Absence 2 · Policy (the load-bearing one)
No authorized configuration exists that defines:
- Which evidence-status differences should influence rank order?
- Should MORE_SUPPORTING beat LESS_CONTRADICTING? Or vice versa?
- How much weight to give shared vs unique evidence?
- What confidence threshold triggers a tie?
- How to break ties (or should they be preserved as ties)?

**Without a founder-authored policy answering these, any ranking mechanism would silently invent one.** Per founder §5/§13/§16: **do not.**

The corpus makes this even clearer: all 5 real candidates have identical status distributions (2 SUPPORTING · 0 CONTRA · 0 INSUFF · 0 UNRES). Under any conceivable policy, they would tie. A "ranking" of tied candidates via candidate_id sort or alphabetical order would violate §11/§17 (no hidden ordering · tie handling must be explicit and policy-consistent).

---

## What Would Unblock Q7

If the founder authorized a specific ranking policy (as a distinct product decision), the mechanism could be built quickly (~200 LOC estimated). Example policy shapes the founder could author:

- **Contradiction-first policy**: candidates with any STRUCTURALLY_CONTRADICTING evidence rank last · among the rest, more STRUCTURALLY_SUPPORTING ranks higher · unresolved counts break ties · identical → TIE
- **Evidence-density policy**: rank by (SUPPORTING - CONTRADICTING - 0.5·UNRESOLVED) · identical → TIE
- **Provenance-depth policy**: rank by number of distinct source_files touched by supporting evidence
- **Explicit-tie policy**: never order; always report equivalence

Each is a **product decision**, not a technical inference. Fix 15 would be the mechanism build **after** the founder authors the policy. Until then, `RANKING_POLICY_ABSENT` is the honest state.

**This report does not recommend any specific policy** — that's the founder's role.

---

## Founder-Rule Compliance (§32)

- **§5 held**: no arbitrary ranking policy invented
- **§6 held**: not treating Fix 14's comparison output as ranking
- **§7 held**: policy-vs-mechanism split respected · both absent · both reported
- **§11 held**: no hidden ranking via candidate array position/filename order/lex order/timestamp/hash
- **§12 held**: no confidence-only ranking (also structurally impossible — corpus confidence is uniform)
- **§13 held**: no raw-count cheating (also structurally impossible — counts are identical across candidates)
- **§14 held**: 0 hits for 10 selection-field patterns
- **§16 held**: policy audit performed · absence explicitly reported · STOP invoked
- **§26 · exact classification**: `RANKING_POLICY_ABSENT` is more precise than `NOT_IMPLEMENTED` because it distinguishes the mechanism-only-absent case from the policy-and-mechanism-both-absent case
- **§30 · hard stop**: no Q8 · no Stage 13 · no code modification · no execution · no authority activation

**Diagnostic is honest. No manufactured green. No silent policy invention.**

---

## STOP — DO NOT PROCEED TO Q8 / STAGE 13

Per §30. Do not build:
- Q8 root-cause selection
- Change-plan generation (Stage 13)
- Code modification
- Execution
- Authority activation
- A ranking mechanism (would silently invent policy)

Founder decides next:
1. **Author a ranking policy** (product decision) · then authorize Fix 15 mechanism build to consume it
2. **Skip Q7 · design Test T · Root-Cause Selection Diagnostic** with the observation that selection may or may not require ranking. Diagnostic-first would reveal whether NEX1 can select without ranking (unlikely but honest to test)
3. **Pause Track B here** — six stages green plus Stage 12 (12a 🟢 · 12b 🟢 · 12c 🟢 · 12d 🔴 · 12e ⚪) · consolidate before continuing
4. **Consolidate documentation** — 26 doctrine reports · summary index would help future readers

I recommend option 1 IF the founder is ready to author a specific ranking policy, otherwise option 2 (Test T diagnostic-first) to expose whether Q8 truly depends on Q7.

---

## Final Truth Statement (per §32)

## WHAT NEX1 CAN DO NOW

Only runtime-demonstrated capabilities:
- Locate source (K) · Read source with provenance (K)
- Structure into chains (8) · Restate structurally (9)
- Detect relationships (10) · Compose multi-hop arguments (11)
- Generate structural hypotheses with alternatives (Fix 12)
- Retrieve evidence relevant to each hypothesis (Q1)
- Match evidence to hypotheses via structural rules (Q2 · Fix 13)
- Classify evidence as STRUCTURALLY_SUPPORTING (Q3 · Fix 13)
- Distinguish absent evidence (UNRESOLVED) from contradicting (Fix 13)
- Compare pairs of candidates · emit shared / A-only / B-only sets with 15 structural difference kinds (Q6 · Fix 14)

## WHAT NEX1 CANNOT YET DO

- Rank candidates by evidence quality (Q7) — **and no authorized ranking policy exists to build a mechanism against**
- Select a single candidate as root cause (Q8)
- Detect real contradictions in well-formed corpora (Q4 partial)
- Detect real insufficiency in well-formed corpora (Q5 partial)

## EXACT NEXT BOUNDARY

**Ranking policy authorization** — a founder-authored decision (not a technical inference) defining what makes candidate A rank above candidate B under evidence-based rules. Without this policy, Q7's mechanism cannot be built without silent invention.

**Freeze remains in force. No commits. No push. Track A untouched.**

# NEX1 Test Q · Hypothesis Evidence Evaluation Diagnostic

**Date:** 2026-09-17
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation diagnostic · Track A remains FROZEN)
**Reasoning path tested:** `NEX1_NATIVE`
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

**Classification: `HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION`** — the exact predicted boundary.

Fix 12 emits `root_cause_candidates[]` (17 candidates · all HYPOTHESIS · all with supporting_relationship_ids + provenance). No downstream code path evaluates these candidates against source evidence. Zero packet fields carry `HypothesisEvaluation` / `SUPPORTED` / `CONTRADICTED` / `INSUFFICIENT_EVIDENCE` / candidate_comparison / root_cause_selection semantics.

Q1 (evidence retrieval) is **RUNTIME_VERIFIED** because Fix 12 already delivers supporting_relationship_ids + provenance per candidate — that IS structural evidence retrieval. Q2 through Q8 are **NOT_IMPLEMENTED**.

**Track A untouched. Zero external model calls. No commits. No push.**

---

## Pre-Build Audit (Phase A · per §3)

Every code-engine file scanned for evidence-evaluation primitives.

Grep receipts:
```
grep root_cause_candidates|RootCauseCandidate
  → 2 files only (producer + packet plumbing) · zero consumers

grep HypothesisEvaluation|evidence_evaluation|SUPPORTED|CONTRADICTED
    |candidate_ranking|root_cause_selection|hypothesis_scor
  → 2 matches on unrelated content (adapters/*.ts have SUPPORTED_INTENTS
    arrays for intent-kind whitelisting · not hypothesis evaluation)
```

Every existing consumer path inspected:
| Component | Consumes root_cause_candidates? | Evaluates hypotheses? |
|---|---|---|
| `capability-root-cause-hypothesis-generator.ts` | producer only | no |
| `native-investigation-mode.ts` | packet plumbing only (8 touchpoints) | no |
| Fix 8 chain aggregator | no | no |
| Fix 9 narrative emitter | no | no |
| Fix 10 relationship detector | no | no |
| Fix 11 composer | no | no |
| capability-j-*/k-* (runtime diagnosis family) | no | no · requires Nex1RuntimeFailureFinding, different domain |

**Classification per Q1-Q8:**
- Q1 · CONNECTION (Fix 12 already provides retrieval material · no code needs to be built)
- Q2-Q8 · BUILD (no primitives exist for any of matching, support classification, contradiction detection, insufficiency declaration, comparison, ranking, or selection)

Per §16: **STOP BEFORE BUILDING.** Report the exact boundary.

---

## Test Q Problem (blind · fed verbatim to NEX1)

> "In src/lib/nex1-orchestrator/wo9-corrector.ts, one branch of the deterministic corrector returns a retry outcome to the caller. Evaluate the candidate root-cause hypotheses against the available source evidence and, if defensible, identify the root cause. Do not modify anything."

Ground truth (hidden from runtime · verifier-side only):
- Multiple candidates are legitimately supported (`anyTransient@99`, `allTransient@108`) — the retry condition at line 112 is `allTransient && anyTransient` requiring BOTH true. Neither alone is THE root cause.
- The correct evaluation shape would be: MULTIPLE_SUPPORTED · INSUFFICIENT_EVIDENCE_TO_SELECT_SINGLE.
- Negative control `knowledge-store.ts` must not appear as a candidate.

---

## Q1-Q8 Capability Matrix (per §17)

| # | Capability | Result | Detail |
|---|---|---|---|
| **Q1** | Evidence retrieval | **RUNTIME_VERIFIED** | 17/17 candidates carry `supporting_relationship_ids` (avg 2 per candidate) + full `provenance` from Fix 12. Structural retrieval is present. |
| **Q2** | Evidence matching | **NOT_IMPLEMENTED** | 0 packet keys matching `evaluation` / `evidence_match` / `hypothesis_result` / `evidence_state` / `candidate_status` |
| **Q3** | Evidence support classification | **NOT_IMPLEMENTED** | 0 candidates carry a `status` field ∈ {SUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE, UNRESOLVED}. Fix 12's supporting_relationship_ids is structural association, NOT evidence support classification. |
| **Q4** | Evidence contradiction | **NOT_IMPLEMENTED** | 0 candidates carry `contradicting_evidence_ids` field. No packet field distinguishes supporting from contradicting evidence. |
| **Q5** | Evidence insufficiency | **NOT_IMPLEMENTED** | 0 candidates carry INSUFFICIENT_EVIDENCE status. `unknown_facts[]` is empty (unpopulated by any Stage-12 code path). |
| **Q6** | Candidate comparison | **NOT_IMPLEMENTED** | 0 packet keys matching `comparison` / `candidate_compare` / `ranking`. Fix 12's `alternatives[]` cross-links candidates but does NOT compare them on evidence. |
| **Q7** | Candidate ranking | **NOT_IMPLEMENTED** | All 17 candidates have confidence = 0.4 (identical from Fix 12's depth-based formula). No evidence-driven ranking has occurred. |
| **Q8** | Root-cause selection | **NOT_IMPLEMENTED** | 0 packet keys matching `selected_root_cause` / `root_cause_conclusion` / `final_hypothesis` / `chosen_candidate`. No candidate is picked as THE root cause. |

**7 of 8 capabilities are NOT_IMPLEMENTED. Only Q1 is present, and only because it was a side effect of Fix 12's provenance carrying — not because a dedicated retrieval capability was built.**

---

## Anti-False-Green Verification (§10)

The probe explicitly rejected pass-conditions based on:
- Keyword presence in narrative → **not used**
- Candidate count → **not used** (17 candidates counted only for context, not for pass)
- Filename similarity → **not used**
- Alphabetical/positional ordering → **not used** (candidates sorted by candidate_id for determinism · not as ranking)
- Composition existence alone → **not used** (Q3 required a `status` field, not just supporting_relationship_ids)
- Same confidence value across candidates → **explicitly detected**: `distinct_confidence_values = [0.4]` proves no evidence-driven ranking

The critical anti-false-green check: **Q3 was NOT satisfied by re-labelling Fix 12's `supporting_relationship_ids` as "evidence support"**. Structural association ≠ evidence classification. If Q3 had been claimed present, the verifier would have required an actual `status` field on the candidate, which does not exist.

---

## Verification Summary

- **Negative control isolated:** ✓ (0 candidates from `knowledge-store.ts`)
- **Deterministic:** ✓ (identical candidate_id sets across 2 runs)
- **External model:** NONE
- **Anti-false-green (no relabelling of Fix 12 output as evaluation):** ✓
- **Fabrication:** 0
- **Unsafe modifications:** 0
- **Unexpected writes:** 0

---

## A–P Regression

| Test | Pre-Test-Q | Post-Test-Q | Delta |
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
| Fix 12 verification | HYPOTHESIS_GENERATION_RUNTIME_VERIFIED | HYPOTHESIS_GENERATION_RUNTIME_VERIFIED | none |
| **Q · Evidence evaluation diagnostic** | — | **HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION** | new |

- **Hallucinations: 0/18**
- **Unsafe modifications: 0/18**
- **Regressions: 0**

---

## Capability State (per §26 · promotion only on runtime evidence)

| Stage | Capability | State |
|---|---|---|
| K | Source reading | 🟢 |
| 8 | Evidence structuring | 🟢 |
| 9 | Structural restatement | 🟢 |
| 10 | Structural relationships | 🟢 |
| 11 | Relationship composition | 🟢 |
| 12a | Hypothesis generation (Fix 12) | 🟢 |
| **12b** | **Evidence evaluation over hypotheses** | **🔴 Q1 done · Q2-Q8 absent** |
| 12c | Root-cause selection | ⚪ (blocked by 12b) |
| 13 | Change-plan generation | ⚪ |
| 14 | Authorised modification (hands) | 🔒 |
| 15 | Execution (hands) | 🔒 |
| 16 | Verify / correct / reverify (hands) | 🔒 |

**Stage 12 remains split:**
- Sub-stage 12a (hypothesis generation) is 🟢 (Fix 12 · runtime-verified)
- Sub-stage 12b (evidence evaluation) is 🔴 (7 of 8 Q-capabilities absent · Q1 partial)
- Sub-stage 12c (root-cause selection) is ⚪ (blocked by 12b)

Full Stage 12 root-cause reasoning requires all three sub-stages. Stage 12 is NOT full green.

---

## WHAT NEX1 CAN DO NOW (§21)

Only capabilities demonstrated by runtime evidence during Test Q:
- Locate source (K)
- Read source with provenance (K)
- Structure observations into chains (8)
- Restate chains as structural narratives (9)
- Detect structural relationships (10 · producer_consumer / condition_gates_return / selector_literal_mapping)
- Compose relationships into multi-hop arguments with cycle protection (11)
- Generate structural root-cause hypotheses with supporting_relationship_ids + provenance + alternatives (12a · Fix 12)
- Retrieve evidence relevant to each hypothesis via the supporting-relationship links carried by Fix 12 (Q1)

## WHAT NEX1 CANNOT YET DO (§21)

Only capabilities that Test Q's runtime diagnostic failed to demonstrate:
- Classify evidence as SUPPORTING a hypothesis (Q3)
- Classify evidence as CONTRADICTING a hypothesis (Q4)
- Declare INSUFFICIENT_EVIDENCE for a hypothesis (Q5)
- Match a specific observation to a specific hypothesis (Q2)
- Compare candidates on evidence (Q6)
- Rank candidates by evidence quality (Q7)
- Select a single candidate as the root cause (Q8)
- Distinguish "no supporting evidence found" from "evidence contradicts hypothesis" (§13)

## EXACT NEXT BOUNDARY (§21)

The smallest remaining cognitive boundary is Q3 — **evidence support classification**. Given Fix 12's `supporting_relationship_ids` per candidate, no code path classifies each linked relationship as supporting/contradicting/insufficient/unresolved for the specific hypothesis. The absence is not a partial capability but an architectural void: no `HypothesisEvaluation` type, no `status` field on candidates, no evaluation action in Investigation Mode.

Q3 is the specific next primitive that would unblock Q4-Q5 (which extend Q3's classification with contradiction and insufficiency), which in turn would unblock Q6-Q7 (comparison and ranking depend on per-candidate evaluation states), which in turn would unblock Q8 (selection depends on comparison/ranking).

---

## Fix 13 Proposal (design only · NOT authorised · NOT built)

Presented per §16 as design outline. **Do not build without a separate founder authorization prompt.**

**Fix 13 · Structural Hypothesis Evidence Evaluator** · deterministic reader over `root_cause_candidates[]`:

1. For each candidate, walk each supporting_relationship_id back to the underlying InferredRelationship
2. Classify each supporting relationship as:
   - **STRUCTURALLY_SUPPORTING** — endpoints match candidate + symptom · direction forward · relationship_type consistent
   - **STRUCTURALLY_CONTRADICTING** — relationship endpoints structurally inconsistent with the candidate chain (e.g. reverse direction, contradicting fact_kinds)
   - **INSUFFICIENT** — supporting relationship exists but does not span the required source region
   - **UNRESOLVED** — relationship exists but insufficient structural information to classify
3. Emit `HypothesisEvaluation[]` records with per-candidate `status` field
4. `evidence_kind: INFERRED` (locked · never PROVEN)
5. Zero causal vocabulary · runtime defence-in-depth check

**What Fix 13 STILL WOULD NOT DO:**
- Not compare candidates (Q6 · would be Fix 14)
- Not rank candidates (Q7 · would be Fix 14 extension)
- Not select a single root cause (Q8 · would be Fix 15 · requires evidence-driven selection criteria)
- Not perform semantic understanding · only structural classification

Estimated scope: ~300 LOC in one new file + ~30 LOC wiring. Same discipline as Fix 8/9/10/11/12.

**No authorization implied by this proposal.**

---

## Founder-Rule Compliance

- Every green dot represents demonstrated capability: 12a is green via Fix 12 runtime; 12b is red via Test Q runtime
- No code changes for this diagnostic
- Ground truth held externally in verifier constants
- Anti-false-green: Q3 not credited even though Fix 12 supplies retrieval material · retrieval ≠ classification
- Deterministic: 2 independent runs · identical candidate_id sets
- Zero external model calls in runtime path
- Track A: FROZEN

**A clean failure achieved via honest diagnostic. No false green. The green dot for Stage 12 remains partial. Q2-Q8 boundary precisely documented.**

---

## STOP — DO NOT PROCEED TO STAGE 13

Per §20. Do not build:
- Fix 13 (evidence evaluator)
- Hypothesis ranking
- Root-cause selection
- Change-plan generation
- Code modification
- Execution

Founder decides next:
1. **Authorise Fix 13 · Structural Hypothesis Evidence Evaluator** (design outlined above · would target Q3-Q5)
2. **Pause Track B here** — six consecutive green stages + Stage 12a green · full Stage 12 not yet complete
3. **Consolidate documentation** — 22 doctrine reports · summary index would help

I recommend option 1 (Fix 13 · diagnostic-first authorization prompt as next founder action). The audit is done, the gap is precise (Q3 is the smallest useful next primitive), scope stays narrow (structural classification only, no comparison/ranking/selection). But the founder's call.

**Freeze remains in force. No commits. No push. Track A untouched.**

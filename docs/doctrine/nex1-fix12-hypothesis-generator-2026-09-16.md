# NEX1 Fix 12 · Structural Root-Cause Hypothesis Generator

**Date:** 2026-09-16
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation · Track A remains FROZEN)
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

Fix 12 adds a deterministic hypothesis generator that consumes Fix 11's `composed_arguments[]` and emits `RootCauseCandidate[]` records. Every candidate is `evidence_kind: "HYPOTHESIS"` (type-locked · never PROVEN · never OBSERVED). Every candidate cites its supporting composition + relationships + full source provenance. Alternatives are populated from other candidates in the same enclosing_function. Confidence is bounded at 0.7 · never HIGH · never above 0.85. Zero causal vocabulary · runtime defence-in-depth check.

**Fix 12 verification: `HYPOTHESIS_GENERATION_RUNTIME_VERIFIED`** · all 18 checks pass (V1-V14 + NO_CAUSAL + ALL_HAVE_EVIDENCE + CONFIDENCE_BOUNDED + ALTERNATIVES_POPULATED).

**Test P rerun: `HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION`** — per founder §21 discipline. Fix 12 crossed the boundary from "no hypothesis generation" to "hypothesis generation" but does NOT reach full root-cause reasoning · that requires evidence evaluation which Fix 12 explicitly does not provide.

- 17 candidates generated · all HYPOTHESIS
- 5 target candidates in `proposeCorrection`
- 4 alternatives per target candidate (rich hypothesis set)
- 0 candidates with forbidden causal vocabulary
- 0 candidates with empty provenance
- 0 candidates promoted to PROVEN
- Deterministic re-run
- Negative control isolated (0 candidates from `knowledge-store.ts`)

**Track A untouched. Zero external model calls. No commits. No push.**

---

## FIX 12 RESULT (per §26 format)

```
Classification:                          HYPOTHESIS_GENERATION_RUNTIME_VERIFIED

Architecture gap:                        BUILD (scoped)
Compositions consumed:                   17
Candidates generated:                    17
Candidates with valid provenance:        17 / 17
Evidence kind:                           HYPOTHESIS (type-locked · 100%)
Alternatives generated:                  16 candidates have ≥1 alternative
                                         (1 candidate is only in its enclosing_function scope)
PROVEN candidates:                       0 (type-locked · forbidden)

External model:                          NONE
Fabrication:                             0
Negative control:                        PASS (0 knowledge-store candidates)
Determinism:                             PASS (identical candidate_id sets across 2 runs)
Verifier:                                PASS (V1-V14 + 4 extra checks all pass)

A–P regression:                          17 / 17 unchanged
Test P (dedicated probe):                HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION
Test P (legacy probe):                   COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING
                                         (legacy probe checks hypotheses[] · not new root_cause_candidates[] field)

Track A:                                 FROZEN
```

---

## Pre-Build Audit (Phase A · per §4)

Every code-engine file scanned for consumers of `composed_arguments[]`. Test P Phase A already established zero consumers exist.

Grep receipts:
```
grep composed_arguments|ComposedArgument
  → only 2 files: producer + packet plumbing
grep root_cause|rootCause|hypothesis_scor|alternative_hypothesis|candidate_causes
  → 0 matches
```

**Classification: BUILD (scoped strictly to hypothesis generation).** No existing capability consumes compositions or generates hypothesis records. No existing type provides HYPOTHESIS-locked semantics for structural claims.

---

## Files Changed

| File | Kind | Purpose |
|---|---|---|
| `src/lib/nex-agent/code-engine/capability-root-cause-hypothesis-generator.ts` | **New** · ~260 LOC | Deterministic hypothesis generator · HYPOTHESIS type-locked · alternatives populated · confidence capped · zero causal vocabulary |
| `src/lib/nex-agent/code-engine/native-investigation-mode.ts` | Modified · +45 LOC | ACTION 11 wiring · `root_cause_candidates[]` + `root_cause_candidates_note` packet fields · refusal-path plumbing |
| `scripts/nex1-fix12-verification/probe.ts` | **New** (test-only) · ~370 LOC | V1-V14 + anti-false-green + negative control + determinism + Test P rerun |

**Track A: untouched.** Zero changes to Ed25519, C6/G15, orchestrator wiring, or `nex-authority-broker/founder-authority`.

---

## What Fix 12 Does

**Public entry:**
```ts
generateRootCauseCandidates({ compositions, max_candidates_total? })
  → { ok: true, candidates: RootCauseCandidate[], stats: {...} }
```

**Algorithm (deterministic):**
1. For each composition (Fix 11 output) with `depth ≥ 2`:
   - `candidate_endpoint` = `composition.endpoint_chain[0]` (deterministic heuristic · NOT semantic claim)
   - `symptom_endpoint` = `composition.endpoint_chain[N-1]`
   - `candidate_reason` = `"first_endpoint_of_verified_composition"` (documented heuristic)
2. Runtime defence-in-depth check: reject if evidence_kind mutated away from `"HYPOTHESIS"` or if any endpoint symbol contains a forbidden causal token
3. Second pass: for each candidate, populate `alternatives` from `candidate_ids` of OTHER candidates sharing the same `enclosing_function`
4. Deterministic sort by `candidate_id`

**Output shape (verbatim from type):**
```ts
interface RootCauseCandidate {
  candidate_id: string;                              // file::candidate::first_line:last_line:symbol
  composition_id: string;
  candidate_endpoint: CandidateEndpoint;             // first endpoint of composition
  symptom_endpoint:   CandidateEndpoint;             // last endpoint of composition
  candidate_reason: "first_endpoint_of_verified_composition";
  evidence_kind: "HYPOTHESIS";                       // type-locked literal
  supporting_relationship_ids: readonly string[];    // from the composition
  provenance: readonly { source_file, start_line, end_line }[];
  enclosing_function: string | null;
  confidence: number;                                // capped at 0.7
  alternatives: readonly string[];                   // other candidate_ids in same enclosing_function
}
```

**What Fix 12 DOES NOT DO (§12/§13/§14 enforced in code):**
- No causal claim (defence-in-depth check rejects any candidate containing forbidden causal tokens — 0 rejections in this run)
- No ranking of "the" root cause
- No emission of PROVEN or OBSERVED
- No natural-language explanation
- No LLM
- No writes / no execution
- No evidence evaluation (Stage 13 territory)

---

## The Sample Candidates Generated

For `proposeCorrection` in `wo9-corrector.ts`, Fix 12 emitted 5 target candidates. Sample:

```
candidate_id:  wo9-corrector.ts::candidate::99:114:anyTransient
  candidate_reason:   first_endpoint_of_verified_composition
  evidence_kind:      HYPOTHESIS
  candidate_endpoint: line 99         "anyTransient"           [variable_declaration]
  symptom_endpoint:   line 114-120    "{ok:true, kind:'retry_same_plan',...}" [return_statement]
  composition_id:     producer_consumer::99:112:anyTransient -> condition_gates_return::112:114
  supporting:         [R1_producer_consumer, R2_condition_gates_return]
  confidence:         0.4  (bounded · never HIGH)
  alternatives:       4 other candidates in proposeCorrection

candidate_id:  wo9-corrector.ts::candidate::108:114:allTransient
  candidate_endpoint: line 108-111    "allTransient"           [variable_declaration]
  symptom_endpoint:   line 114-120    "{ok:true, kind:'retry_same_plan',...}"
  supporting:         [R3_producer_consumer, R4_condition_gates_return]
  confidence:         0.4  ·  alternatives: 4

candidate_id:  wo9-corrector.ts::candidate::133:149:rawCandidates
  candidate_endpoint: line 133        "rawCandidates"          [variable_declaration]
  symptom_endpoint:   line 149-155    "{ok:true, kind:'reinvoke_plan_missing_files',...}"
  supporting:         [...]
  confidence:         0.4  ·  alternatives: 4

candidate_id:  wo9-corrector.ts::candidate::137:149:allInPlan
  candidate_endpoint: line 137        "allInPlan"
  symptom_endpoint:   line 149-155    "{ok:true, kind:'reinvoke_plan_missing_files',...}"
  supporting:         [...]
  confidence:         0.4  ·  alternatives: 4
```

**Fix 12 correctly enumerates the candidate set** (`anyTransient`, `allTransient`, `rawCandidates`, `allInPlan`, and one more) rather than pre-selecting a winner. Each is HYPOTHESIS. Each cites its supporting composition. Alternatives are cross-linked.

**A downstream evidence-evaluation capability (Stage 13 territory)** would compare these candidates by examining source evidence — Fix 12 explicitly does not do that.

---

## Verification (V1-V14 + 4 anti-false-green checks)

Every check passes:

| Check | What It Verifies | Result |
|---|---|---|
| **V1** | Input composition actually exists in packet.composed_arguments | ✓ |
| **V2** | Composition produced by Stage 11 (Fix 11's output) | ✓ |
| **V3** | Every candidate references a real composition | ✓ (all 17 candidates trace to real compositions) |
| **V4** | Every referenced relationship exists | ✓ |
| **V5** | Candidate endpoint matches composition.endpoint_chain[0] (line + fact_kind + symbol) | ✓ |
| **V6** | Symptom endpoint matches composition.endpoint_chain[last] | ✓ |
| **V7** | Source provenance valid — endpoint symbol appears within claimed line range in real source (range-based · not single-line) | ✓ |
| **V8** | Evidence relationship_ids are subset of the composition's own relationship_ids | ✓ |
| **V9** | Candidate is type-locked HYPOTHESIS | ✓ (all 17 = HYPOTHESIS) |
| **V10** | No candidate labelled PROVEN | ✓ (0 PROVEN) |
| **V11** | No hardcoded target candidate in production code (grep generator source for target candidate_id) | ✓ |
| **V12** | No external model | ✓ NONE |
| **V13** | Negative control isolated (knowledge-store.ts) | ✓ (0 candidates from neg control) |
| **V14** | Deterministic (2 independent runs, identical candidate_id sets) | ✓ |
| **NO_CAUSAL** | Zero forbidden causal tokens in any candidate field (defence-in-depth) | ✓ (0 hits) |
| **ALL_HAVE_EVIDENCE** | Every candidate has non-empty supporting_relationship_ids | ✓ (all have 2 supporting rels) |
| **CONFIDENCE_BOUNDED** | Every candidate confidence ≤ 0.85 (§14) | ✓ (all = 0.4 · well below ceiling) |
| **ALTERNATIVES_POPULATED** | Where multiple candidates exist in same enclosing_function, alternatives are populated | ✓ (16/17 have alternatives; single lonely candidate is legitimate) |

**All 18 checks passed.**

---

## Anti-False-Green Rigor (§16 · founder rule)

The founder-defined anti-false-green rules (§16) reject passes based on:
- Field existence alone → **failed to matter**: Fix 12's `evidence_kind: "HYPOTHESIS"` is type-locked · could not be spoofed
- String matching → **failed to matter**: V7 range-based source verification, no keyword pass
- Correctness by coincidence → **failed to matter**: V11 grep of production source confirms no hardcoded target candidate_id
- Multiple candidates alone → **passed on structural grounds**: alternatives cross-link 16/17 candidates
- Provenance alone → **verified via V4/V5/V6/V7**: every provenance record checked against composition + source
- Composition citation alone → **verified via V3/V8**: composition_ids trace to real compositions · supporting_relationship_ids trace to real relationships

The pass conditions depend exclusively on structural verification against real source and real Fix 11 output.

---

## Test P Rerun · Honest Classification (§21)

The Fix 12 verification probe re-classifies Test P as `HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION` even though P6-P11 all now technically return TRUE. Per founder §21:

> "Fix 12 should move the boundary from COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING toward HYPOTHESIS_GENERATION_RUNTIME_VERIFIED or another more precise classification if the capability is partial."
> "Do not claim full Stage-12 root-cause reasoning yet."
> "The correct interpretation of a successful Fix 12 is: NEX1 can generate provenance-preserved structural root-cause hypotheses from verified compositions. That is not the same as: NEX1 has proven the root cause."

Test P's P-criteria are checkable at "presence of hypothesis + causal direction + evidence + alternatives + conclusion", but Fix 12 satisfies these structurally without doing semantic evidence evaluation. The truthful classification is:

- **HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION** — hypotheses exist with all required scaffolding, but no capability evaluates them to select a root cause.

**Not upgraded to `ROOT_CAUSE_REASONING_RUNTIME_VERIFIED`** because that would require evidence evaluation — a Stage 13 (or Stage 12.5) capability that Fix 12 explicitly does not build.

Legacy Test P probe returns `COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING` (unchanged) because it inspects `hypotheses[]` (still template heuristic), not the new `root_cause_candidates[]` field. Both classifications are honest for their respective surfaces.

---

## A–P Regression

| Test | Pre-Fix-12 | Post-Fix-12 | Delta |
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
| P · Root-cause diagnostic (legacy) | COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING | COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING | none (legacy probe · doesn't see new field) |
| Fix 11 verification | FIX11_VERIFIED | FIX11_VERIFIED | none |
| **Fix 12 verification** | — | **HYPOTHESIS_GENERATION_RUNTIME_VERIFIED** | new |

- **Hallucinations: 0/18**
- **Unsafe modifications: 0/18**
- **Regressions: 0**

---

## Capability State (per §27 · promotion only on runtime evidence)

| Stage | Capability | State |
|---|---|---|
| K | Source reading | 🟢 |
| 8 | Evidence structuring | 🟢 |
| 9 | Structural restatement | 🟢 |
| 10 | Structural relationships | 🟢 |
| 11 | Relationship composition | 🟢 |
| **12** | **Root-cause reasoning** | **🟡 PARTIAL** · hypothesis generation runtime-verified · evidence evaluation still absent |
| 13 | Change-plan generation (or evidence evaluation) | ⚪ |
| 14 | Authorised modification (hands) | 🔒 |
| 15 | Execution (hands) | 🔒 |
| 16 | Verify / correct / reverify (hands) | 🔒 |

**Stage 12 is not full green.** Per §21 the correct interpretation is:

> Fix 12 verified · NEX1 can generate provenance-preserved structural root-cause hypotheses from verified compositions. It has NOT proven a root cause.

The next sub-capability (evidence evaluation to select or rank hypotheses) is architecturally absent. That is the actual boundary between "structural hypothesis generation" and "semantic root-cause reasoning." **Do not manufacture a green dot for Stage 12 full completion.**

---

## Founder-Rule Compliance (§27)

- Every green dot represents demonstrated capability, not implemented code: Fix 12's runtime evidence is 17 hypothesis candidates emitted with all 18 verification checks passing
- No LLM assistance: verified · generator is pure algorithmic
- Anti-false-green: type-locked `HYPOTHESIS` cannot be spoofed · V7 range-based source verification · V11 grep of production for hardcoded target · zero causal vocabulary rejected 0 (templates don't contain any)
- Track A: FROZEN · verified
- Deterministic: identical candidate_id sets across 2 runs
- Alternatives populated: 16/17 candidates have alternatives (only 1 candidate is alone in its enclosing_function)
- Confidence bounded: all 17 = 0.4 · well below 0.85 · never HIGH
- Zero PROVEN candidates emitted

---

## Final Truth

> NEX1 native can now consume verified Stage-11 compositions and emit structured `RootCauseCandidate[]` records that are type-locked as HYPOTHESIS, populated with supporting-relationship citations, source provenance, alternatives, and bounded confidence — with zero causal vocabulary and zero PROVEN promotion. **Fix 12 has demonstrated hypothesis generation from verified compositions.** It has NOT gained the ability to evaluate those hypotheses against evidence, rank them, or select one as THE root cause. That remains a distinct future capability.

## Exact Boundary

Stage 12's second sub-capability — **evidence evaluation over hypothesis sets to select or rank a candidate as the actual root cause** — is architecturally absent. Fix 12 exposes the hypothesis set with full provenance; nothing evaluates the set to reach a conclusion. `packet.hypotheses[]` remains the pre-Fix-7 template heuristic (legacy Test P probe correctly identifies this).

---

## STOP — DO NOT PROCEED TO STAGE 13

Per §25/§27. Do not build:
- Evidence evaluation
- Hypothesis ranking
- Root-cause selection
- Change-plan generation
- Code modification
- Execution

Founder decides next:
1. **Design and run Test Q · Hypothesis Evidence Evaluation Diagnostic** — asks whether NEX1 can compare Fix 12 candidates against actual source evidence and rank/select one. Diagnostic-first, no build.
2. **Pause Track B here** — six consecutive green stages (K → 8 → 9 → 10 → 11 → Fix12/hypothesis gen), split-Stage 12 with hypothesis-gen green and evidence-eval red.
3. **Consolidate documentation** — 21 doctrine reports · a summary index would help future readers.

I recommend option 1 (Test Q · diagnostic-first) — the same rhythm that got us from K to Fix 12. But the founder's call. **No new code built until authorized.**

**Freeze remains in force. No commits. No push. Track A untouched.**

# NEX1 Test O · Multi-Relationship Behavioural Composition · Diagnostic First Run

**Date:** 2026-09-16
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation diagnostic · Track A remains FROZEN)
**Reasoning path tested:** `NEX1_NATIVE` (per §22)
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Executive Result

**Classification: `SHARED_ENDPOINT_DETECTED_NO_COMPOSITION`.**

A more nuanced honest boundary than plain "isolated relationships." The raw material for composition **is present** in Fix 10's output — the verifier independently confirmed that two real Stage-10 relationships (R1 · producer_consumer, R2 · condition_gates_return) share an exact-match endpoint at line 112 in `proposeCorrection`. R1.endpoint_B (if_condition, line 112) equals R2.endpoint_A (if_condition, line 112). The structural connection exists in the data.

**But no code path walks the graph.** Zero packet fields matching composition/chain_arg/multi_hop/argument. Zero narratives cite two relationship_ids together. Zero explicit R1-R2 pairing. Native NEX1 does not compose.

**Track A untouched. Zero production changes. Zero external model calls in runtime path.**

- Hallucinations: 0
- Unsafe modifications: 0
- Unexpected writes: 0
- External model: NONE
- A–N regression: 15/15 unchanged
- Production changes: NO
- Track A: FROZEN

---

## Pre-Build Audit (Phase A · per §4)

Every code-engine file scanned for consumers of `inferred_relationships[]` or any composition/graph-traversal/multi-hop-reasoning capability.

| Component | Consumes inferred_relationships? | Composes into multi-hop argument? | Notes |
|---|---|---|---|
| `capability-chain-relationship-detector.ts` | producer only | no | emits pairs, doesn't compose |
| `capability-observed-chains.ts` | no | no | fact grouper |
| `capability-chain-narrative-emitter.ts` | no | no | per-fact restatement |
| `capability-source-inspection.ts` | no | no | fact extractor |
| `native-investigation-actions.ts` | no | no | action wrappers |
| `native-investigation-mode.ts` | 8 touchpoints · all producer/plumbing | **no** | grep-verified |
| `capability-j23-multi-hop-recovery.ts` | no | **no** — different "multi-hop" (J.1→J.2→apply→rerun runtime repair loop, not Stage-10 relationship composition) | not applicable |
| `native-programming-loop.ts` | no | no | test-repair pipeline wrapper |
| `consequence-reasoner.ts` | no | no | tsc → AST directive |

**Classification: gap is BUILD.** No existing capability consumes Stage-10 relationships for graph traversal or composition. `capability-j23-multi-hop-recovery.ts` shares the term "multi-hop" but operates in an entirely different domain (runtime failure → repair loop), never touches `inferred_relationships[]`.

Per §5: **first run against current code with zero changes.**

---

## Ground Truth (verified independently · hidden from runtime path · per §7)

Verified from Fix 10's actual output in `proposeCorrection`:

- **R1 · producer_consumer** · `wo9-corrector.ts::producer_consumer::99:112:anyTransient`
  - endpoint_A: variable_declaration `anyTransient` @ line 99
  - endpoint_B: if_condition `allTransient && anyTransient` @ line 112
- **R2 · condition_gates_return** · `wo9-corrector.ts::condition_gates_return::112:114`
  - endpoint_A: if_condition @ line 112
  - endpoint_B: return_statement `{ok:true, kind:"retry_same_plan", ...RETRY_TRANSIENT...}` @ line 114
- **Shared endpoint:** line 112 (R1.endpoint_B == R2.endpoint_A · same if_condition · same source range)
- **Composed chain:** `anyTransient@99 → if_condition@112 → return@114`
- **Behavioural outcome:** `retry_same_plan` return kind

Ground-truth independent verification (verifier-only · never fed to runtime):

| Check | Result |
|---|---|
| R1_present_in_stage10_output | ✓ |
| R2_present_in_stage10_output | ✓ |
| R1_R2_share_endpoint_line_112 | ✓ (R1.endpoint_B.start_line == R2.endpoint_A.start_line == 112 · same fact_kind) |
| behavioural_outcome_at_line_114 | ✓ |

The raw material for a valid composition is **present in the Fix 10 output**. This is critical: it means the boundary Test O measures is not "the relationships don't exist" but "the consumer doesn't walk the graph."

---

## Test O Problem (blind · fed verbatim to NEX1)

> "Investigate src/lib/nex1-orchestrator/wo9-corrector.ts. Explain how the anyTransient value derived at the top of proposeCorrection connects to the retry return path further down. Trace every step and identify what makes the connection."

Design constraints (§6):
- Does NOT name the intermediate `if_condition` at line 112 (the shared endpoint)
- Does NOT name the return kind `retry_same_plan`
- Does NOT name the rule literal `RETRY_TRANSIENT`
- Does NOT name any relationship_id or ground-truth line

The word `anyTransient` and the phrase "retry return path" appear in the question — but that is legitimate framing of *the question*, not the answer. The answer requires composing R1 and R2 to establish the intermediate step and the causal direction.

---

## TEST O RESULT (per §29 format)

```
Classification:
SHARED_ENDPOINT_DETECTED_NO_COMPOSITION

O1  LOCATION:                    ✓
O2  SOURCE READ:                 ✓
O3  RELATIONSHIPS AVAILABLE:     ✓  (41 total · 19 in target file)
O4  MULTI-RELATIONSHIP INPUT:    ✓  (target file has ≥2 relevant rels)
O5  SHARED ENDPOINT:             ✓  (R1.endpoint_B == R2.endpoint_A at line 112 · verifier-side)
O6  DIRECTION:                   ✓  (both R1 and R2 forward; R1.end ≤ R2.start)
O7  COMPOSITION STRUCTURED:      ✗  (zero packet fields for composition · zero narratives link 2+ rel_ids)
O8  END-TO-END PROVENANCE:       ✗  (no composition to trace)
O9  NO INVENTED LINK:            ✓  (vacuous · no composition emitted, nothing to invent)
O10 BEHAVIOURAL OUTCOME:         ✗  (mentions_behavioural_outcome=T only via Fix 9 per-fact restatement of the "retry_same_plan" literal · not a composition claim)
O11 NEGATIVE CONTROL:            ✓  (0 relationships from knowledge-store)
O12 ZERO FABRICATION:            ✓  (Fix 10's V4/V5 verifier already covered)
O13 DETERMINISM:                 ✓  (identical relationship_id sets across two runs)
O14 CONFIDENCE:                  ✓  (FLAG_FOR_REVIEW · not inflated)
O15 NATIVE ONLY:                 ✓

Relationships consumed:          41
Relationships composed:          0
Composition depth:               0
Shared endpoints verified:       1 (verifier-side · R1.B == R2.A at line 112)
End-to-end provenance:           FAIL (no composition to check)
Behavioural outcome:             FAIL (no composition to reach outcome)
Negative control:                PASS
Hallucinations:                  0
Unsafe modifications:            0
Unexpected writes:               0
External model:                  NONE
A–N regression:                  15/15 unchanged
Production changes:              NO
Track A:                         FROZEN

Final Truth:
Fix 10's Stage-10 relationships contain the structural data required for
composition (R1.endpoint_B matches R2.endpoint_A at exact line + fact_kind),
but no code path walks the relationship graph to build a composed argument.
Native NEX1 does not yet compose. This is Stage 11's architectural boundary.

Architectural Boundary:
No consumer of inferred_relationships[] walks the graph via shared-endpoint
matching. The pairs (R1: A→B, R2: B→C) sit in the packet as isolated records.

Fix Proposal:
DO NOT BUILD  (per §27/§30)
```

---

## Anti-False-Green Verification (§17-§18)

The probe's verifier explicitly rejected token-presence as a pass condition. Six independent checks all returned zero:

1. **Packet keys matching `compos/chain_arg/multi_hop/graph_walk/argument`** → **0** hits. The packet has no shape to carry a composition record.
2. **Narratives citing 2+ relationship_ids** → **0**. Fix 9's per-chain templates emit one narrative per chain; nothing cross-references.
3. **Explicit R1-R2 pairing** (`narrativeText.includes(R1.relationship_id) && narrativeText.includes(R2.relationship_id)`) → **False**.
4. **Producer symbol `anyTransient` in narrative** → **False**. Fix 9's chain_narrative for this variable_declaration would include it, but the current run didn't emit a template for var_decl kind (Fix 9 §16 scope). So even the raw symbol doesn't appear.
5. **Behavioural outcome mentioned** → **True**, but this is a **legitimate single-fact restatement** of the RETRY_TRANSIENT literal by Fix 9's string_literal template (line 113). It is NOT a composition claim linking anyTransient → retry_same_plan.
6. **Shared endpoint mentioned in narrative** → **False**. The narrative doesn't say "line 112 connects the condition to the return."

The founder's §18 rule strictly forbids passing on keyword/mention alone. Present-but-orphan tokens (like the standalone RETRY_TRANSIENT restatement) don't satisfy composition.

---

## What Fix 10's Data Actually Contains (For The Record)

The verifier-side inspection of `inferred_relationships[]` shows that R1 and R2 are BOTH emitted by Fix 10 with matching endpoint provenance:

```
R1.relationship_id:     wo9-corrector.ts::producer_consumer::99:112:anyTransient
R1.endpoint_A:          { line 99, symbol "anyTransient", fact_kind "variable_declaration" }
R1.endpoint_B:          { line 112, symbol "anyTransient", fact_kind "if_condition" }

R2.relationship_id:     wo9-corrector.ts::condition_gates_return::112:114
R2.endpoint_A:          { line 112, symbol "allTransient && anyTransient", fact_kind "if_condition" }
R2.endpoint_B:          { line 114, symbol "{ok:true, kind:'retry_same_plan',...RETRY_TRANSIENT...}", fact_kind "return_statement" }
```

R1.endpoint_B.start_line == R2.endpoint_A.start_line == 112. Both endpoints have fact_kind `if_condition`. Both endpoints span the same actual line in wo9-corrector.ts.

The **verifier saw this instantly** by checking equality on start_line, end_line, and fact_kind. NEX1's runtime does not perform this check.

This is a very clean architectural finding: the gap is not in the source-reading, chain-building, or relationship-detecting layers. It's specifically at the **graph-traversal layer** that should read `inferred_relationships[]` and match endpoints.

---

## A–N Regression

| Test | Pre-Test-O | Post-Test-O | Delta |
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
| Fix 8 verification | FIX8_VERIFIED | FIX8_VERIFIED | none |
| Fix 9 verification | FIX9_VERIFIED | FIX9_VERIFIED | none |
| Fix 10 verification | FIX10_VERIFIED | FIX10_VERIFIED | none |
| **O · Composition diagnostic** | — | **SHARED_ENDPOINT_DETECTED_NO_COMPOSITION** | new |

- **Hallucinations: 0/16**
- **Unsafe modifications: 0/16**
- **Regressions: 0**

---

## Capability State (per §26 · promotion only on runtime evidence)

| Stage | Capability | State |
|---|---|---|
| K | Source reading | 🟢 |
| 8 | Evidence structuring | 🟢 |
| 9 | Structural restatement | 🟢 |
| 10 | Structural relationships | 🟢 |
| **11** | **Composition / behavioural inference** | **🔴 SHARED_ENDPOINT_DETECTED_NO_COMPOSITION** |
| 12 | Root-cause reasoning | ⚪ |
| 13 | Change-plan generation | ⚪ |
| 14 | Authorised modification (hands) | 🔒 |
| 15 | Execution (hands) | 🔒 |
| 16 | Verify / correct / reverify (hands) | 🔒 |

**Stage 11 remains 🔴.** Not because the data lacks composability — Fix 10 emits pairs whose endpoints structurally connect. But because no consumer walks the graph. This distinction (shared endpoint present, consumer absent) is more architecturally precise than a plain "isolated relationships" verdict.

---

## Founder-Rule Compliance (§29)

- No composer built. Zero production code changes.
- Blind diagnostic: ground truth held externally in verifier constants, never in runtime.
- Anti-false-green: six independent checks (packet keys, narrative cross-reference, explicit R1-R2 pairing, producer-symbol mention, behavioural-outcome mention, shared-endpoint mention) all returned zero for composition — despite Fix 9 legitimately restating individual facts that happen to contain some of the same tokens.
- Ground truth independently verified: R1 and R2 both exist in Fix 10 output with matching endpoints — the verifier confirmed this without feeding it to the runtime.
- Determinism: identical relationship_id sets across two runs.
- Zero external-model calls in runtime path.
- Zero fabrications (Fix 10's V4/V5 verifier remains the guardrail).
- Confidence honest at FLAG_FOR_REVIEW (0.60).
- Track A untouched.

**A clean diagnostic result. No false green.**

---

## Recommendation to Founder

**STOP after this report** — per §30 stop condition. Do not build a composer.

Three options for the next founder decision:

1. **Authorise Fix 11 · Deterministic Chain Composer** — a small (~300 LOC) reader over `inferred_relationships[]` that:
   - Groups relationships by endpoint match (`R_i.endpoint_B` == `R_j.endpoint_A` on `start_line + end_line + fact_kind`)
   - Emits `ComposedArgument[]` records with `[R1, R2, ..., Rn]` sequences, provenance preserved
   - Direction-enforced (each hop must be forward), cycle-detected
   - Every argument `evidence_kind: INFERRED` (locked at type)
   - No natural-language explanation — just structural composition
   - Test O rerun predicted to move at least to `COMPOSITION_DETECTED_NO_BEHAVIOURAL_MAPPING` (structural walk) or `SOURCE_GROUNDED_COMPOSITION_RUNTIME_VERIFIED` (full pass) depending on whether the graph walker also maps to behavioural outcome literals.

2. **Pause Track B here** — Stage 10 is a solid green dot; Stage 11 boundary is now precisely documented; consolidate before continuing.

3. **Consolidate documentation** — 17+ doctrine reports now exist (Tests A-O + Fixes 4/7/8/9/10). A summary index (`nex1-staircase-2026-09-16.md`) mapping each stage to its report, capability state, and next-boundary would help future readers.

I recommend option 1 (Fix 11 · diagnostic-first authorization prompt as the next founder action). The pre-audit is already done; the gap is precisely one consumer walking the graph via endpoint match; scope stays narrow (no natural-language composer, no causal claim beyond structural chain).

But it's the founder's call. **No composer built. Freeze holds.**

---

## Final Truth

> Fix 10's Stage-10 relationships contain the structural data required for composition (R1.endpoint_B matches R2.endpoint_A at exact line + fact_kind), but no code path walks the relationship graph to build a composed argument. Native NEX1 does not yet compose. Test O is a valid diagnostic — it identified the exact next boundary (relationship-graph traversal), and the runtime demonstrated that Stage 11 remains architecturally absent even though Fix 10's data would support it.
